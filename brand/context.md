# Brand Context

> Source: the original Romanian concept document (not kept in this repository), the user's answers and later decisions.
> Items marked **TBD** were not in the source and still need a decision.

## Brand
- **Name**: Lisette
- **Category**: Literary / publishing technology (mobile app with a web extension)
- **Description**: A literary hub for readers, writers and publishers: manuscript submission to publishers in one place, a community where all three post and follow each other, a personal library where you scan, review and rate your books, and a literary map with events and location-based discoveries. It is also where readers support their favorite authors, by following them, beta-reading when invited, reviewing their work and helping it grow.
- **Stage**: Pre-launch, in development. Built as an entry for an app competition, by a team of 2 over about 8 weeks; the delivery plan lists what is built.
- **Website**: N/A

## Market and Languages (confirmed 2026-10-17)
- First market: Romania, with international expansion intended later.
- Romanian and English interfaces are both available from launch. People explicitly choose their language during initial setup and can change it later in settings; remember their selection.
- Present the initial language choice with self-identifying labels: "Română" and "English". Do not silently assign a language from the phone's locale.
- Localize interface copy, onboarding, errors and transactional emails consistently with the selected language. Adapt wording naturally while preserving the same brand personality.
- Interface language is separate from manuscript language. Each publisher or competition declares which manuscript languages it accepts.
- Existing English examples in the brand guides are reference copy, not an English-only launch requirement. Romanian interface wording still needs to be developed and reviewed. Approved Romanian tagline: "Unde editurile își găsesc autorii, iar cărțile, cititorii." The English tagline remains "Writers find their way. Readers find their writers." These are localized brand expressions, not literal translations.

## Audience
- **Core Audiences (approved 2026-10-17)**: Writers, readers and publishers are equally important participants. Debut writers are the first group to recruit, not a higher-priority audience in the brand. Readers discover authors, excerpts and literary events; publishers discover manuscripts, manage submissions and connect with their literary community. Publishers may be simulated in the competition prototype. "Publisher" covers publishing houses, literary magazines and other literary publications, and independent editors (confirmed 2026-10-21); all use the same publisher profile and functions, with the kind shown on the profile. The approved taglines and central promise keep their wording.
- **Key Problem**:
  - Debut writers submit manuscripts by hand to each publisher, in different formats and with no status tracking.
  - Feedback is rare, late, and subjective.
  - Readers have no direct link to publishers or to the authors they follow, and few ways to actually support the authors they love.
  - Writers fear their text being stolen before it is published.
- **Their Language**: TBD. The original concept used terms like manuscript, beta-reader, excerpt, submission, #înscris, #lectură de seară. Real audience phrases still need to be collected.

## Positioning
- **Differentiation**:
  - One place to send a manuscript to several publishers and track its status.
  - Writers, readers, and publishers share one space.
  - Readers are active supporters, not just an audience. They follow authors, read excerpts shared with everyone or with followers, beta-read pages when an author invites them, get notified when a followed author publishes, review and rate books, share quotes, and see what the authors they follow are reading.
  - Authors see opt-in, aggregated reading patterns (heatmap) on their public excerpts and may share them with publishers they choose. There is no audience score.
  - Privacy-first for full manuscripts: kept in private storage (not encrypted), open only to the author, the publishers the author chooses and any pages explicitly shared with readers or invited beta-readers, with protected access and a record of the uploaded version and upload time. These records do not verify authorship.
- **Competitors** (draft, from general knowledge, to verify): Goodreads and StoryGraph (reading community), LibraryThing (cataloguing), Wattpad (writer-reader publishing), Submittable / Duotrope / Query Tracker (submission tracking), Twitter/X and Bluesky (writing community), and email plus manual submissions as the real status quo. The original concept named Twitter and LibraryThing as models.
- **Market Position**: A literary community for three equally central groups: writers, readers and publishers. Debut writers are the first recruitment group.

## Brand Personality
- **Personality Words (approved 2026-10-17)**: Warm, curious, protective, supportive, literary
- **Tone (approved 2026-10-17)**: Calm, thoughtful and conversational, with occasional gentle bookish humour. No jokes in errors, rejection or privacy messages. More serious than playful. Encouraging toward nervous debut writers and appreciative toward readers who back them. Never hype-y. Plain language with a light literary flavour. Playful only in small moments such as finishing a book or sending a first submission. Gentle milestones celebrate completed actions; no streaks, points, rankings, countdowns or guilt about inactivity. Personal reading totals and history are records, not scores.
- **Voice Admires**: Goodreads (reading community), Substack (writer-first), Notion / Are.na (calm interfaces). The user may add their own. (draft, to confirm)

## Values & Mission

**Promisiune centrală (aprobată 2026-10-17):**
> Am creat Lisette deoarece credem cu tărie că poveștile sunt menite să fie auzite. De aceea, Lisette îi aduce pe scriitori mai aproape de editurile care le pot da o șansă și de cititorii care se vor regăsi în paginile lor.

Aceasta este formularea canonică în română. Nu garantează acceptarea unui manuscris sau publicarea. Sloganurile aprobate rămân neschimbate; adaptarea în engleză a promisiunii rămâne de redactat și aprobat.
- **Core Values** (draft, to confirm):
  1. Authors' work is theirs: private storage, consent, and control over what is public.
  2. Transparency: show the latest confirmed submission status and distinguish unknown or unconfirmed states.
  3. Honest feedback: clear, constructive and respectful of the writer.
  4. Readers lift authors up: the people who love books are the ones who help writers grow.
  5. Everyone belongs on the page: writers, readers, and publishers share one space.
- **Mission wording**: use the approved Romanian central promise above. An English adaptation is pending approval.

## Goals
- **Original competition planning assumption (to reconfirm before scheduling)**: Deliver a working MVP and demo for the app competition within about 8 weeks, showing the manuscript hub, the community, the personal library, the literary map with location discoveries and the reading-pattern heatmap. Longer-term business goals are TBD.
- **Key Metrics** (demo): manuscripts submitted end to end, test books scanned. Post-competition metrics are TBD.
- **Decision**: "Supporting authors" is social only for now (follow, beta-read, share, review, rate, recommend). No financial option (tips, subscriptions, pre-orders) at this stage. Messaging should not promise or imply paying authors. Revisit after the competition.

## Product requirements
Detailed functional decisions have moved to `../docs/product/requirements.md`: accounts, publisher approval, manuscript submissions and sharing, protection, community, library, event map, sensors and deferred features. Read that document for UI and backend requirements. This brand context is not the implementation plan.
