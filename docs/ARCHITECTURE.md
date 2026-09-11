# Architecture decisions

## Process boundaries

The renderer is an untrusted presentation layer. It has no Node.js integration and communicates through a small typed preload API. Persistence and outbound HTTP stay in the main process. IPC handlers validate incoming data before using it.

## Layers

1. **Domain:** request, workspace, environment, and response contracts.
2. **Application:** variable resolution, cURL conversion, request preparation.
3. **Adapters:** JSON persistence and Fetch-based HTTP execution.
4. **Presentation:** React components and a reducer-driven store.

## Security baseline

- `contextIsolation`, sandboxing, and a restrictive Content Security Policy
- no remote renderer content and no raw `ipcRenderer` exposure
- navigation and popup creation blocked
- explicit IPC channels with runtime schemas
- secret values are masked in the UI

Phase 1 JSON persistence is not an encrypted vault. Users should not treat it as secure secret storage until the encrypted storage adapter is delivered in Phase 2.

Variable resolution is deterministic. Values are merged from broadest to narrowest scope: global, workspace-local, then active environment. A narrower scope overrides a value with the same key from any broader scope.
