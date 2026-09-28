# Snapshot and configuration compatibility

RepoAtlas v1 uses `schemaVersion: 1` for analysis snapshots. The draft 2020-12 JSON Schemas are published in [`schemas/snapshot.schema.json`](schemas/snapshot.schema.json) and [`schemas/config.schema.json`](schemas/config.schema.json), and can be printed by the installed CLI:

```sh
repoatlas schema snapshot > repoatlas-snapshot.schema.json
repoatlas schema config > repoatlas-config.schema.json
```

Within schema version 1, required graph fields and their meanings remain stable. Optional fields and additive metadata may be added without changing the schema version. Consumers should ignore unknown fields and should not infer runtime behavior from static edges. A change that removes or changes the meaning of a required field needs a new schema version and a documented migration path.

New snapshots include `importBindingsVersion: 1` when they record explicit named/default bindings on static dependency edges. Snapshot comparison uses this capability marker so older files without the index are reported as unavailable rather than unchanged.

The architecture-rules config is intentionally strict: unknown keys fail validation. This helps avoid silently ignored policy. Its boundary identifiers must exist in the analyzed snapshot. Snapshot parsing accepts additive metadata to allow compatible evolution.

The CLI currently requires Node.js 22 or newer. CI exercises Node 22 and 24 on Linux, macOS, and Windows. RepoAtlas does not install or execute code from the analyzed repository.
