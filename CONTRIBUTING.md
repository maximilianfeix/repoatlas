# Contributing

Use Node.js 22 or newer. Run `npm ci` and `npm test` before submitting changes.

For resolution bugs, include a minimal TypeScript fixture, the relevant tsconfig and the expected edge and line number. Add a regression test under `test/`. Keep source evidence deterministic and do not execute analyzed project code.

Viewer changes should be checked in a browser with a real example: search, directory and entry filters, module selection, edge evidence, source links, keyboard navigation, and a narrow mobile viewport. Generated HTML must work without network access.

Keep pull requests focused. Explain the observable behavior and what you verified. Do not commit secrets, private repository snapshots, node_modules or build outputs.
