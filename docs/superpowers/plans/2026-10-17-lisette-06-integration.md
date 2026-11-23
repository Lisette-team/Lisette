# 06 Notifications, moderation, search and release

Read the [delivery plan](2026-10-17-lisette-delivery.md) rules first. Tables: database design §8 and `lisette-schema.html` module "Notificări și moderare". Requirements: Manuscript Notifications, Reporting and Moderation, Search Scope.

### 06.1 Notifications and bilingual email (A)

- **Builds:** in-app inbox; an email worker (Edge Function on a schedule) that reads `domain_events`, including events created before it existed, and sends in each recipient's language. Channels: in-app plus email for manuscript events (status, evaluation, sharing decisions); in-app only for event edits/cancellations, `author_published` and `beta_shared`. Emails contain minimal content and a signed-in deep link, never manuscript text or contact data. Local mail sink first; choosing an email provider is a separate step with its cost.
- **Tables:** `notifications`.
- **Functions:** `process_notification_outbox(limit) → {sent, failed}` (service role only), `mark_notification_read(id)`.
- **Rules:** one row per event, recipient and channel; limited retries with backoff; exhausted deliveries visible to admins. If the provider has no idempotency, document that an email may repeat after an uncertain network failure.
- **Acceptance:** `outbox_is_idempotent`: selection plus evaluation creates one notice; a retry does not duplicate the in-app row; an email failure stays retryable and never reverts the submission; the payload holds only what the recipient may see; a followers-only `author_published` reaches current followers only.

### 06.2 Reporting and moderation (together)

- **Builds:** report sheet (reason plus explanation) for accounts, posts, comments, reviews, excerpts, events and discoveries; restricted admin queue; manual hide, suspend, dismiss and full discovery removal, with an audit trail. Finish account export (`export_my_data` gains every table added since 04.1: evaluations, excerpts, text versions, sharing requests and decisions, share pages, and the tables of 03.2–05.2; extend `export_all_modules.test.sql` to check every key) and the deletion-request review; present a retention proposal before any destructive step.
- **Tables:** `reports`, `moderation_actions`.
- **Functions:** `report_content(target_type, target_id, reason, details) → uuid`, `moderate_report(report_id, action)`.
- **Rules:** a report alone hides nothing. Suspension blocks sign-in-protected actions. Admin access never opens private manuscripts through the gateway.
- **Acceptance:** `manual_moderation_only`: a report queues without hiding; a non-admin cannot moderate; hiding a source also hides its reshares and search results; a suspended account cannot change data; an admin cannot fetch a manuscript file; the export never contains another author's evaluation.

### 06.3 Search (B)

- **Builds:** one search with results grouped into authors, publications, books/works and events, linked to their pages, with truthful empty, loading and error states.
- **Functions:** `search_catalogue(query, category, limit, offset)`: case-insensitive Postgres search, query 2–100 characters, 20 results per category by default, at most 50, stable order. No external search service.
- **Acceptance:** `search_is_categorized_and_private`: a public unpublished work, an author, a publication and an event are found in their categories; signed-out search is denied; private works, library entries, manuscripts, contacts, evaluations, pending associations, followers-only excerpts (for non-followers), beta shares and moderated content never appear.

### 06.4 Device testing, demo and builds (together)

- **Builds:** run every suite; Android phone and tablet manual flows; installed release APK; web export without secrets. Trace every acceptance criterion to a test or manual check in `docs/testing/acceptance.md`; show create/read/update/delete on posts, library entries, events and reviews in `docs/testing/crud-evidence.md`; show at least three working sensors plus biometrics on real devices. Demo publications and accounts are clearly fictional (`docs/testing/demo.md`); no automated demo status changes in production data. Prepare the APK and web build for review; publishing or deploying is a separate decision.
- **Acceptance:** `release_matrix`: all of the above recorded, plus old-file-reference denial checked after status changes.
