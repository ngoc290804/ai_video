# OpenAI adapter — verified documentation 2026-09-28

Official sources fetched with OpenAI Docs:
- https://developers.openai.com/api/docs/guides/text
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/image-generation
- https://developers.openai.com/api/docs/models/gpt-image-1
- https://developers.openai.com/api/docs/models/gpt-4.1-mini
- https://developers.openai.com/api/docs/guides/video-generation
- https://developers.openai.com/api/docs/guides/text-to-speech

| Capability | Endpoint on https://api.openai.com/v1 | Catalog | Output |
|---|---|---|---|
| Text | POST /responses | gpt-4.1-mini | output[].content[].text; store=false |
| Image | POST /images/generations | gpt-image-1 | data[0].b64_json, 1024×1024 low quality |
| Video | POST /videos; GET /videos/{id}; GET /videos/{id}/content | sora-2, sora-2-pro | multipart create; persist ID; poll; authenticated bytes |
| Voice | POST /audio/speech | gpt-4o-mini-tts | MP3; selectable documented voices |

These are explicit, conservative catalog selections, not assertions of universal account access or the newest models. Video adapter accepts documented 4/8/12-second subset and 1280×720/720×1280; newer provider options are not automatically enabled. Pricing is not guessed. Cost UI says unavailable and shows exactly one paid submission. No generation in connection testing, app startup, tests or packaging.

Bearer auth comes from OS keyring or explicit session-only memory. GET /models is the lightweight connection test. Catalog is independent of the account's available model list; inaccessible models produce provider errors. HTTP 401/403 → PROVIDER_AUTH; 429 → RATE_LIMITED; 400/404/422 → PROVIDER_REJECTED. Ambiguous submit transport/5xx → SUBMISSION_UNKNOWN, blocked and never auto-resubmitted. No remote cancellation or idempotency guarantee is advertised. Video pause/cancel stops local polling; provider work may continue and be charged.

Reference-image uploads are not implemented in this adapter revision. UI states this before payment; supportsReferenceImages=false. Character appearance and style are included as text for image/video. No arbitrary base URL, URL output downloads or redirects are accepted. Content endpoint is fixed to the provider's origin. JSON and binary downloads have byte bounds; binary writes stream to .partial and probe/hash before import. Redirect-based CDN download is deliberately rejected pending an audited host allowlist.

Example redacted video response: {"id":"video_REDACTED","status":"queued","seconds":"4","size":"1280x720"}. No provider account credentials were supplied, so **all four live generation smoke tests remain unverified**. Source verification does not count as live validation. Structured plans are schema-validated and appended only after review; invalid outputs fail without applying partial changes. Automatic paid JSON-repair retries are not enabled.

### Voice mapping follow-up (2026-10-05)

Speech requests now include resolved voice, `speed` (0.25–4), and `instructions` for language/emotion/pronunciation. Built-in voices additionally include verse/marin/cedar. Verified against [OpenAI Create speech](https://developers.openai.com/api/reference/cli/resources/audio/subresources/speech/methods/create). Serialization/precedence tests are offline; no live quality or billing assertion is made. Language is an instruction, not a dedicated speech API language parameter.
