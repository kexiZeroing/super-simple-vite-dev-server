# Super Simple Vite Dev Server

A development server that processes Vue SFC and JavaScript modules on the fly. This server implements basic features similar to Vite, focusing on Vue file handling and ES module imports.

The server uses several key libraries:
- `@vue/compiler-sfc`: For Vue SFC parsing and compilation
- `es-module-lexer`: For ES module import/export analysis
- `magic-string`: For code transformations
- `esbuild`: For dependency bundling
- `connect`: For middleware-based server handling
