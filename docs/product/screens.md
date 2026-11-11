# Lisette — screen specifications

Status: **proposal for review.** Derives screens and their appearance from `requirements.md` and the functional design spec (`../superpowers/specs/2026-10-17-lisette-functional-design.md`), and applies `../../brand/identity.md` and `voice.md`. Nothing here is an approved navigation layout, final component design or committed delivery scope. Functional decisions stay in `requirements.md`; brand decisions stay in `brand/`. Where a screen depends on an unresolved question, it is marked **Open**.

## 1. Global rules (apply to every screen)

**Visual**
- Light mode: Paper `#F6EFE3` surfaces, Ink `#2E1F1A` text, Burgundy `#7A2233` primary buttons with Paper labels. Dark mode: Night burgundy `#3A121C` surfaces, Paper text, Gold `#C99A4E` primary buttons with Ink labels.
- Gold is a small accent only; never Gold text or Gold-only icons/borders on Paper. Never Burgundy text or Burgundy-only controls on Night burgundy.
- Type: Newsreader for headings, Literata for anything people read (excerpts, manuscripts, bios), Inter for controls, labels, navigation and data. Sentence case, no all-caps.
- Rounded line icons, about 1.5–2 px at 24 px. Empty states use a flat single-colour illustration in the palette, no faces.
- No gradients, glows, drop shadows, pure white or pure black.
- Status, privacy and error states always pair colour with text and an icon.

**Behaviour and copy**
- Every string exists in Romanian and English; language is chosen explicitly and changed in Settings. Manuscript language is separate from interface language.
- No streaks, points, rankings, countdowns, inactivity guilt or "don't miss out" copy. Milestones are one quiet confirmation after a completed action.
- No humour on error, rejection or privacy screens. At most one exclamation mark per screen.
- Never say or imply paying authors, getting published, or that manuscripts are safe from copying. State only confirmed save/upload/send status; if unknown, say so and point to My manuscripts or submission status.
- Say "writers, readers, publishers", not "users" or "creators". The app is "Lisette".
- Privacy cues (who can see this) appear wherever content is shared: a lock icon plus a plain sentence.
- Reaction labels/icons are **Open**; use placeholders, not working labels as copy.

**Layout**
- Android phone first; tablets get list/detail (two-pane) layouts; web gets a wider workspace for manuscript management and publisher review (section 5).
- Minimum 48 dp touch targets, Literata 16–18 sp with ~1.6 line height for reading.
- Content requires sign-in everywhere; there are no signed-out content pages.

## 2. Navigation

**Reader and writer menu (decided 2026-10-28).** A bottom bar on Android phones and tablets, laid out as in the v6 screens: four entries around a central round "+" button.

| Reader | Writer (after adding the writer profile) |
|---|---|
| Home | Home |
| Discover | Discover |
| + | + |
| Library | Library |
| Profile | Manuscripts; Profile opens from a button at the top right of each tab screen |

- The writer profile is added from Profile (S-05). Until then Manuscripts is not in the menu.
- Screens not built yet show a "Coming soon" placeholder. The "+" opens one too until its actions are defined.
- The bar has a rounded top and the soft v6 `Umbră/plutitor` shadow; the selected entry is Burgundy with small Gold sparkles.
- The Notifications bell in the top bar comes with notifications (06.1).

**Still proposed.** Publisher menu: Home, Submissions (inbox), Discover, Calls and events, Profile. A web sidebar. Administration is a separate restricted web area, not part of the app navigation.

## 3. Screen catalogue

Each entry: purpose · key elements · states and rules · platform. "A" = Android phone/tablet, "W" = web.

### 3.1 Access and settings

