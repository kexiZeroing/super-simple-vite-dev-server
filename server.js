import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url'
import connect from 'connect';
import MagicString from 'magic-string';
import { init, parse as parseEsModule } from 'es-module-lexer';
import { buildSync } from 'esbuild';
import {
  parse as parseVue,
  compileScript,
  compileTemplate,
  rewriteDefault,
} from '@vue/compiler-sfc';

const app = connect();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const removeQuery = (url) => {
  return url.split("?")[0];
};

const getQuery = (url, key) => {
  const searchParams = url.includes('?') 
    ? new URLSearchParams(url.split('?')[1])
    : new URLSearchParams('');
  return searchParams.get(key);
};

const checkQueryExist = (url, key) => {
  const searchParams = url.includes('?') 
    ? new URLSearchParams(url.split('?')[1])
    : new URLSearchParams('');
  return searchParams.has(key);
};

const cssToJsResponse = (css) => {
  return `
    const insertStyle = (css) => {
      let el = document.createElement('style')
      el.setAttribute('type', 'text/css')
      el.innerHTML = css
      document.head.appendChild(el)
    }
    insertStyle(\`${css}\`)
    export default insertStyle
  `;
};

async function parseBareImport(code) {
  // https://github.com/guybedford/es-module-lexer
  await init;
  const parseResult = parseEsModule(code);
  // https://github.com/rich-harris/magic-string
  const s = new MagicString(code);

  parseResult[0].forEach((item) => {
    // import xx from 'xx' -> import xx from '/@module/xx'
    // for css file, use '?import' to differentiate import statement and link tag
    if (item.n && item.n[0] !== "." && item.n[0] !== "/") {
      s.overwrite(item.s, item.e, `/@module/${item.n}`);
    } else {
      s.overwrite(item.s, item.e, `${item.n}?import`);
    }
  });

  return s.toString();
}

app.use(async function (req, res) {
  try {
    if (req.url === "/") {
      let html = fs.readFileSync(path.join(__dirname, "index.html"), "utf-8");
      res.setHeader("Content-Type", "text/html");
      res.statusCode = 200;
      res.end(html);
      return;
    }

    // match URLs like:
    // script.js
    // script.js?version=123
    // script.js?callback=foo
    //
    // but would NOT match:
    // script.js.map
    // script.jsx
    // script.js.php
    if (/\.js\??[^.]*$/.test(req.url)) {
      let js = fs.readFileSync(path.join(__dirname, removeQuery(req.url)), "utf-8");
      const jsCode = await parseBareImport(js);

      res.setHeader("Content-Type", "application/javascript");
      res.statusCode = 200;
      res.end(jsCode);
      return;
    }

    if (/^\/@module\//.test(req.url)) {
      let pkg = req.url.slice(9);
      let pkgJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, "node_modules", pkg, "package.json"), "utf8")
      );
      let entry = pkgJson.module || pkgJson.main;
      let outfile = path.join(__dirname, `esbuild/${pkg}.js`);

      buildSync({
        entryPoints: [path.join(__dirname, "node_modules", pkg, entry)],
        format: "esm",
        bundle: true,
        outfile,
      });

      let js = fs.readFileSync(outfile, "utf8");
      res.setHeader("Content-Type", "application/javascript");
      res.statusCode = 200;
      res.end(js);
      return;
    }

    if (/\.css\??[^.]*$/.test(req.url)) {
      let cssContent = fs.readFileSync(path.join(__dirname, removeQuery(req.url)), "utf-8");
      let cssRes;
      if (checkQueryExist(req.url, "import")) {
        // import style.css -> return js response
        cssRes = cssToJsResponse(cssContent);
        res.setHeader("Content-Type", "application/javascript");
      } else {
        // css link file
        res.setHeader("Content-Type", "text/css");
      }
      res.statusCode = 200;
      res.end(cssRes);
      return;
    }  

    if (/\.vue\??[^.]*$/.test(req.url)) {
      let vue = fs.readFileSync(path.join(__dirname, removeQuery(req.url)), "utf-8");
      let { descriptor } = parseVue(vue);

      let code = "";

      if (getQuery(req.url, "type") === "template") {
        code = compileTemplate({
          source: descriptor.template.content,
          id: path.basename(removeQuery(req.url)),
        }).code;

        code = await parseBareImport(code);
        res.setHeader("Content-Type", "application/javascript");
        res.statusCode = 200;
        res.end(code);
        return;
      }

      if (getQuery(req.url, "type") === "style") {
        let index = getQuery(req.url, "index");
        let styleContent = descriptor.styles[index].content;
        code = cssToJsResponse(styleContent);

        res.setHeader("Content-Type", "application/javascript");
        res.statusCode = 200;
        res.end(code);
        return;
      }

      let script = compileScript(descriptor, {
        id: path.basename(removeQuery(req.url)),
      });

      if (script) {
        const bareJs = await parseBareImport(script.content);
        code += rewriteDefault(bareJs, "__script");
      }

      if (descriptor.template) {
        let templateRequest = removeQuery(req.url) + `?type=template`;
        code += `\nimport { render as __render } from ${JSON.stringify(
          templateRequest
        )}`;
        code += `\n__script.render = __render`;
      }

      if (descriptor.styles) {
        descriptor.styles.forEach((s, i) => {
          const styleRequest = removeQuery(req.url) + `?type=style&index=${i}`;
          code += `\nimport ${JSON.stringify(styleRequest)}`;
        });
      }

      code += `\nexport default __script`;

      res.setHeader("Content-Type", "application/javascript");
      res.statusCode = 200;
      res.end(code);
      return;
    }

    res.statusCode = 404;
    res.end("Not found");
  } catch (error) {
    console.error("Error:", error);
    res.statusCode = 500;
    res.end(error.message);
  }
});

http.createServer(app).listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
