# Visual Identity Brief

> Built from `context.md`, `positioning.md`, `voice.md` and `messaging.md`. This is a **design brief**, not finished artwork: the five base colours, font families and logo artwork (`assets/VariantaLogo1.png`) are approved; production logo files and detailed component treatments remain to be made and tested in the real app. Use case: an Android app (React Native / Expo) and a web extension. The reference brands (Goodreads, Substack, Notion, Are.na) are drafts the user hasn't confirmed.

## 01 — Identity Strategy Statement

Lisette's identity should feel like a well-loved, well-lit reading room: warm paper, deep ink, one rich accent colour, and type that makes reading a pleasure. It is literary without being precious, and modern without looking like a tech product. The visual idea is a shared literary space for writers, readers and publishers. Show their connections through relevant people, stories and settings; layouts and the logo do not need to represent all three literally. Every choice should say "calm, careful, and on your side", and celebrations should be quiet acknowledgements of meaningful completed actions, such as finishing a book or sending a first submission. Use a small illustration or brief confirmation in the brand palette. Avoid hype, streaks, points, rankings, countdowns and interfaces built to pressure people to return.

## 02 — Logo Direction

**Confirmed concept (2026-10-17):** an L-shaped book cover with pages fanning out inside the angle of the L.

**Approved logo (2026-10-18):** `assets/VariantaLogo1.png`. A Burgundy L-shaped cover with a Gold inset outline, a binding band near the top, three four-point star ornaments and four Gold pages fanning out inside the angle. `assets/VariantaLogo2.png` remains an earlier exploration only.

**Status:** artwork approved; production files are pending. The PNG is the design reference, not a production asset: redraw it as a vector, matching the approved palette (Burgundy `#7A2233`, Gold `#C99A4E`) rather than sampling the PNG's colours.

**Approved launch animation (2026-10-24):** `../assets/brand/lisette-splash.mp4`. A flat version of the mark in Paper with Gold binding band and pages on Night burgundy: the L is drawn, the pages fan out, a Gold star appears, then the "Lisette" wordmark. About 3 s, silent, 1080×1920. It plays once when the phone app opens, over a native splash in Night burgundy so the hand-off is invisible, then fades into the app. It does not play on web and is skipped when the device asks for reduced motion. Its flat treatment (no inset outline, one star) is approved for this animation only; it does not replace `assets/VariantaLogo1.png` or settle the dark-mode logo or final wordmark lettering.

**Character:** warm, literary and tactile. The silhouette should suggest both the letter L and a book.

**Production work still to do, not new design decisions:**
- Vector master file faithful to the approved artwork.
- Small-size, monochrome and dark-mode versions and the app-icon treatment. Small sizes may need the stars, binding band or inset outline removed; test actual renders before setting minimum-size rules.
- A Newsreader-based wordmark and symbol lockup, if needed; final lettering is not yet approved.

**What to avoid:**
- Open book icons, quills, pens, feathers and stacks of books (every literary app uses them).
- Hearts and speech bubbles (generic social network).
- Gradients, glows and drop shadows.
- Script or calligraphy lettering, which feels like a wedding invitation or a perfume.
- Anything French-tourist: Eiffel Tower, tricolour, berets.

**3 logo references:**
- **Goodreads:** the lowercase, friendly serif wordmark. Borrow its warmth and readability. Don't copy its brown-and-cream palette too closely.
- **Penguin Books:** a simple, confident mark that works on a spine and at tiny sizes. Borrow its simplicity and the idea of a mark that belongs on books.
- **Substack:** a single bold glyph that works as an app icon, built on a bookmark-like shape. Borrow the discipline of one simple shape carrying the brand.

## 03 — Color Palette

**Approved base palette (2026-10-17):** the five swatches in `assets/ColorPaletteProposition.png` are the source of truth for base colour values. They replace the earlier palette, including Walnut and Cream. The image's references to stars and badges do not override the confirmed gentle-milestone policy. The usage rules below resolve its mixed button-colour suggestions.

