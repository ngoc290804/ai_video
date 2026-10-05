# Release checklist — development build 0.1.0

This is **not a fully accepted SPEC v1 release**. PASS below applies only to the named tested subset. No paid AI request was made. No Windows/macOS build or clean-machine installer test was performed. Native desktop tests use the real Tauri host/backend; browser tests do not substitute for them.

## Milestones

- [x] Runnable foundation: Tauri + React, separate Rust library, domain/command JSON schemas, generated domain TypeScript, root commands, locks and atomic repository.
- [x] Local authoring vertical slice: projects, character metadata/reference import/reorder and voice mapping, story, manual chapters/scenes/shots/dialogue, session undo/redo, revisions, asset library, timeline and autosave.
- [x] Real media vertical slice: FFprobe import, normalized segment cache, MP4 export, mixed-source merge, crossfade, audio mix/fades/ducking, two-pass loudness, subtitles.
- [x] AI adapter code for four capabilities, scoped text proposals, structured plan proposals, explicit paid submission, durable records and unknown-submit blocking.
- [ ] Full AI live acceptance (credentials absent); reference upload and all provider/recovery fault fixtures incomplete.
- [ ] All long-video, security/resource, installer and multi-OS release gates.

## Evidence

- `pnpm check`: TypeScript/schema + Rust fmt/clippy.
- `pnpm test`: frontend session/frame tests; Rust domain/storage/path/recovery/queue tests; actual FFmpeg mixed-source/fractional/crossfade/subtitle/pause/cache tests.
- `pnpm test:e2e`: browser navigation, creation form validation, 1440 and 1024 width, no JS errors. Test explicitly labels browser mode, no mock production backend.
- `node scripts/desktop-smoke.mjs`: native Tauri window, real invoke, create/update Unicode story/close/open/revisions/delete. Screenshot `tests/fixtures/native-desktop.png`, result JSON in same folder.
- `cargo test -p studio-backend --test long_video -- --ignored --nocapture`: 200-scene synthetic 30-minute fixture; profile and actual measurements in benchmark JSON/resource report. Small 160×90 test does not certify 1080p throughput, 200 unique multi-GB sources, or A/V marker sync.
- Build/package: unsigned `.deb` under `target/release/bundle/deb`; verify final artifact and SHA256SUMS. Source/installed package and binary checksums in `licenses/media-manifest.json`.

## AC01–AC25

| ID | Status | Evidence / missing gate |
|---|---|---|
| AC01 | Unverified | Native app runs on development Ubuntu host; clean-machine installation not tested. |
| AC02 | Partial pass | Offline CRUD, import, real render/merge tested; no automatic network work; full UI golden path still incomplete. |
| AC03 | Partial | Character/reference reorder and voice mapping editor implemented; 3-character multi-image orientation golden test pending. |
| AC04 | Unverified live | Structured plan adapter/schema/review/apply exists; deterministic plan test passes; no live AI. |
| AC05 | Partial | Field-target proposals/locked scopes/conflict and stale dependency hashing implemented/tests; live scene-12 dialogue case pending. |
| AC06 | Partial pass | expectedRevision and proposal target rebase checks; outputs are unselected variants; full concurrent remote suite pending. |
| AC07 | Partial | Four independent bindings, OS/session secrets; sentinel persistence test. OS keyring set/read-status/delete smoke passed; exhaustive exports/log scans pending. |
| AC08 | Unverified | Real adapters written and official APIs verified; no credentials/live generations. |
| AC09 | Partial pass | 16:9 and 1:1 fixtures, fractional FPS, mixed-source normalization tested. Long synthetic A/V markers passed; portrait export matrix pending. |
| AC10 | Partial pass | Strict preflight and frame/container checks; 30/1 and 30000/1001 fixtures; additional codecs/long-marker matrix pending. |
| AC11 | Partial | Voice/audio beyond timeline rejected. Manual edit/extend/regenerate possible; time-stretch workflow not implemented. |
| AC12 | Partial | Atomic/fsync storage, receipt ordering, valid previous history and corruption preservation tested. OS process-kill/fault injection matrix pending. |
| AC13 | Partial | Unknown remote submit recovery blocked and tested; live kill-at-submit/idempotency not verified. |
| AC14 | Partial pass | Real pause/checkpoint/cache reuse test; full process-restart stage matrix pending. |
| AC15 | Partial pass | 20+10-minute synthetic merge passed: color/frequency markers at boundary ±100ms and first/last samples; 1800021ms output. Representative HD sources pending. |
| AC16 | Partial pass | Real 25fps landscape + 24fps portrait/no-audio fixture normalized and concatenated; corrupt/HDR/VFR matrix incomplete. |
| AC17 | Partial | Typed failures, free-space preflight/checkpoint, originals preserved; disk-full/network injection suite incomplete. |
| AC18 | Partial | Relative registry paths and native folder open implemented; moved project with pending remote jobs not fully supported. |
| AC19 | Partial pass | No plaintext fallback; session memory tested; OS store lock/unlock manual smoke pending. |
| AC20 | Pass on tested filesystem | OS exclusive lock test prevents second writer; broader network FS support not claimed. |
| AC21 | Partial pass | Restore increases revision; frontend undo/redo tests; revision pin/retention cleanup not complete. |
| AC22 | Partial | Synthetic 200-scene/30-minute benchmark only; UI virtualization and full representative 1080p/memory matrix pending. |
| AC23 | Partial pass | Real FFmpeg Unicode, spaces and quote filename fixture passes; Windows/macOS path matrix pending. |
| AC24 | Partial | Cleanup restricted to derived normalized cache while no active jobs; full export/revision/pin matrix pending. |
| AC25 | Unverified release | Unsigned Linux dev package only. Clean machine, exhaustive licenses/source distribution, audits and other OS releases remain gates. |