| ID | Screen | Content and appearance | Platform |
|---|---|---|---|
| S-01 | Language selection | First screen. Two equal buttons labelled "Română" and "English". No default from phone locale. Lisette mark + approved tagline in the chosen language afterwards. | A, W |
| S-02 | Register / sign in | Email + password, "Forgot password". Burgundy primary button. Short promise line, no hype. | A, W |
| S-03 | Verify email | Confirmed-state wording only ("We sent a link to …"), resend, change email. | A, W |
| S-04 | Password recovery | Request and set-new-password steps. | A, W |
| S-05 | Role choice / activation | Starts as reader. Card "Become a writer" explains: author profile is a role, no identity documents, not a certification of authorship. Publisher: "Request a publisher account" explains manual approval via official email. | A, W |
| S-06 | Settings | Language, appearance (light/dark/auto), reading theme, manuscript app lock (biometrics with phone PIN fallback), share reading patterns with authors (opt-in, off by default, two levels: standard, counted only with 10+ readers, or also when few people read; separate switch for the microphone noise level, which never records audio), blocked accounts, data export, account deletion request, notification preferences (**Open**). | A, W |
| S-07 | Blocked accounts | List with unblock. Note that unblocking does not restore earlier follows or reactions. | A, W |

### 3.2 Profiles

| ID | Screen | Content and appearance | Platform |
|---|---|---|---|
| S-10 | Reader profile | Name, photo, bio, follow button, public posts, selected public library entries only. | A, W |
| S-11 | Author profile | Name/pen name, photo, bio, links (blog, site, social). Sections: Work in progress, Recently published, Inspirations (labels/order **Open**), excerpts grouped by work, portfolio, posts, events. Portfolio items carry "Added by the author" and no verification badge. Never shows manuscripts, recipients, statuses, contacts or evaluations. | A, W |
| S-12 | Portfolio editor | Add/edit entries: title, publication name, year, optional external link; kinds: book, newspaper/magazine, anthology. | A, W |
| S-13 | Publisher profile | Introduction, accepted genres and manuscript languages, "Open to submissions" indicator, open calls, confirmed associated authors/books, events, posts, discoveries. Pending associations are not shown. Primary action "Submit a manuscript" (disabled with reason if unavailable or blocked). | A, W |
| S-14 | Publisher settings | Ongoing submissions on/off, genres, languages, resubmission policy, sharing policy (author-controlled / synopsis approval / synopsis and excerpt approval), required materials, author associations. Policy default is **Open**. | W (A read-only view **Open**) |
| S-15 | Association request | Author sees a publisher's request to list them as a published author; confirm or decline. Explains it is public only after confirming. | A, W |

### 3.3 Manuscripts (author)

| ID | Screen | Content and appearance | Platform |
|---|---|---|---|
| S-20 | My manuscripts | List of works with version count and active submissions. Lock icon + "Private. Only you and the publishers you choose can open it." Empty state: manuscript-in-envelope illustration. Biometric unlock before first open per session. | A, W |
| S-21 | Manuscript detail | Metadata (title, description, language, genre — editable), version list, submissions list, sharing actions. No content editor anywhere. | A, W |
| S-22 | Upload version | PDF only; file picker, validation of real content (not just filename), rights declaration text, device authentication to confirm. Errors distinguish "not a valid PDF" from "upload couldn't be confirmed — check My manuscripts before retrying". Records version and upload time; never described as proof of authorship. | A, W |
| S-23 | PDF preview | Read-only PDF viewer (Literata-neutral, PDF as-is), version label, "This is the version you are sending". | A, W |
| S-24 | Publisher catalogue | Search + filters (genre, manuscript language, submission availability). Result cards: name, genres, languages, Open/Closed, open calls. Unapproved publishers never listed. Multi-select to send to several. | A, W |
| S-25 | Submission composer | Steps: 1 pick version → 2 pick recipients → 3 per-recipient materials (full manuscript, synopsis, sample, genre, author intro, as each requires) → 4 review. Eligibility shown before sending (closed, blocked, duplicate active submission with link, resubmission not allowed). | A, W |
| S-26 | Submission review and consent | Per recipient: materials, sharing restrictions to accept. Disclosure that contact email and mandatory phone number go to the recipients. Rights declaration checkbox (working copy from requirements). Primary button disabled until everything is complete, with the missing item named. Biometric confirmation. | A, W |
| S-27 | Submission result | Per-recipient outcome list: Sent / Failed / Unknown. Retry only failed recipients; Unknown must be checked before retrying. First-submission quiet confirmation (small illustration, one sentence). | A, W |
| S-28 | Submissions tracker | All submissions with status chip per recipient. | A, W |
| S-29 | Submission detail (author) | Status timeline (In review never shows whether the publisher opened the manuscript), submitted version and materials (immutable), publisher evaluation when present (private), accepted restrictions, "Withdraw" while Submitted / In review / On hold with confirmation that explains downloaded copies cannot be recalled. Selected shows contact-outside-Lisette note. Withdraw is also available from Selected. | A, W |
| S-30 | Sharing request | Author chooses exact synopsis/excerpt text and its audience (everyone, followers, beta-readers); shows which publishers must approve, per-publisher state (waiting / approved / refused), nothing visible to readers until all required approvals cover that exact text. Editing text resets approval. | A, W |

