# 001 — Foundation, 2026-09-28

React + TypeScript + Tauri 2 with an in-process Rust library; JSON snapshots remain authoritative. No network server or database. Single IPC dispatcher validates version, UUID, operation and revision; native dialogs issue short-lived opaque selection tokens. Provider URLs are fixed to the documented HTTPS API origin; no arbitrary compatible endpoints or untrusted download redirects.

Schemas are imported once from the specification by `bootstrap-schema.mjs`; after that, edit JSON schema and regenerate TypeScript. Backend validates schema and cross-entity invariants before every commit. Whole-editor saves may edit only authoring fields; asset registry, project identity/revision and timestamps remain backend owned.

Local render uses immutable manifests and cached normalized segments. Conservative normalized encoding is the default; stream-copy optimization is deferred. Anything unsupported must fail preflight rather than silently ignore an edit.

Release status is tracked in release-checklist.md, including missing live credentials and clean-machine gates. Development via a browser shows a clearly labeled unavailable desktop backend, never a production mock.
