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
