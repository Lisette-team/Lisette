# Lisette delivery plan

Stack (approved 2026-10-21): React Native + Expo (Expo Router, React Native Web), TypeScript, Supabase (Postgres, Auth, Storage, Edge Functions, EU region). Android phones and tablets first, authenticated web second, no iOS. Development runs in Expo Go on a real Android phone; a module that Expo Go lacks gets a cloud development build (`eas build --profile development --platform android`), never a local Android SDK.

## Rules for every task

- **Test first.** Write the acceptance test, see it fail for the right reason, implement, run it until it passes. SQL rules are tested with `supabase test db` against real roles, not mocks.
- **Identity comes from the session.** Database functions read the caller from `auth.uid()`; never accept an account ID for "who is acting" from the app.
- **Database owns the rules.** RLS on every table. A change that touches several rows or checks several rules is one `security definer` function in one transaction. The UI never decides permissions.
- **Migrations:** `npx supabase migration new <topic>`, applied while working with `npx supabase migration up`. `npx supabase db reset` deletes local test accounts: run it once before merging, only after asking. A function is created only after the tables it uses exist.
- **IDs** are UUID strings. Types come from generated database types plus the owning feature; do not copy them into other features.
- **Limits** marked "propunere" in the schema page are starting values. Use them; never invent others.
- **Files:** private buckets have no client read access. Manuscripts, beta pages and discovery content go through an authenticated Edge Function with `Cache-Control: no-store`, never long-lived signed URLs.
- **Words:** never say manuscripts are encrypted; downloads cannot be recalled; device authentication is not proof of authorship.
- **Translations:** add keys only inside your feature's group in `src/i18n/ro.json` and `en.json` (the groups exist). Romanian copy is still pending review.
- **Out of scope:** manuscript editor, chat, payments, algorithmic feed, OS push, audio recording.
- **Secrets:** never in `EXPO_PUBLIC_*` variables or in git.

## Working in parallel

- One branch per task, from an up-to-date `main`; merge as soon as the task passes. Rebase on `main` before merging.
- Shared tables (`accounts`, `profiles`, `publishers`, `works`, `contents`, `domain_events`) change only after both people agree.
- A task redefines a shared database function only if the task list below names it under "Touches". Two open tasks never touch the same one.
- `export_my_data()` changes only in 06.2, which adds every table at once. Module tasks leave it alone.
- Schema changelog in `lisette-schema.html`: write the entry under the task ID; whoever merges gives it the next "Versiunea" number.
- Navigation (`(tabs)/_layout.tsx`, `side-nav.tsx`), `src/ui/*`, the `Screen` header and `settings.tsx` get small, separate edits.
- If you need another task's table before it is merged, build on fixtures; the task is done only after the real integration test passes.

## Tasks

Done and merged: 01.1–01.3 accounts, roles, works, events log; 02.1 PDF upload and reader; 02.2 calls, catalogue, submissions; manuscripts screens (stars, main version, deletion); 03.3 posts, reactions, comments, follows; 04.1 library and ISBN scan.

### First: merge the current branch (blocks everything below)

**M0. Merge `task/02-apeluri_catalog_inscrieri`** (02.3 review and withdrawal, 03.1 approvals, quotes, page shares, rich text). Manual checks in Expo Go, recorded in `docs/technical/02-manuscripts-pdf-validation.md`:
- manuscripts: upload a manuscript and a second version; star it; send with and without a main version; delete an unsent version; try to delete a sent one; open Submissions;
- review: Unopened/Opened marker for the publication, the author sees only "opened"; opening does not change status; on hold reads but does not download; selection requires an evaluation; evaluation edits; rejection; withdrawal with its confirmation copy; two independent submissions to two publications;
- sharing: author requests approval, revises and publishes after approval; publication approves or refuses and requests a manuscript quote that the author decides; PDF text and page selection on Android; the earlier published version stays visible during revision;
- phone and tablet widths, both languages.

Then run every command under "Commands", commit, open the PR and merge.

### In parallel, once M0 is merged

None of these depends on another. "Touches" lists what is shared with other tasks.

