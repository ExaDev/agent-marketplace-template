# example-lsp

A minimal example of a plugin-provided language server. `.lsp.json` maps server names to configs; this one runs `typescript-language-server --stdio` and maps `.ts`, `.tsx`, `.js` and `.jsx` to their LSP language IDs through the required `extensionToLanguage` field. The plugin ships no binary: the server must be on your `PATH`.

## Try it

```bash
npm install -g typescript-language-server typescript
claude --plugin-dir ./plugins/example-lsp
```

Open a TypeScript file in a project and Claude gets diagnostics and code navigation for it.

## Content owner

The repository maintainers.