Status chips (text + icon + colour, never colour alone; labels follow the spec): Submitted, In review, On hold / În așteptare (with "The publisher is still considering it"), Selected by publisher (not "Accepted"; no contract wording), Rejected, Withdrawn.

### 3.4 Publisher workspace

| ID | Screen | Content and appearance | Platform |
|---|---|---|---|
| S-40 | Submissions inbox | Filter by status, call, genre. Each row shows a publisher-only Unopened/Opened marker; bulk "Move to in review". Dense list, efficient tone. | W primary, A |
| S-41 | Submission reader | Two-pane on tablet/web: PDF reader + materials/author details panel. Download button visible in Submitted, In review, Selected; absent in On hold with note "Download is turned off while on hold". Access removed screen for Rejected/Withdrawn explains why. | W primary, A |
| S-42 | Decision and evaluation | Actions: In review, On hold, Select, Reject. Short qualitative form: what stood out, what could be improved, notes for the author; no scores. Select requires meaningful content; On hold and Reject optional. | W, A |
| S-43 | Calls | Create/edit/close a time-bound call or competition with period and requirements. | W |
| S-44 | Sharing requests (publisher) | Exact text to approve or refuse, with the submission it applies to. | W, A |

### 3.5 Community

| ID | Screen | Content and appearance | Platform |
|---|---|---|---|
| S-50 | Home feed | Chronological posts of followed accounts, no recommendations. Paper background, generous spacing. Empty state suggests finding authors and publishers. | A, W |
| S-51 | Post composer | Text and up to N images (limit **Open**), optional explicit "Related book/work" picker. Posting a manuscript excerpt is routed to S-30. | A, W |
| S-52 | Post detail | Post, comments and replies, one reaction per person (set **Open**), reshare (plain or with comment), report, edit/delete own. | A, W |
| S-53 | Excerpt reader | Literata, reading theme follows ambient light on Android, parent work, author, reactions and comments at excerpt level, "Save book to my library". First open shows a one-time choice to share reading patterns with the author (off unless the reader says yes, changeable in Settings). Pending-revision state **Open**. | A, W |
| S-54 | Work page | Title, author, status (published / unpublished project), permitted excerpts, linked public posts. Never exposes private manuscript. | A, W |
| S-55 | Reshare view | Attribution + link to source; "No longer available" placeholder when source visibility is lost (wording **Open**). | A, W |
| S-58 | Beta-readers (author) | Per work: invite readers, choose version and chapters or page range, see invite state, revoke access. Shows required publisher approvals as in S-30. | A, W |
| S-59 | Beta-read reader | Read-only pages granted to this reader, in Literata-neutral PDF view; no download; "Shared with you by …" and which pages. | A, W |
| S-57 | Reading patterns (author) | Per public excerpt: the excerpt text with a single-hue Paper-to-Burgundy shading where readers lingered, reread or stopped, with text labels and legend. Line "Based on N readers who chose to share reading patterns". Below the threshold: no shading, a plain note that patterns appear once enough readers share them. Reading context (still/moving, quiet/loud) as coarse proportions. Action "Share with a publisher" with a list of current shares. No individual readers, scores or comparisons; "Patterns, not a measure of quality." Below 10 readers, only readers who chose the no-threshold level are included. | A, W |
| S-56 | Report sheet | Target, reason, explanation, confirmation that it will be reviewed manually; no promise of removal. | A, W |

### 3.6 Library