| Colour | Hex | Role |
|---|---|---|
| Burgundy (Vișiniu) | `#7A2233` | Brand mark, light-mode primary buttons and key structure |
| Gold (Aur de cotor) | `#C99A4E` | Small accents and decorative details |
| Paper (Hârtie) | `#F6EFE3` | Light backgrounds and reading pages |
| Ink (Cerneală) | `#2E1F1A` | Text, headings and wordmark |
| Night burgundy (Vișiniu nocturn) | `#3A121C` | Dark backgrounds and splash screens |

**Colour personality:** warm, bookish and cosy: wine, bookbinding gold, paper and ink. Do not reintroduce the previous colours as defaults.

**Computed contrast for opaque base colours:**
- Burgundy / Paper: 8.73:1; Ink / Paper: 13.85:1.
- Ink / Gold: 6.19:1; Paper / Night burgundy: 14.32:1; Gold / Night burgundy: 6.40:1.
- Gold / Paper: 2.24:1. Do not use Gold text or essential Gold-only icons/borders on Paper.
- Burgundy / Night burgundy: 1.64:1. Do not use Burgundy text or essential Burgundy-only controls on Night burgundy.
- Normal text requires at least 4.5:1; large text at least 3:1. These base-pair calculations do not validate complete screens, opacity, interaction states or component boundaries. Reference: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

**Initial UI usage rules:**
- Light mode: Paper surfaces, Ink text, Burgundy primary buttons with Paper labels. Secondary actions use Burgundy text or outlines on Paper.
- Dark mode: Night burgundy surfaces, Paper text; Gold primary buttons with Ink labels are a readable starting point. Secondary actions use Paper text or outlines.
- Gold is a small accent, not body text on Paper. Gold-filled accents or buttons use Ink labels; on Paper, add a contrasting boundary when needed to identify a control.
- Use text and icons to identify success, errors and privacy states; colour alone must not carry the meaning.
- Treat the image's 60/30/10 ratio as a loose composition guide, not a screen quota. Paper dominates light mode, Burgundy supplies structure, Gold stays sparse.
- Reading themes start with Paper / Ink for light reading and Night burgundy / Paper for night reading. Additional surface shades and daylight/evening variants remain proposals to test, not approved extra base colours.
- Reading-pattern heatmap (proposal to test): a single-hue scale from Paper to Burgundy in light mode, always paired with text labels. No red/green or alarm colours.
- Avoid pure white, pure black, neon accents, gradients and glows.

## 04 — Typography

**Primary typeface: Newsreader** (Google Fonts). Approved on 2026-10-17, replacing the earlier Fraunces proposal. A quiet, editorial serif chosen for Lisette's literary warmth. Use it for headlines, key moments and wordmark exploration; the final logo remains unapproved.

**Reading typeface: Literata** (free, Google Fonts). Designed for long-form screen reading. Use it for excerpts, chapters and any text people actually read in the app.

**UI typeface: Inter** (free, Google Fonts). A clean, neutral sans for buttons, labels, navigation and data. It gets out of the way of the serifs.

**Type personality:** a literary serif voice with a quiet, modern interface. Bookish warmth for content, plain clarity for controls.

**Usage hierarchy:**
- **Headlines:** Newsreader, medium to semibold, tight but readable line height (about 1.15).
- **Subheads:** Newsreader regular, or Inter semibold for UI sections.
- **Body (reading):** Literata regular, 16–18 sp on mobile, line height about 1.6.
- **Body (UI):** Inter regular, 14–16 sp.
- **Labels and buttons:** Inter medium, sentence case, no all-caps.

**Avoid:** all-caps tech wordmarks, geometric sans for the logo (too startup), script and calligraphy fonts, thin weights below 400 on small mobile text, more than three families.

Approved families: Newsreader for headings, Literata for reading, Inter for controls. Source fonts from their Google Fonts distributions; check platform loading and actual rendering during implementation. Font weights, sizes and line heights above are starting points to test in real screens.

## 05 — Imagery & Photography Style