| Task | Scope | Spec | Touches |
|---|---|---|---|
| 03.2 Profiles and portfolio | S-10–S-13, S-15; profile editing, follow and block buttons | [03](2026-10-17-lisette-03-community.md) | profile tab, catalogue link to S-13 |
| 03.4 Beta-readers | S-58, S-59, `beta_read` gateway purpose | [03](2026-10-17-lisette-03-community.md) | `manuscript-file` gateway |
| 03.5 Reading patterns | consent, excerpt reader S-53, heatmap S-57, motion and noise sensors | [03](2026-10-17-lisette-03-community.md) | `settings.tsx` |
| 04.2 Book page | S-54, S-63 | [04](2026-10-17-lisette-04-library.md) | creates `get_work_connections` |
| 04.3 Reviews and ratings | S-64; place it on the book page once 04.2 is merged | [04](2026-10-17-lisette-04-library.md) | book page (last step) |
| 05.1 Events and map | S-71–S-73, interest and going; check the map provider, keys and terms first | [05](2026-10-17-lisette-05-map.md) | Discover tab |
| 05.3 Ambient reading theme | light sensor, manual override, `docs/testing/devices.md` | [05](2026-10-17-lisette-05-map.md) | reader screens |
| 06.1 Notifications | S-80, bell, email worker to the local mail sink; the event producers already exist; check the email provider before going beyond the sink | [06](2026-10-17-lisette-06-integration.md) | `Screen` header |
| G1 Settings | S-06, S-07: contact details with the phone number (replaces the SQL workaround), data export, account deletion request, blocked accounts; the functions exist | requirements "Publisher administration and account lifecycle", "Blocking" | `settings.tsx` |
| G2 Publication onboarding | pending-approval notice, S-14 publication settings, S-90 admin approval (web, restricted); the functions exist | requirements "Account Roles", "Public Publisher Profile" | – |
| G3 Editor on web | the rich text editor of the composer does not run on web (AC-22) | screens S-51 | `src/features/sharing/` |
| G4 Builds | EAS development profile and release APK installed on phone and tablet | 06.4 | `eas.json`, `app.json` |

### After their dependencies

| Task | Needs | Spec | Touches |
|---|---|---|---|
| 05.2 Discoveries and location unlock | 05.1 | [05](2026-10-17-lisette-05-map.md) | map |
| 05.1b Events on book pages: `get_work_connections` gains events; test `scan_to_event_respects_relationships` | 04.2, 05.1 | [05](2026-10-17-lisette-05-map.md) | `get_work_connections` |
| 06.3 Search | 03.2, 04.2, 05.1 | [06](2026-10-17-lisette-06-integration.md) | Discover tab |
| 06.2 Moderation and account export (together) | 03.4, 04.3, 05.1, 05.2 | [06](2026-10-17-lisette-06-integration.md) | `can_view_content`, `export_my_data` |
| 06.4 Device testing, demo and release (together) | everything | [06](2026-10-17-lisette-06-integration.md) | – |

Sensors: the competition needs at least three working on real devices, plus biometrics. Camera (04.1) works; light (05.3), motion and noise (03.5) and location (05.2) are still to build, so start those early.

## Device and service checks

- Record sensor availability, Android versions and permission outcomes in `docs/testing/devices.md` (created by 05.3).
- Before 05.1 and 06.1: check map provider and email service keys, terms and cost. Use local fixtures and the local mail sink until then.
- Keep the pinned Expo SDK / Node set; do not copy "latest".

## Commands

`npm run typecheck`, `npm run lint`, `npx jest --runInBand`, `npx supabase test db`, `npm run test:gateway`, `npx expo export --platform web` (delete `dist/` afterwards), plus an Android APK built with EAS Build and installed on phone and tablet.

## Not decided: do not build

Post-selection changes to sharing restrictions; history retention and destructive account deletion; heatmap data retention and opt-out deletion; report reasons and appeal flow; notification preferences. Keep the agreed safe default (snapshots kept, deletion only queued) and expose no action for these.

## Acceptance criteria map

Criteria AC-01 to AC-27 are listed in `docs/product/requirements.md`.

| Criteria | Task |
|---|---|
| AC-01–03 language, roles, publisher approval | done (01), G2 |
| AC-04–09, AC-27 PDF versions, submissions, evaluation, access, opened marker | done (02), M0 |
| AC-10–14, AC-16 approvals, visibility, reactions, work links, associations | M0, 03.2 |
| AC-23 reading patterns; AC-24 audiences and beta | 03.5, 03.4 |
| AC-15 library and book connections; AC-25 reviews | 04.2, 04.3, 05.1b |
| AC-17–19 events, unlocks, collection | 05.1, 05.2 |
| AC-20–21 notifications, moderation; AC-26 follower notices | 06.1, 06.2 |
| AC-22 phone, tablet, web, no editor | every UI task, G3, final check 06.4 |
| Search | 06.3 |
