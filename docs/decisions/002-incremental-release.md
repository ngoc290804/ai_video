# 002 — Development release boundaries

The implementation is a runnable development build, not a declaration that SPEC v1 / AC01–AC25 are all satisfied. The local vertical slice, atomic JSON storage, Tauri host, actual FFmpeg and real fixed-origin provider adapters are implemented. Remaining gates and missing features are recorded explicitly in release-checklist.md.

The queue currently dispatches one job globally. This is a conservative resource limit below the specified maxima. Progress reports completed segments and phase, not fabricated percentages. Pause interrupts a currently encoding segment; completed checksum-valid normalized segments are reused. Local temporary workspaces left by interrupted jobs are retained for investigation.

The first packaging target is Ubuntu 26.04 x64, the available test host. Media executables come from the installed Ubuntu package; the generated manifest records SHA256, exact build version and license text. This FFmpeg build enables GPL, so it is not labeled LGPL-only. The deb depends on shared libav packages; no Node/Rust/ffmpeg executable installation is required at runtime. It is an unsigned development installer. Windows priority remains in the product roadmap and is not inferred supported from Linux compilation.

For unknown/corrupt project schema, open fails without writing. There is only schema version 1, so no speculative historical migration is invented. Duplicate clears project AI bindings; the user maps connections explicitly. Deleted projects are moved to application backups, not permanently erased.
