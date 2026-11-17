# 02 Manuscripts screens polish: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. AGENTS.md also requires superpowers:test-driven-development and the `expo` skills (`expo:expo-overview`, `expo:expo-router`, `expo:expo-ui`) for screens.

**Goal:** Turn the single-form Manuscripts tab into the v6 structure: a list of manuscripts with a separate upload screen, a manuscript detail screen, a Submissions tab, stars, a main version per manuscript and deleting what was never sent.

**Architecture:** A private `work_preferences` table and `security definer` functions hold the rules. File removal goes through a new Edge Function, because the `manuscripts` bucket has no client policies. The app splits `manuscripts.tsx` into a list (tab), `/upload` (S-22) and `/manuscript/[workId]` (S-21), and extends the existing `/submit/[versionId]` route.

**Tech Stack:** Supabase (Postgres, pgTAP, Storage, Edge Functions on Deno), Expo SDK 58 with Expo Router, TypeScript, Jest (`jest-expo` for screens, `jest.gateway.config.js` against the local stack).

**Spec:** the decisions below (agreed with the user on 2026-11-17); v6 mockups `docs/design/screens/s-20-s-28-manuscrise-si-trimiteri.png`, `s-20-manuscrisele-mele-gol.png`, `s-21-detaliu-manuscris-ecran-derulabil.png`, `s-22-incarcare-versiune.png`, `s-22-incarcare-pdf-invalid.png`, `s-22-incarcare-neconfirmata.png`; `docs/product/screens.md` S-20 to S-22; `docs/product/requirements.md` (Manuscript Versions, Protection Policy); brand files listed in AGENTS.md.

## Decisions (user, 2026-11-17)

- The Manuscripts tab has two tabs, **Manuscrisele mele** (default) and **Trimiteri**, as a segmented control under the title.
- A large "Încarcă un manuscris nou" button sits at the top of Manuscrisele mele only. It opens a separate upload screen (S-22).
- Each manuscript is a card: a cover tile with the title's initial, title, version count and last upload date, a star, a "⋯" menu, and one primary button **"Trimite la publicații"** (existing key `manuscripts.send`). Tapping the card opens its detail (S-21).
- The "⋯" menu has: Încarcă o versiune nouă, Redenumește, Șterge.
- **Star:** starred manuscripts come first. The first starred one is shown as the large card (v6 S-20); the rest are compact rows.
- **Main version:** chosen on the detail screen from a version's "⋯" ("Folosește-o la trimiteri"); shown with a gold "Principală" badge. A new upload never changes it.
- **Send with a main version:** goes straight to the calls step with that version. A discreet row at the top reads `Trimiți v3 · 14 oct. · „<label>”` with a small "Schimbă" link; changing it applies to this send only.
- **Send without a main version:** asks which version first, listing only that manuscript's versions. The choice applies to this send only; the main version is set only from the detail screen.
- **Delete:** only what was never sent. A version used by any submission, or a manuscript with any submission, cannot be deleted, because the publication keeps the version it received.

## Calls made in this plan (flagged to the user, change before implementing if wrong)

- Deleting asks for a confirmation only, no device authentication (user, 2026-11-17).
- The upload screen has no rights checkbox; the declaration stays in the send flow, where requirements.md places it. It shows the file card with "Schimbă", the title field (new manuscript only), the optional note, the hash note and "Confirmă încărcarea" with the fingerprint hint. No "Fișierul e un PDF valid" line: validity is known only after the server checks it.
- The Trimiteri tab shows each submission as a row with a status chip. The v6 three-step timeline waits for 02.3, when publications start changing statuses; until then every row reads Trimis.
- Empty states use Semnul: `semn-scrie.svg` for no manuscripts, `semn-ganduri.svg` for no submissions.
- The "⋯" menu uses an `@expo/ui` menu if it runs in Expo Go on SDK 58; otherwise a small bottom sheet built on React Native `Modal`, marked with a `shortcut:` comment.

## Global Constraints