| ID | Screen | Content and appearance | Platform |
|---|---|---|---|
| S-60 | Library | Shelves: To read, Currently reading, Read. Private by default with a lock indicator; per-entry public toggle. Totals are shown as records, not scores. Empty shelf illustration. | A, W |
| S-61 | ISBN scanner | Camera viewfinder, manual entry link. Failure: "We couldn't scan that barcode. Try again, or add the book by hand." | A only |
| S-62 | Manual add | Title, author, optional ISBN, shelf. Before saving, "Is this the book?": list existing books with a similar title/author to pick from, or "No, add a new book". | A, W |
| S-64 | Review and rating | Rating control (1–5) and review text; edit/delete own. No average shown. Published books only. | A, W |
| S-63 | Book detail | Cover, shelf, per-entry visibility, linked authors/publishers on Lisette (only reliable matches), events about this book separated from other events by the same author or publisher. Reading adaptation toggle. | A, W |

### 3.7 Discover, map and discoveries

| ID | Screen | Content and appearance | Platform |
|---|---|---|---|
| S-70 | Search | Results separated by category: authors, publishers, books/works, events. Respects visibility. | A, W |
| S-71 | Events map | Map with all public events; followed accounts highlighted, "Followed" filter, list toggle. Discovery markers show title, creator, hint only. Cancelled events marked. | A, W (view) |
| S-72 | Event detail | Date, place, creator, confirmed participants, linked books, external registration link, Interested / Going (intent, not tickets), Cancelled banner when applicable. | A, W |
| S-73 | Event editor | Details, place, linked participants (they must confirm), books, optional link, cancel with notification note. | A, W |
| S-74 | Discovery preview | Hint, creator, place; hidden content stays hidden. "Unlock here" button active only near the place, foreground only; outside range explains why without pressure. | A (unlock), W (view only) |
| S-75 | Discovery creator | Place, title, hint, text/image variants (art without text allowed), stop new unlocks, full removal with explicit confirmation. Excerpts from submitted manuscripts route through sharing approval. | A, W |
| S-76 | Discovery collection and detail | The reader's unlocked discoveries; fixed assigned variant, viewable from anywhere. Removed content shows an unavailable explanation. No points or completion counts. | A, W |

### 3.8 Notifications and administration

| ID | Screen | Content and appearance | Platform |
|---|---|---|---|
| S-80 | Notifications | In-app inbox of confirmed events: status changes, evaluations, sharing decisions, event changes. Each links to context; one item per decision. Emails mirror manuscript notices. In-app only: followed author published, beta-reader invitation. | A, W |
| S-90 | Admin: publisher requests | Verification via official email/direct confirmation; approve or decline. | W (restricted) |
| S-91 | Admin: reports | Queue and detail; hide content or suspend account manually; no private manuscript browsing. | W (restricted) |

## 4. Core flows to prototype first in Figma

These carry the competition story; design them end-to-end before the rest.
1. First run → language → register → verify → author activation.
2. Upload PDF → preview → choose publishers → consent → per-recipient result → track status.
3. Publisher: inbox → read → On hold → select with evaluation → author sees notification.
4. Scan ISBN → book detail with linked profiles and events.
5. Map → discovery preview → unlock → collection.
6. Author shares an excerpt → publisher approval → public excerpt reader.

## 5. Platform adaptation

- **Android phone:** single column, bottom navigation, sheets for confirmation and reporting.
- **Android tablet:** the same bottom bar as phones (decided 2026-10-28). List/detail for inbox, manuscripts and notifications is still proposed; nothing tablet-specific is built yet.
- **Web:** not built yet. Proposed: sidebar; wide workspace for manuscript management and publisher review (S-20 to S-30, S-40 to S-44); map viewing and unlocked discoveries only; no ISBN scan or initial unlock.

## 6. Open items affecting screens

Reaction set and icons; reading-pattern retention and opt-out deletion (S-57); post/image/text limits; notification preferences; proximity threshold and out-of-range wording; Selected-submission withdrawal and post-selection policy changes (S-29); author/publisher section label wording and ordering; publisher settings on Android (S-14); unavailable-content wording; reviewed Romanian interface copy; logo production files; English central promise.

## 7. Figma mapping

Use the section IDs (S-01 …) as Figma frame names. Compare the current file against this list and record any screen that exists, is missing or contradicts a rule above. No comparison has been made yet.
