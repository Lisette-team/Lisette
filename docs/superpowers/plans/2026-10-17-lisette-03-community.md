# 03 Profiles, beta-readers and reading patterns

Read the [delivery plan](2026-10-17-lisette-delivery.md) first. Tables: database design §7 and `lisette-schema.html`, modules "Comunitate și partajare" and "Heatmap de citire". Requirements: Sharing Policy, Public Author Profile and Portfolio, Public Publisher Profile, Community Scope, Reading Patterns. Done and merged: 03.1 (approvals, quotes, page shares, everyone/followers audience) and 03.3 (posts, reactions, comments, follows).

### 03.2 Profiles and portfolio

- **Builds:** person profile (name or pen name, photo, bio, links, posts, events); author sections Work in progress, Recently published, Inspirations; portfolio editor; publication profile (intro, kind, profile genres, confirmed authors and books, open calls, posts, events, discoveries); association request from a publication and confirmation by the author. Follow and block actions on profiles. The catalogue's Publications tab opens the publication profile (S-13).
- **Tables:** `portfolio_entries`, `author_publisher_associations`.
- **Functions:** `save_portfolio_entry(...)`, `delete_portfolio_entry(id)`, `propose_association(author_id)` (publication), `confirm_association(id, accept)` (author). A new portfolio entry emits `author_published` to followers.
- **Rules:** Work in progress = the author's works with `visibility = public` and `is_published = false`, plus their permitted excerpts. Inspirations = public library entries marked as inspiration. Never show files, submissions, contacts, evaluations or pending associations.
- **Acceptance:** `profile_preserves_private_data`: WIP shows only permitted excerpts; Inspirations shows only public inspiration entries; a pending association is absent; an author edits and deletes their own portfolio entry but not someone else's.

### 03.4 Beta-readers

- **Builds:** beta shares of chosen page ranges from one version, sent to invited readers who accept first; read in the app only, revocable by the author (S-58, S-59). The everyone/followers audience already exists from 03.1; reuse its pages-only PDF generation.
- **Tables:** `beta_shares`, `beta_share_readers`.
- **Functions:** `create_beta_share(work_id, version_id, page_ranges, reader_ids) → uuid`, `respond_beta_invite(share_id, accept)`, `revoke_beta_share(share_id, reader_id?)`. The gateway gains purpose `beta_read` and serves only the granted pages. Each invitation emits an in-app `beta_shared` event.
- **Rules:** a beta share needs the same publisher approvals as an excerpt. Beta content never appears in search, reshares or public work pages.
- **Acceptance:** `beta_respects_access`: a pending approval blocks a beta share; a beta-reader gets only the granted pages; a non-invited account gets 403; revocation makes an old reference fail; a beta download request is denied.

### 03.5 Opt-in reading patterns

- **Builds:** consent setting (off, standard, no threshold; plus noise permission), the excerpt reader (S-53) recording sessions on public excerpts while open in the foreground, the author heatmap (single hue Paper to Burgundy, text labels, copy rules in `brand/voice.md`, no scores), sharing an excerpt's patterns with chosen publications.
- **Tables:** `reading_consents`, `reading_sessions`, `pattern_shares`.
- **Functions:** `set_reading_pattern_consent(level, noise)`, `record_reading_session(excerpt_id, text_version_id, segments, stop_segment?, context)`, `get_excerpt_patterns(excerpt_id)` (aggregate only), `share_excerpt_patterns(excerpt_id, publisher_id, shared)`.
- **Rules:** segments are paragraphs of the exact text version. Standard sessions count only from 10 consenting readers; no-threshold sessions count at any size. No reader identity ever leaves the database. Motion is reduced on the phone to still/moving; noise to quiet/moderate/loud. Before building noise, verify an Android API that gives the input level without writing audio to storage and record it in `docs/technical/reading-context.md`; if only a temporary recording is possible, stop and ask. No retention period until decided.
- **Acceptance:** `patterns_are_opt_in_and_aggregate`: without consent nothing is stored; below 10 readers the author gets `belowThreshold` unless no-threshold readers exist, then only theirs; results carry no reader IDs; a publication sees patterns only while shared; followers-only, beta, manuscripts and submissions cannot be recorded; opting out stops new sessions; denied microphone still records position with noise empty. Device check: no audio file exists after a session.
