# Postblack product roadmap

## Product direction

Postblack is a desktop API workspace with a focused, dark interface. It borrows proven API-client workflows without copying Postman's branding or proprietary implementation.

## Phase 1 — HTTP foundation

- Local workspaces and collections
- Saved HTTP requests and autosave
- Query parameters, headers, body, and common authentication
- Global, workspace-local, and environment variables using `{{name}}`
- Import and generate cURL
- Response status, timing, size, headers, and body
- Local request history

## Phase 2 — Professional workflows

- Nested folders, tabs, search, duplicate, drag-and-drop
- Postman Collection v2.1 and OpenAPI import/export
- Cookie jar, proxy, client certificates, and TLS settings
- Pre-request and post-response scripts in an isolated sandbox
- Assertions, collection runner, datasets, and reports
- Secrets vault and encrypted local persistence

## Phase 3 — Multi-protocol and collaboration

- GraphQL, WebSocket, Server-Sent Events, gRPC, and MQTT
- Git-friendly workspace format
- Team accounts, roles, comments, version history, and cloud sync
- Mock servers, scheduled monitors, generated documentation, and CLI

## Definition of done for Phase 1

The desktop app must launch, persist edits across restarts, interpolate active variables, send an HTTP request from the Electron main process, display the real response, and round-trip supported cURL commands without losing method, URL, headers, authentication, or body.