**Overall aesthetic:** warm, intimate and natural, like reading by a window or at a kitchen table. Real, slightly imperfect, never staged or glossy.

**Subject matter:** hands holding books and phones, margins with pencil notes, shelves in real homes, desks mid-draft, people reading on trains and benches. Writers and readers both appear, ideally in the same frame or in paired shots.

**Color treatment:** natural, softly warm, slightly lifted blacks, gentle grain. Nothing neon or over-saturated. Let Burgundy and Gold appear naturally (a wine-coloured cover, a lamp).

**What to avoid:** laptop-and-coffee flat lays, stock "creative" people laughing at screens, typewriters and quills as props, heavily filtered or AI-glossy images, anything that looks like a generic productivity app.

For the demo and the competition, real photos of the team and testers reading beat stock images.

## 06 — Iconography & Illustration

**Style:** rounded line icons with a consistent stroke, plus an occasional simple filled state (for example a selected tab).

**Weight:** regular, about 1.5–2 px at 24 px size.

**Personality:** functional first, with small touches of warmth (a rounded bookmark, a soft spine on the shelf icon). Not expressive or cartoonish.

**Illustration:** light. Use simple, flat, single-colour shapes in the palette for empty states and onboarding, for example an empty shelf, a manuscript in an envelope, a reader with a book. No faces, so it stays inclusive and easy to produce.

**Custom icons worth drawing:** shelf, manuscript with a lock (privacy), envelope with a status check.

## 07 — Design Principles

**Paper first**
Backgrounds are warm Paper tones, with generous space and no visual clutter. The app should feel like a place to sit and read, not a feed to scroll.

**A shared literary space**
Represent writers, readers and publishers equally across the overall brand, using paired layouts, two-tone moments and shared spaces where they help communicate the connection. Individual screens and audience-specific assets focus on their relevant audience; paired layouts are not required on every screen.

**Reading comes first**
Type, contrast and spacing are tuned for reading before anything decorative. If a style makes text harder to read, it loses.

**Trust is visible**
Privacy and ownership states are clear and quiet: who can see a manuscript, who can open it, what is public. Never hide them or use scary visuals.

## 08 — Brand Expressions

**Language rule:** the tagline examples below are English references. For Romanian assets use the approved tagline, "Unde editurile își găsesc autorii, iar cărțile, cititorii." See `messaging.md` for localized tagline usage.

**App (React Native / Expo):** Paper background, Newsreader headings, Literata for excerpts, Inter for controls. Burgundy for primary actions. Bottom navigation with line icons; the bar and its central "+" button carry the soft v6 shadow (decided 2026-10-28), the one interface exception so far to "no drop shadows". Adaptive reading themes follow the light sensor. App icon: the approved logo (`assets/VariantaLogo1.png`), simplified as needed for small sizes. Construction and background treatment remain to be tested. For Android adaptive icons, keep the mark inside the central safe zone (about 66 dp of the 108 dp canvas).

**Website:** same system, more space for the tagline, "Writers find their way. Readers find their writers." in Newsreader, with a paired hero (writer on one side, reader on the other).

**Google Play assets:** Burgundy feature graphic with the tagline in Paper, and screenshots on Paper backgrounds with short captions in Newsreader.

**Social profiles and posts:** the avatar uses the approved logo. Posts are quote cards in Newsreader on Paper or Burgundy, plus real reading photos. Keep one accent colour per post.

**Presentations / pitch deck (competition):** Paper background, Burgundy headings, one idea per slide, real screenshots and photos of the team and testers. Show working core features; show the reading heatmap only as it actually works in the demo.

**Business cards / stationery:** only if needed. Paper stock, Burgundy logo, Newsreader name, plenty of space.

## Open Items
- Produce vector files from the approved logo (`assets/VariantaLogo1.png`); test small sizes and the Android adaptive icon safe zone.
- Check contrast for every text and button colour pair in the real UI.
- Base palette approved from `assets/ColorPaletteProposition.png`; test component states and dark-mode treatments in real screens.
