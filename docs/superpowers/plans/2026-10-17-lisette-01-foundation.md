# 01 Foundation and accounts

Owner: together (week 1). Read the [delivery plan](2026-10-17-lisette-delivery.md) rules first. Tables: database design §4 and `lisette-schema.html`, module "Conturi și publicații".

### 01.1 App shell, bilingual sign-in

- **Owner:** B (Expo, theme, i18n, screens) + A (Supabase local, auth, migration).
- **Builds:** one Expo TypeScript project at the repo root, keeping `brand/`, `docs/` and `src/i18n/`. Expo Router, React Native Web, jest-expo, ESLint, Playwright, the npm scripts from the delivery plan. Theme tokens from `brand/brand.yaml` (palette; Newsreader, Literata, Inter). Language choice before sign-in with the labels "Română" and "English", saved to the account afterwards, never taken from the phone locale. The app runs in Expo Go on an Android phone and on web from the first commit. Supabase Auth email + password with email verification and password recovery; native session in SecureStore, web session through the SDK. `docs/technical/01-database-local-development.md` explains `supabase start`, `db reset`, Edge Functions and fixtures.
- **Tables:** `accounts` (with `locale`), minimal `profiles`.
- **Functions:** `get_session_context() → {accountId, kind, locale}`, `set_locale(locale)`.
- **Acceptance:** `language_persists_and_private_routes_redirect`: choose ro, restart, still ro; signed-out `/manuscripts` redirects to sign-in; at 900px tablet width no primary action is clipped. SQL `locale_is_owner_scoped`: own locale changes; another account's and anonymous updates fail.

### 01.2 Account kinds, author activation, publisher approval

- **Owner:** A (SQL), B (sign-up choice, settings, admin approval screen).
- **Builds:** sign-up chooses the account kind once: person or publisher. A trigger creates `accounts` plus `profiles` or `publishers` from that choice; the kind can never change later. A person can activate the author profile in the same account. A publisher signs up with its own email, fills its profile and waits for approval; until then it sees a pending notice but can still post, comment, share quotes and create events and discoveries (enforced by not checking approval anywhere except manuscript intake). Admin approval screen for publisher requests.
- **Tables:** `profiles` (full), `private_contacts`, `admins`, `publishers`, `genres` (seeded), `publisher_genres`, `blocks`.
- **Functions:** `activate_author()`, `approve_publisher(publisher_id, method)` and `reject_publisher(publisher_id)` (admins only), `can_receive_submissions(publisher_id) → boolean`, `is_blocked(a, b) → boolean` (reused by every later interaction), `set_block(target_id, blocked)`. Session context gains `authorEnabled` and `approvalStatus`.
- **Acceptance:** `roles_are_server_enforced`: a person enables author and keeps the same ID; a publisher account cannot activate author; changing auth metadata after sign-up does not change the kind; an unapproved publisher has `can_receive_submissions = false`; a non-admin cannot approve; nobody can insert into `admins` from the app; block works in both directions.

### 01.3 Works, events log, account lifecycle

- **Owner:** A (SQL), B (create-work and book page shell).
- **Builds:** the shared book/project table and its links; the event log every feature writes to; data export and deletion request.
- **Tables:** `works` (with `pg_trgm` index on `title` and `author_names`), `work_authors`, `work_publishers`, `domain_events`, `account_deletion_requests`.
- **Functions:** `create_work(title, description?, language?, genre_id?) → uuid` (private, owner set, own `work_authors` row confirmed); internal `enqueue_event(kind, subject_id, event_key, recipient_ids, channels)` callable only from other database functions; `request_account_deletion()`; `export_my_data()` (each later module adds its own rows to it).
- **Acceptance:** `private_work_and_contacts_do_not_leak`: another account cannot read a private work or contacts; export contains only the caller's rows; a deletion request ends the caller's sessions and deletes nothing else. `enqueue_event` cannot be called by a client; the same `event_key` twice stores one row.
