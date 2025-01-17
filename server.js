import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import connect from 'connect';
import MagicString from 'magic-string';
import { init, parse as parseEsModule } from 'es-module-lexer';
import { buildSync, transformSync } from 'esbuild';
import serveStatic from 'serve-static';
import {
  parse as parseVue,
  compileScript,
  compileTemplate,
  rewriteDefault,
} from '@vue/compiler-sfc';
import {
  removeQuery,
  getQuery,
  checkQueryExist,
  cssToJsResponse,
  isStaticAsset,
} from './utils.js';

const app = connect();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function parseBareImport(code) {
  // https://github.com/guybedford/es-module-lexer
  await init;
  const parseResult = parseEsModule(code);
  // https://github.com/rich-harris/magic-string
  const s = new MagicString(code);

  parseResult[0].forEach((item) => {
    // Key point: relative module specifiers must start with ./, ../, or /
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

// public dir as static files
app.use(serveStatic(path.join(__dirname, "public")));

app.use(async function (req, res) {
  try {
    if (/\.js(\?|$)(?!x)/.test(req.url)) {
      let js = fs.readFileSync(path.join(__dirname, removeQuery(req.url)), "utf-8");
      const jsCode = await parseBareImport(js);

      res.setHeader("Content-Type", "application/javascript");
      res.statusCode = 200;
      res.end(jsCode);
      return;
    }

    if (/\.jsx(\?|$)/.test(req.url)) {
      const jsxContent = fs.readFileSync(path.join(__dirname, removeQuery(req.url)), "utf-8");
      const transformed = transformSync(jsxContent, {
        loader: "jsx",
        format: "esm",
        target: "esnext",
      });
      const jsCode = await parseBareImport(transformed.code);

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
        /**
         * Rewrite `export default` in a script block into a variable
         * declaration so that we can inject things into it.
         * 
         * e.g.
         * const __sfc__ = {
         *   name: 'App',
         *   setup() { ... }
         * }
         */
        code += rewriteDefault(bareJs, "__sfc__");
      }

      if (descriptor.template) {
        let templateRequest = removeQuery(req.url) + `?type=template`;
        code += `\nimport { render as __render } from ${JSON.stringify(templateRequest)}`;
        code += `\n__sfc__.render = __render`;
      }

      if (descriptor.styles) {
        descriptor.styles.forEach((s, i) => {
          const styleRequest = removeQuery(req.url) + `?type=style&index=${i}`;
          code += `\nimport ${JSON.stringify(styleRequest)}`;
        });
      }

      code += `\nexport default __sfc__`;

      res.setHeader("Content-Type", "application/javascript");
      res.statusCode = 200;
      res.end(code);
      return;
    }

    // import static file -> response js export only static file url
    if (isStaticAsset(req.url) && checkQueryExist(req.url, "import")) {
      res.setHeader("Content-Type", "application/javascript");
      res.statusCode = 200;
      res.end(`export default ${JSON.stringify(removeQuery(req.url))}`);
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
