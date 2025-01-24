# Super Simple Vite Dev Server

A development server that processes Vue SFC, JSX and JavaScript modules on the fly. This server implements basic features similar to Vite focusing on code transforming (e.g. JSX, CSS or Vue components).

The server uses several libraries:
- `@vue/compiler-sfc`: For Vue SFC parsing and compilation
- `es-module-lexer`: For ES module import/export analysis
- `magic-string`: For code transformations
- `esbuild`: For dependency bundling
- `connect`: For middleware-based server handling

Key points of understanding Vite dev server:
- Vite pre-bundles dependencies using esbuild.
- Vite serves source code over native ESM. This is essentially letting the browser take over part of the job of a bundler: Vite only needs to transform and serve source code on demand, as the browser requests it.

### What is `magic-string`
Rich Harris's [magic-string](https://github.com/Rich-Harris/magic-string) is a library designed to manipulate strings in a precise and efficient way while preserving mappings to the original string.

- When you transform source code (e.g., for a compiler, minifier, or bundler), preserving mappings to the original code is crucial for debugging. `magic-string` generates source maps alongside the transformed output, making it easier to trace back transformations during development.
- `magic-string` provides a mutable API for making multiple transformations (e.g., inserts, replacements) efficiently. It allows you to precisely control where and how changes are made without manually calculating indices.
- It focuses solely on string manipulation, making it simpler and faster than a full AST-based solution when you don't need structural analysis.

```js
import MagicString from 'magic-string';
import fs from 'fs';

const inputCode = `
const foo = 'hello';
console.log(foo);
`;

const magicString = new MagicString(inputCode);

// Replace "foo" with "bar" in the declaration and usage
magicString.overwrite(7, 10, 'bar');
magicString.overwrite(34, 37, 'bar');

const transformedCode = magicString.toString();
const sourceMap = magicString.generateMap({
  source: 'input.js',
  file: 'output.js',
  includeContent: true,  // Include the original content in the map
});

// When you open the Sources tab in DevTools,
// `output.js` will display your transformed code,
// a virtual `input.js` file will appear, showing your original code.
fs.writeFileSync('output.js', `${transformedCode}\n//# sourceMappingURL=output.js.map`);
fs.writeFileSync('output.js.map', sourceMap.toString());
```