- Tables, columns, types and limits come only from the database design and `lisette-schema.html`. The new `work_preferences` table is recorded in both, with a "Versiunea 14" changelog entry; Claude republishes the artifact (https://claude.ai/artifact/97PXooJ2H2ZaFviA1gUEmr).
- Migrations via `npx supabase migration new <topic>`; `npx supabase db reset` must rebuild cleanly. Functions read the caller from `auth.uid()` only, `set search_path = ''`, granted to `authenticated`.
- `export_my_data()`: add the caller’s `work_preferences` rows because the export lists tables explicitly; redefine it starting from `20261117161951_preserve_all_export_data.sql` and keep every existing key.
- Never say manuscripts are encrypted; never call the hash or device authentication proof of authorship; downloads cannot be recalled. No humour in errors, deletion or privacy copy (`brand/voice.md`).
- Translations only inside existing groups (`manuscripts`, `submit`, `errors`, `nav`) in both `ro.json` and `en.json`; reuse existing keys (`manuscripts.send`, `manuscripts.privacyBanner`, `manuscripts.hashRecord`, `manuscripts.noEditor`, `manuscripts.invalidPdf`, `manuscripts.tooLarge`, `errors.uploadUnknown`).
- Reuse `src/ui` (`Screen`, `Segmented`, `Banner`, `Button`, `ListRow`, `Checkbox`, `TextField`, theme tokens) and `src/features/submissions/submit-steps.tsx` patterns. No new colours outside `src/ui/theme.ts`.
- Every new control has an accessibility label; the star states "Adaugă la favorite" / "Scoate de la favorite".
- Install packages with `npx expo install`; everything must keep running in Expo Go.
- Claude never commits. Each task ends at a checkpoint where the user commits.

## Review Focus

1. **A version is sent while the author deletes it from another device.** The delete fails with `version_sent` and the file stays. Test: Task 1 `delete refuses a version a submission uses` (the function locks the version row before checking).
2. **The file removal fails after the rows are deleted.** The rows are gone and the app shows success; the orphan file is accepted (same as 02.2 materials). Test: Task 2 `rows are deleted before files` (the function deletes rows first, then storage).
3. **The main version is deleted.** `work_preferences.main_version_id` becomes null and Send asks for a version again. Test: Task 1 `deleting the main version clears it`.
4. **Another user's version is set as main.** Rejected with `invalid_version`. Test: Task 1 `main version must belong to the work`.
5. **The call of a submission is later cancelled.** The Trimiteri tab still shows its title and publication. Test: Task 1 `my_submissions shows a cancelled call`.

---

### Task 1: Stars, main version and deletion in the database

**Files:**
- Create: `supabase/migrations/<timestamp>_manuscript_management.sql`
- Test: `supabase/tests/database/manuscript_management.test.sql`
- Modify: `docs/superpowers/specs/2026-10-21-lisette-database-design.md` (`work_preferences` row), `docs/superpowers/specs/lisette-schema.html` (`work_preferences` card, "Versiunea 14" entry)

**Interfaces:**
- `work_preferences`: `work_id uuid primary key references works(id) on delete cascade`, `is_starred boolean not null default false`, `main_version_id uuid null references manuscript_versions(id) on delete set null`, `updated_at timestamptz not null default now()`. Owner-only select; no client writes.
- `set_work_starred(work_id uuid, starred boolean) returns void`. Errors: `not_owner` (42501).
- `set_main_version(work_id uuid, version_id uuid) returns void`. A null `version_id` clears it. Errors: `not_owner`, `invalid_version` (version of another work).
- `rename_work(work_id uuid, title text) returns void`. Errors: `not_owner`; the existing title check raises 23514.
- `delete_manuscript_version(version_id uuid) returns text` (the storage path). Locks the version `for update`. Errors: `not_owner`, `version_sent`.
- `delete_manuscript(work_id uuid) returns text[]` (all version paths). Errors: `not_owner`, `work_sent`, `work_in_use` (any other row still references the work; map `foreign_key_violation`).
- `my_submissions() returns table (id uuid, status submission_status, submitted_at timestamptz, status_changed_at timestamptz, work_title text, version_id uuid, version_label text, call_title text, publisher_name text, publisher_kind publisher_kind)`: the caller's submissions as author, newest first; `security definer`, so cancelled calls still show.

- [x] **Step 1: Write the failing pgTAP test.** Fixtures: author A with work W (versions V1, V2), author B with work X (version Y), approved publisher P with an open call, one submission of V1. Assertions:
  - A stars W; B starring W throws `not_owner`;
  - A sets V2 as main; `main version must belong to the work`: A setting Y on W throws `invalid_version`;
  - `delete refuses a version a submission uses`: deleting V1 throws `version_sent`;
  - `deleting the main version clears it`: deleting V2 returns its path and `W`’s preference `main_version_id` is null;
  - deleting W throws `work_sent`; a second work of A with no submission is deleted with its versions and the function returns their paths;
  - `rename_work` to `''` raises 23514; B renaming W throws `not_owner`;
  - `my_submissions shows a cancelled call`: after `cancel_call`, A's `my_submissions()` still returns the call title and publisher name; B gets 0 rows;
  - direct `update work_preferences set is_starred` as A fails or changes nothing (no update policy).
- [x] **Step 2:** `npx supabase test db`. Expected: FAIL (function `set_work_starred` does not exist).
- [x] **Step 3:** Write the migration. Update both schema documents and add the changelog entry: "Versiunea 14. Tabel nou `work_preferences`, vizibil doar proprietarului: steaua (favorite) și versiunea principală a unui manuscris, folosită implicit la trimitere; se golește dacă versiunea e ștearsă. Se pot șterge doar versiunile și manuscrisele netrimise."
- [x] **Step 4:** `npx supabase db reset && npx supabase test db`. Expected: all files PASS.
- [ ] **Step 5: Checkpoint.** Claude republishes the schema artifact; the user commits.

### Task 2: Delete gateway and client API

**Files:**
- Create: `supabase/functions/manuscript-delete/index.ts`
- Modify: `src/features/manuscripts/api.ts`, `tests/helpers/local-users.ts` (only if `deleteAuthor` needs the new columns cleared)
- Test: `tests/gateway/manuscript_delete.test.ts`

**Interfaces:**
- `POST manuscript-delete` with JSON `{ "versionId": uuid }` or `{ "workId": uuid }` and the caller's JWT. Calls the Task 1 function as the caller, then removes the returned paths from bucket `manuscripts` with the service role. Responses: 200 `{ "deleted": number }`; 403 `not_owner`; 409 `version_sent` / `work_sent` / `work_in_use`; 400 bad body. Reuse `supabase/functions/_shared` (`cors`, `json`, `UUID`).
- `api.ts`:
  - `Work` gains `is_starred: boolean`, `main_version_id: string | null`, and each version gains `sent: boolean` (it has at least one submission, via the `submissions` embed the author can read).
  - `setStarred(workId: string, starred: boolean): Promise<void>`, `setMainVersion(workId: string, versionId: string | null): Promise<void>`, `renameWork(workId: string, title: string): Promise<void>`.
  - `deleteVersion(versionId: string): Promise<void>`, `deleteWork(workId: string): Promise<void>`: throw `Error(code)` with the server code.
  - `type MySubmission` = one `my_submissions` row; `listMySubmissions(): Promise<MySubmission[]>`.

- [x] **Step 1: Write the failing gateway tests:**
  - deleting an unsent version as owner gives 200 and the storage object is gone;
  - `rows are deleted before files`: after a 200, the version row no longer exists even if listing the bucket shows a leftover (assert the row first);
  - a sent version gives 409 `version_sent` and the object stays;
  - another user's version gives 403;
  - `listWorks` returns `sent: true` for the sent version and the new columns.
- [x] **Step 2:** `npm run test:gateway`. Expected: FAIL.
- [x] **Step 3:** Implement the function and the API.
- [x] **Step 4:** `npm run test:gateway`. Expected: PASS. (If functions answer 503: `npx supabase stop && npx supabase start`.)
- [ ] **Step 5: Checkpoint.** The user commits.

### Task 3: Upload screen (S-22)

**Files:**
- Create: `src/app/(app)/upload.tsx` (`?workId=<id>` adds a version; without it, a new manuscript)
- Test: `tests/upload-screen.test.tsx`

**Interfaces:**
- Consumes `createWork`, `uploadVersion`, `confirmPrivateAction` (existing).
- Layout as `s-22-incarcare-versiune.png`, minus the rights checkbox and the "PDF valid" line: back arrow and title ("Manuscris nou" or "Versiune nouă · <work title>"), privacy banner, file card (document icon, file name truncated, size, "Schimbă"; before a pick, a dashed card "Alege PDF-ul"), title field (new manuscript only, 1–200), note field (optional, ≤ 80), hash note, primary "Confirmă încărcarea" pinned at the bottom with the fingerprint hint below.
- Success: `router.replace("/manuscript/<workId>")`. Errors: invalid PDF and too large inline under the file card (`s-22-incarcare-pdf-invalid.png`); unknown outcome as a banner telling the person to check My manuscripts before retrying (`s-22-incarcare-neconfirmata.png`).

- [x] **Step 1: Write the failing tests** (mock the API, the picker and `confirmPrivateAction`):
  - "Confirmă încărcarea" is disabled until a PDF is picked and, for a new manuscript, a title is typed;
  - device-auth cancel uploads nothing;
  - success navigates to `/manuscript/<workId>`;
  - `invalid_pdf` shows `manuscripts.invalidPdf`;
  - with `workId`, no title field is shown and `createWork` is not called.
- [x] **Step 2:** `npx jest tests/upload-screen.test.tsx`. Expected: FAIL.
- [x] **Step 3:** Implement.
- [x] **Step 4:** `npx jest`. Expected: all PASS.
- [ ] **Step 5: Checkpoint.** The user commits.

### Task 4: Manuscripts tab: list, cards and Submissions

**Files:**
- Modify: `src/app/(app)/(tabs)/manuscripts.tsx` (rewrite), `src/i18n/ro.json`, `src/i18n/en.json`
- Create: `src/features/manuscripts/manuscript-card.tsx`, `src/features/manuscripts/action-menu.tsx`, `src/features/manuscripts/submissions-list.tsx`
- Test: `tests/manuscripts-screen.test.tsx`

**Interfaces:**
- `sendHref(work: Work): string`: `/submit/<main_version_id>` when set, else `/submit/choose?workId=<id>`. Exported from `manuscript-card.tsx`.
- `<ActionMenu items={{ label: string; destructive?: boolean; disabled?: boolean; note?: string; onPress(): void }[]} />`: the "⋯" button and its menu; reused by Task 5.
- Order: starred first, then by latest upload, newest first. The first starred work renders as the large card (v6 S-20: cover tile, title, "versiunea N · PDF", privacy note, "Trimite la publicații" as the primary button, "Încarcă o versiune nouă" as the secondary); every other work is a compact row (cover tile, title, "N versiuni · netrimis încă / în N trimiteri", chevron) with the star and "⋯".
- Delete: menu item disabled with the note "Trimis deja. Publicația păstrează versiunea primită." when any version is sent; otherwise confirm ("Ștergi „<title>”? Versiunile și fișierele lor dispar din Lisette. Nu se poate anula.") → `deleteWork`. No device authentication.
- Rename: a small modal with a `TextField` (1–200) → `renameWork`.
- Trimiteri: `listMySubmissions()` rows: publication name and kind, call title, "<work title> · v<n>", date, status chip (Trimis, În evaluare, În așteptare, Selectat de publicație, Respins, Retras; text plus icon, not colour alone).
- Empty states: no manuscripts → Semnul `semn-scrie.svg`, one sentence, and the upload button; no submissions → `semn-ganduri.svg` and one sentence. Copy follows `brand/voice.md`.

- [x] **Step 1: Write the failing tests** (mock the API and `expo-router`):
  - the screen opens on Manuscrisele mele; the upload button pushes `/upload`;
  - a starred work is listed before a newer unstarred one; pressing the star calls `setStarred(id, false)`;
  - Send pushes `/submit/<main>` with a main version and `/submit/choose?workId=<id>` without;
  - Șterge is disabled for a work with a sent version; for an unsent one, cancelling the confirmation calls `deleteWork` 0 times, confirming calls it once, and `confirmPrivateAction` is never called;
  - switching to Trimiteri lists `listMySubmissions` rows with their status labels; with none, the empty state shows.
- [x] **Step 2:** `npx jest tests/manuscripts-screen.test.tsx`. Expected: FAIL.
- [x] **Step 3:** Implement. Copy the two SVGs into `assets/illustrations/` if they are not there (as `library.tsx` does).
- [x] **Step 4:** `npx jest`. Expected: all PASS (update `tests/app-menu.test.tsx` only if the tab title changed).
- [ ] **Step 5: Checkpoint.** The user commits.

### Task 5: Manuscript detail (S-21)

**Files:**
- Create: `src/app/(app)/manuscript/[workId].tsx`
- Test: `tests/manuscript-detail.test.tsx`

**Interfaces:**
- Consumes `listWorks` (or a `getWork(id)` added to `api.ts` if cheaper), `setMainVersion`, `deleteVersion`, `ActionMenu`, `sendHref`.
- Layout as `s-21-detaliu-manuscris-ecran-derulabil.png`, without metadata editing and without the Trimiteri/Distribuire tabs: title, version rows ("v3, 14 oct. 2026", "PDF, 218 pagini, într-o trimitere activă / netrimisă", note), the gold "Principală" badge on the main one, the `manuscripts.noEditor` note, a "Încarcă o versiune nouă" row (→ `/upload?workId=`), and "Trimite la publicații" pinned at the bottom.
- Tapping a version opens `/reader/<versionId>`. Its "⋯": "Folosește-o la trimiteri" (or "Nu mai e principală" on the main one), "Citește", "Șterge" (disabled with the same note when sent; otherwise confirm → `deleteVersion`).

- [x] **Step 1: Write the failing tests:**
  - the main version shows "Principală"; choosing "Folosește-o la trimiteri" on another calls `setMainVersion(workId, thatId)`;
  - Șterge is disabled on a sent version; on an unsent one it calls `deleteVersion` after the confirmation, without device auth;
  - "Încarcă o versiune nouă" pushes `/upload?workId=<id>`.
- [x] **Step 2:** `npx jest tests/manuscript-detail.test.tsx`. Expected: FAIL.
- [x] **Step 3:** Implement.
- [x] **Step 4:** `npx jest`. Expected: all PASS.
- [ ] **Step 5: Checkpoint.** The user commits.

### Task 6: Send flow uses the main version

**Files:**
- Modify: `src/app/(app)/submit/[versionId].tsx`
- Test: extend `tests/submit-flow.test.tsx`

**Interfaces:**
- `/submit/choose?workId=<id>`: the version step lists only that work's versions; picking one moves on. It never changes the main version. Without `workId`, the step behaves as today.
- `/submit/<versionId>`: the calls step starts with one muted row `Trimiți v<n> · <date> · „<label>”` and a small link "Schimbă" that returns to the version step for that version's work; the choice applies to this send only.

- [x] **Step 1: Write the failing tests:**
  - with `workId`, only that work's versions are listed, and picking one never calls `setMainVersion`;
  - from `/submit/<id>`, the row shows the version and "Schimbă" opens the version step;
  - the existing submit-flow tests still pass.
- [x] **Step 2:** `npx jest tests/submit-flow.test.tsx`. Expected: FAIL.
- [x] **Step 3:** Implement.
- [x] **Step 4:** `npx jest`. Expected: all PASS.
- [ ] **Step 5: Checkpoint.** The user commits.

### Task 7: Documents and full verification

**Files:**
- Modify: `docs/product/requirements.md` (Manuscript Versions: stars, main version, deleting only unsent versions and manuscripts, decided 2026-11-17), `docs/product/screens.md` (S-20 two tabs and upload button, S-21 version menu and main version, S-22 as a separate screen without the rights checkbox, S-25 main version and "Schimbă"), `docs/technical/02-manuscripts-pdf-validation.md` (section "Manuscripts screens manual check")

- [x] **Step 1:** Update the documents.
- [x] **Step 2:** Run `npm run typecheck && npm run lint && npx jest --runInBand && npx supabase db reset && npx supabase test db && npm run test:gateway && npx expo export --platform web`. Expected: every command exits 0.
- [ ] **Step 3:** Manual check on web and in Expo Go, recorded in the section above: upload a new manuscript and a second version; star it; set v1 as main and send (no version question); remove the main and send (version question); delete an unsent version; try to delete a sent one; open Trimiteri.
- [ ] **Step 4: Checkpoint.** The user commits and opens the PR.