## Explicit implementation limitations

- Remaining SPEC UI: Save As/data-root migration, shared presets/global pronunciation dictionary, reference file drag/drop and replacement, full localized string catalog, virtualized 200-scene list, normalized proxy/draft player, reveal/export diagnostics UX.
- Whole-editor updates use validated allowlisted authoring snapshot fields, not a fully generated per-entity operation client. Command request schemas exist; complete response/event schemas and event sequence/session reconciliation remain open. Frontend polls durable snapshots/jobs.
- Queue serializes all jobs (safe conservative limit), lacks dependency DAG and automatic exponential-backoff scheduler. It does not claim remote cancel/refunds, infinite dedup or exactly-once. Unknown submission is blocked. Complete disk failure/late result/imported-jobs trust/restart auditing remains open.
- Text structured plan supports append after review, not every chapter/scene/story generation target from the SPEC. No automatic paid repair requests. AI output is bounded and schema/domain validated.
- Image/video adapter currently supports text prompts only; no reference upload. Capability accurately reports unsupported. TTS timestamps/word alignment are not claimed.
- Crossfade is limited to 16 items per render pending larger-graph memory testing; long cut path uses streaming concat. Hardware encode, HDR tone mapping, fast stream-copy optimization and time-stretch UI are not supported.
- Media engine source timestamp/VFR/audio marker regression suite is incomplete. Two-pass loudnorm has a silence bypass; target LUFS needs representative audio verification.
- Explicit corruption recovery advances beyond the highest valid revision/receipt and preserves the corrupt original. Full process-kill fault injection across each OS remains open.
- Data-root owner lock permits one app owner per root; copied project moves and corrupt queue/settings recovery require further hardening. Cleanup retention is conservative and storage can grow.
- Linux package uses distro shared libraries; it is not a portable AppImage. macOS signing/notarization and Windows code signing unavailable.

Do not relabel this checklist as all-pass based solely on successful compilation or UI screenshots.

## Additional verified evidence

- Final dependency update: npm audit reports zero known advisories; Rust security audit remains pending.
- Native UI creates three Vietnamese-named characters and persists autosave. Extracted Debian executable also passed native smoke on this host (not a clean-machine installation).
- 20+10 minute merge completed in 307.64 seconds at 160×90/24fps; see `benchmark-merge-30min.json`.

## 2026-10-05 implementation follow-up

- Added chapter/scene/shot duplicate and bidirectional reorder, chapter removal, and safe cleanup of timeline references when deleting shots/scenes. Reorder marks scenes draft for continuity review; it does not reorder the edited timeline or launch AI. Copies receive new nested IDs and keep imported media; generated selected outputs are cleared because their provenance belongs to the old target.
- Added character connection/voice/speed/language mapping, dialogue emotion/pronunciation notes and persistent dialogue voice override. Resolution is dialogue override > speaker mapping > project defaults. Backend resolves settings before creating jobs. Speaker mapping affects audio stale hashes even when the speaker is not listed in scene.characterIds. Unrelated visual changes do not invalidate voice.
- Added original-file relink from Library. The selected file must match registered SHA-256 and size. Copies are staged and published without overwriting, path traversal/symlinks are rejected, and registry IDs/revisions are preserved. A changed or corrupt existing destination is deliberately not replaced; import new content as a new asset.
- Optional absolute `AI_VIDEO_STUDIO_DATA_ROOT` environment setting selects an independent root at launch, used by isolated native tests. This does not migrate existing projects or provide the complete Settings migration flow.
- Added regression tests for nested ID/media behavior, reorder/delete references, voice precedence and stale detection, TTS request serialization, and exact-byte relink with symlink/path rejection. Live TTS remains unverified; no paid calls made.

### Verification for this follow-up

- 8 frontend tests and 19 backend tests passed across the full suite and the final added voice-enqueue regression. Two long benchmarks retain prior evidence and were not rerun because the renderer was unchanged.
- `pnpm check` passed (contracts, TypeScript, rustfmt, clippy); browser E2E passed.
- Final extracted `.deb` passed native UI create/three-character/autosave, character voice mapping and chapter/scene/shot duplicate/reorder checks in `/tmp/ai-studio-acceptance-oct05`. Screenshot reviewed: `tests/fixtures/native-desktop.png`.
- Final installer SHA-256: `9f37c7368f174fe1fdcba7b2e945d9192de63b459c3dfe20df7b633b4cf01f50`.

## Installer simplification (2026-10-05)

- Ubuntu packaging now derives versioned runtime dependencies from the built application and both media executables with `dpkg-shlibdeps`; apt also installs GStreamer playback codecs. The generated package no longer hardcodes Ubuntu 26.04 libav package names.
- Added native Windows NSIS packaging with pinned, SHA-256-verified static FFmpeg/FFprobe and the offline WebView2 installer. Windows build/install/media verification runs separately on GitHub; no Windows UI acceptance is implied.
- Added `Build installers` workflow for Ubuntu 24.04 and Windows x64, with installed media rendering checks before artifacts are uploaded. Artifacts are not automatically published as releases.
- Local Ubuntu 26.04 package built successfully; extracted media rendered H.264/AAC and Vietnamese subtitles with no system FFmpeg in PATH. Apt dependency resolution simulation passed. This is not a clean-machine or offline-install test.
- Generated bundle configurations validated against the installed Tauri JSON schema. Runtime application logic was unchanged.
