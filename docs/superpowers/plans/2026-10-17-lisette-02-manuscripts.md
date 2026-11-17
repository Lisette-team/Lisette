# 02 Manuscripts and publisher review

Owner: Person A. Read the [delivery plan](2026-10-17-lisette-delivery.md) rules first. Tables: database design §6 and `lisette-schema.html`, module "Opere și manuscrise". Requirements: Confirmed Manuscript Versions, Submission Lifecycle, Evaluation, Multi-Publisher Flow, Submission Requirements, Protection Policy.

### 02.1 Private PDF upload and owner reading

- **Needs:** 01.3.
- **Builds:** private `manuscripts` bucket with no client read access. Upload checks the real PDF content (not just the name) and size (20 MiB proposal), stores an immutable version with SHA-256 and time. Edge Function `manuscript-file` serves bytes only after checking the caller on every request (`no-store`). Read-only PDF reader: PDF.js in a WebView on Android (works in Expo Go) or a native reader (needs an EAS development build), PDF.js on web; prefer the one that keeps Expo Go working unless it fails the checks; both clear cached copies on lock and logout. Device authentication adapter (`expo-local-authentication`, biometrics with device PIN fallback) confirms uploads and unlocks the author's private manuscripts on the device; 05.3 reuses it.
- **Tables:** `manuscript_versions`.
- **Functions:** `uploadVersion(workId, file) → ManuscriptVersion`; gateway request `{versionId, submissionId?, purpose: "read" | "download"}`, owner only for now (every non-owner request fails until 02.3); `confirmPrivateAction() → "confirmed" | "cancelled" | "unavailable"`.
- **Acceptance:** SQL `owner_pdf_access` (owner-only metadata, no direct bucket reads). HTTP `owner_gateway_access` against the running local function: owner 200, signed out 401, other account 403, any `submissionId` denied. A non-PDF renamed `.pdf` is rejected. `device_auth_cancellation`: cancelling does not upload or open. Record phone, tablet and web rendering plus lock/logout behaviour in `docs/technical/pdf-validation.md`. If secure owner reading cannot be shown, stop and report.

### 02.2 Calls, catalogue and submissions

Detailed plan and record: [02.2-manuscripts-calls-and-submissions.md](02.2-manuscripts-calls-and-submissions.md).

- **Needs:** 02.1.
- **Builds:** publishers create calls: always open (`closes_at` empty) or with a deadline, each with its own requirements, languages and genres; several can be open at once. A call shows as open only if it is published, not cancelled, started, not ended, and its publisher is approved. Catalogue with two tabs (decided 2026-11-11, S-24): Open calls, the default, one entry per open call sorted by deadline; and Publications. Shared filters: publisher kind, genre, call language. Submission flow: the author picks one version and several calls, fills each call's materials, sees each call's requirements and sharing policy, previews the PDF, accepts the rights declaration and the email/phone disclosure, and sends. Each recipient gets an independent submission; results are shown per recipient; retry sends only failed ones.
- **Tables:** `calls`, `call_genres`, `submissions`, `submission_materials`, `submission_status_history`.
- **Functions:** `save_call(...)`, `publish_call(id)`, `cancel_call(id)`; `submit_manuscript(call_id, version_id, genre_id?, materials jsonb, idempotency_key) → uuid` (publisher taken from the call; copies contacts, stores the accepted policy snapshot, emits `submission_status_changed`); client `submitBatch(items) → outcome per call`.
- **Rules:** one active submission per work and publisher, whatever the version or call (partial unique index). After withdrawal or rejection, resubmission only if the publisher allows it (default no). Missing phone, missing consent or missing required material fails. An unknown outcome is resolved by repeating with the same `idempotency_key` before creating a new attempt.
- **Acceptance:** `batch_retry_is_independent`: A succeeds and B fails, retry creates no second A; two concurrent identical submits leave one active submission; a call that closes before commit rejects; an unapproved publisher's call is neither listed as open nor accepts a submit; missing phone, consent or material fails; a retry emits one event; a rollback leaves no event.

### 02.3 Review, evaluation, withdrawal

- **Needs:** 02.2.
- **Builds:** publisher inbox with Unopened/Opened, submission reader, short evaluation, decisions; author tracking with statuses and withdrawal.
- **Tables:** `submission_inbox`, `evaluations`.
- **Functions:** `transition_submission(submission_id, target, evaluation?)`, `withdraw_submission(submission_id)`. The gateway sets `opened_at` on the first successful read and now also authorises the recipient publisher.
- **Rules:** lock the row before changing it. Allowed moves: submitted → in_review / on_hold / selected / rejected; in_review → on_hold / selected / rejected; on_hold → in_review / selected / rejected; selected → rejected (optional note, no evaluation needed); author withdraws from submitted, in_review, on_hold or selected; rejected and withdrawn are final. Selecting needs an evaluation with at least one non-empty field (2000 characters total, proposal). Opening the PDF never changes status. File access: read and download in submitted / in_review / selected, read only in on_hold, nothing after rejected or withdrawn; enforce on the server, including download. Each change writes history and emits one event; selection plus evaluation share one event key. The author never sees `opened_at`.
- **Acceptance:** `selection_requires_evaluation`: empty evaluation fails; on_hold can go back, be selected or rejected; withdraw and select racing cannot both win; selecting at publisher A leaves B unchanged; selected can only be withdrawn or rejected. HTTP: every status gives the right read/download answer; an old file reference fails after withdrawal or rejection; recipient B keeps access when A's submission is withdrawn; on_hold read 200, download 403. The author's view never contains `opened_at`.
