# Lisette — product requirements

Organised functional specification for review: `../superpowers/specs/2026-10-17-lisette-functional-design.md`.

Status: approved functional baseline with subsequent decisions incorporated; detailed technical defaults remain subject to plan review. Records approved product decisions; not a final implementation plan or a commitment to deliver every feature in eight weeks.

## Purpose and constraints
- Delivery priority: the Android app is the primary deliverable; web is a secondary extension with the agreed reader, author and publisher scope. Prioritise complete Android flows before equal visual polish or feature parity on web.
- The two-person team expects substantial AI assistance and intermittent work during the eight-week calendar window, not daily full-time development. Treat available work sessions as a planning constraint; do not equate eight calendar weeks with eighty person-days or assume a particular AI productivity multiplier.
- Preserve the agreed product vision. Sequence delivery and identify dependencies before proposing scope reductions; feasibility remains to be assessed against actual availability and integration/testing work.
- Target native platform: Android phones and Android tablets. iOS is outside the current scope. Tablet layouts must be usable at larger widths rather than assuming phone-only screens.
- The web version serves readers, authors and publishers with the main application functions, plus a larger-screen workspace for author manuscript management and publisher submission review. It is not merely a presentation site or a publisher-only dashboard. Exact cross-platform feature coverage and scheduling still need planning; ISBN scanning and location unlocks are Android priorities, not promises of identical browser sensor support.
- Lisette is not a manuscript editor on any platform. Authors upload externally prepared files and manage manuscripts, versions and submissions; publishers read and evaluate submitted copies. Revising manuscript content happens outside Lisette, followed by uploading a new version where needed. Editing titles, descriptions or other metadata is distinct from editing manuscript content.
- Connect writers, readers and publishers through submissions, community, personal collections and literary discovery. All three groups are equally central.
- Two-person team, eight weeks. Assessment reported by the user: CRUD 5 points, sensors 2 points, complexity 3 points. Exact qualification rules still need confirmation.
- Romania first, with Romanian and English from launch. People choose their language explicitly and can change it later; preserve their choice. Interface language is separate from accepted manuscript languages.
- Brand identity, exact approved copy and visual rules remain in `../../brand/`.

## Confirmed Manuscript Versions and Submission Copies
- The first version accepts manuscript uploads in PDF format only. DOCX and other manuscript file formats are outside this initial scope. Validate actual supported file content as well as the filename before accepting an upload.
- Authors maintain their own manuscript collection with multiple versions.
- For each submission, the author selects the manuscript version to send. Different submissions may use different versions, or reuse the same one.
- Authors can preview the selected PDF inside Lisette before submitting, to confirm the correct file/version. The preview is read-only and does not provide manuscript-content editing.
- Each submission retains an immutable copy of its selected version. Metadata edits or newly uploaded manuscript versions do not change an already submitted copy; manuscript content is revised outside Lisette.
- The publisher reviews the version actually submitted to it. Replacing or resubmitting that version requires a separately defined flow; it is not automatic.

## Confirmed Submission Lifecycle and Publisher Contact
- Lisette supports discovery and manuscript selection, not the subsequent editorial or publishing process. After selection, the publisher contacts the author directly and manages editing, contracts and publication through its own processes outside Lisette.
- Submission statuses: Submitted, In review, Maybe, Selected by publisher, Rejected, Withdrawn. Submitted means the app has successfully recorded the submission; In review means the submission is in the publisher's evaluation period, set by the publisher. Selected means the publisher wants to discuss next steps, not that a publishing contract exists.
- Whether the publisher has opened the manuscript is a separate publisher-side marker (Unopened / Opened) in the publisher's own inbox, not a status. Authors see In review only, never whether or when the manuscript was opened (confirmed 2026-10-18). Whether In review is set per submission, in bulk or when a call's period closes is a design choice.
- Authors may withdraw an individual submission while it is Submitted, In review, Maybe (author-facing: On hold / În așteptare) or Selected by publisher. Change its status to Withdrawn and show that status to the recipient publisher. A withdrawn submission cannot be selected by the publisher. Withdrawing one submission does not automatically withdraw submissions to other publishers.
- After withdrawal, revoke the recipient publisher's access to that submission's manuscript and review materials in Lisette, including future authenticated file retrieval. Preserve the submission history and Withdrawn status. Withdrawal does not revoke access granted by a different active submission or affect the author's own manuscript collection.
- Withdrawal from Maybe has the same access-revocation and sharing-restriction effects as withdrawal from Submitted or In review.
- Withdrawing a submission and blocking a publisher are separate actions. Withdrawal alone does not block future collaboration. Publisher blocking is confirmed under Consolidated Cross-Module Decisions: it prevents new submissions but does not withdraw existing ones or independently revoke their access. Do not infer automatic withdrawal of other submissions or an automatic block.
- Explain that Lisette cannot revoke copies the publisher already downloaded outside the app. Do not claim that withdrawal erases those copies.

- In Submitted, In review and Selected by publisher, the authorised recipient publisher may both read the submitted PDF in Lisette and download it. Access remains submission-specific and is revoked or limited when the status changes according to the rules below.
- A publisher may place a submission in Maybe when it wants to keep considering it and possibly contact the author later. This is not a final rejection. While a submission is in Maybe, retain in-app reading access but disable file downloads. Enforce this distinction in backend authorization, not only by hiding the download button. This does not revoke previously downloaded copies or guarantee that readable content cannot be copied. Show the author the status "În așteptare" in Romanian and "On hold" in English, explaining that the publisher is still considering the submission; Maybe is not a hidden internal-only list.
- A final Rejected decision means the publisher no longer wants to consider that submission. Revoke its access to the manuscript and review files, including reading and downloading through Lisette; retain submission history. Access granted by a separate active submission is unaffected. Previously downloaded external copies cannot be revoked.
- From Maybe / On hold, the recipient publisher can move the submission back to In review, select it, or finally reject it. Apply the destination status access and sharing rules; selection still requires a short evaluation. Notify the author in-app and by email for each confirmed change. The author may withdraw while it remains On hold.
- Selected by publisher is not final (confirmed 2026-10-18). The author may still withdraw it, with the same access revocation as any withdrawal. The publisher may move it to Rejected if discussions do not continue, with an optional note and no required evaluation. No other transition leaves Selected. Publisher access stays as for Selected until withdrawal or rejection.
- The detailed post-selection permission-change flow still needs design; do not treat it as already approved.
- Selection by one publisher does not withdraw, close or change the status of submissions to other publishers. Those submissions remain active under their own access and sharing rules. The author decides separately whether to withdraw eligible submissions; selection does not imply exclusivity.
- Publishers communicate their review and selection decisions through the relevant submission status. Revision requests, contract management and editorial workflows are outside the current product scope.
- Before submitting, clearly disclose that the author's contact email and mandatory phone number will be shared with the selected recipient publishers and obtain their agreement. Do not expose those contact details publicly or to publishers that have not received a submission.
- Use the submission contact email and mandatory phone number for the publisher to contact the author directly after selection. Consent to that disclosure does not imply consent to unrelated marketing. Both a contact email and a phone number are required before manuscript submission, so recipient publishers have multiple contact methods. Requiring a phone number does not imply SMS verification; that has not been agreed.
- The community can continue following an author and reading permitted public excerpts before and after selection. Publishers may discover existing reader interest through the author's public presence; no audience scoring or guaranteed readership is implied.

## Confirmed Manuscript Notifications
- Notify the author both in-app and by email when a submission status changes, a publisher adds an evaluation, or a publisher approves or refuses a request to share selected text.
- Use the person's selected Romanian or English interface language for these notifications and transactional emails.
- Notifications describe confirmed events. Avoid duplicate alerts for the same event; if one action changes status and adds an evaluation, they may be presented together.
- In-app notification records and email delivery are required channels. Mobile OS push notifications have not yet been agreed as an additional channel.
- Detailed message content, delivery retry behaviour and notification preferences remain to be designed.
- Followers are notified in-app when an author they follow publishes: a new excerpt visible to them, or a new publication added to the author's portfolio. Beta-readers are notified in-app when an author shares pages with them. Email and OS push for these community notices are not agreed (confirmed 2026-10-18).

## Confirmed Short Publisher Evaluation
- Provide a short qualitative evaluation with prompts for what stood out, what could be improved, and observations for the author. Do not introduce numerical scores or rankings.
- A meaningful short evaluation is required before a publisher can mark a submission Selected by publisher. Enforce this requirement in submission decision validation.
- Evaluation is optional when marking a submission Maybe / On hold or Rejected.
- Evaluation is private to the submitting author and recipient publisher, not public community content.
- Exact field-level requirements, text limits and evaluation editing rules remain to be specified; mandatory evaluation does not imply all three prompts must be filled separately.

## Confirmed Multi-Publisher Submission Flow
- Each publisher configures whether resubmissions are allowed after withdrawal or final rejection. Apply that setting to direct submissions and its calls/competitions, alongside normal route availability and requirements. Show eligibility before sending. A permitted resubmission creates a new independent submission and preserves the previous history; it does not reopen or rewrite the previous record. Default setting and later policy changes remain design decisions.
- Prevent a new submission of the same work to the same publisher while an existing submission is Submitted, In review, Maybe / On hold or Selected by publisher. A different file version does not bypass this work-level duplicate check. Show a clear message linking to the existing submission. This rule also applies across direct and call/competition routes; resubmission after withdrawal or final rejection follows the publisher resubmission setting.
- Authors can select multiple publishers and submit from one flow, starting with a selected manuscript version.
- Collect and validate each recipient's required materials separately. Before confirmation, show the materials, applicable submission requirements and sharing restrictions for each recipient so the author can review and accept them.
- Create independent submissions for the recipients, each retaining its selected manuscript version and its own status, access permissions and accepted restrictions.
- A recipient must be approved and accepting the relevant submission route. Batch submission does not bypass eligibility, missing requirements or author agreement.
- Handle multi-recipient outcomes independently. Preserve successfully recorded submissions when another recipient fails, and show the result for each recipient. Allow retrying only the unsuccessful recipients without duplicating successful submissions. If a result is unknown rather than a confirmed failure, resolve the existing attempt before creating a replacement. Revalidate route availability and requirements when retrying.

## Confirmed Submission Requirements
- Each publisher or submission call can configure which submission materials are required: full manuscript, synopsis, excerpt or sample chapters, literary genre, and a short author introduction.
- Show the applicable requirements before the author submits. Validate required materials before accepting the submission.
- Submission materials are private to the author and selected publisher. Providing a synopsis or sample for review does not publish it or bypass the separate reader-sharing approval policy.
- These fields cover the current agreed scope; arbitrary custom questionnaires are not required.

## Confirmed Sharing Policy
- Full manuscripts are private to the author and the publishers the author selects, except for pages the author explicitly shares with beta-readers. Reader sharing is separate: submitting a manuscript never automatically shares its text or synopsis with readers.
- Authors control reader sharing by default and choose the exact synopsis or excerpt to share.
- Each publisher configures its sharing policy in its account settings. The applicable publisher or competition restrictions must be shown before submission and explicitly accepted by the author.
- MVP publisher settings: author-controlled sharing; synopsis approval only; or synopsis and excerpt approval. These settings identify which text types require approval; they do not automatically publish any text.
- When approval is required, the publisher approves the exact text selected by the author before it becomes visible to readers. Approval of one selection does not approve different or edited text.
- If a manuscript has multiple active submissions, sharing requires approval from every publisher whose accepted restrictions apply to that text type. A publisher with author-controlled sharing does not need to approve it.
- Withdrawing a submission ends the sharing-approval restrictions associated with that submission. It no longer blocks reader sharing; restrictions from other active submissions continue to apply, including another active submission to the same publisher. Withdrawal does not automatically publish any synopsis or excerpt.
- Final rejection also ends the sharing-approval restrictions associated with that submission. Restrictions from other active submissions remain in force. Final rejection does not automatically publish previously private text.
- A Maybe / On hold submission remains active for sharing approvals. Preserve the restrictions explicitly accepted at submission; they end if that submission is withdrawn or finally rejected. Moving to Maybe does not introduce new restrictions.
- Selection by a publisher does not automatically change sharing permissions. The restrictions explicitly accepted for that submission remain applicable in Lisette after selection. Later changes require explicit agreement with the author; selection is not consent to new restrictions. Contract negotiations and editorial agreements remain outside Lisette. The detailed permission-change flow still needs design.



- Reader audiences (confirmed 2026-10-18). An author chooses who sees each shared synopsis or excerpt: everyone signed in to Lisette (public), only the author's followers, or specific beta-readers. The same publisher-approval rules apply to every audience; a narrower audience does not bypass a required approval.
- Beta-readers (confirmed 2026-10-18). An author can invite specific readers as beta-readers for a work and decide how much they receive: selected chapters or a page range from a chosen manuscript version, up to the whole manuscript. Where accepted submission restrictions require approval, the applicable publishers approve that exact selection first, as for an excerpt. Beta-readers read only inside Lisette, with no download, and the author can revoke a beta-reader's access at any time; copies already seen cannot be recalled (confirmed 2026-10-18).
- Publisher previews (confirmed 2026-10-21). A publisher can share quotes or selected fragments as previews and chooses the source in the app: a work confirmed as published by it, or a manuscript submitted to it. Quoting a received manuscript requires the author's approval of the exact text before it becomes visible. Publishers have no other use of submitted manuscript text.
- Publishers can see what is already shared before accepting a submission. New restrictions never silently hide existing shared text.
- Opening a manuscript for review does not introduce new restrictions. Any applicable restrictions must have been disclosed and accepted before submission.
- This is an agreed product policy for implementation, not a claim that approval workflows already exist.

## Confirmed Account Roles and Platform Boundaries
- People start with a reader account and verified email. Those interested in publishing activate an author profile in the same account and retain reader functions.
- Publisher accounts are separate accounts with their own login and email (confirmed 2026-10-21). A publication is never attached to a person's reader/author account, and one account cannot administer several publications. Publisher accounts do not have personal-library, rating, review, beta-reading or reading-pattern functions.
- The first version does not require identity-document verification to activate an author profile. An author profile is a functional role, not a verified identity or certification of authorship.
- Require the submission-rights declaration in the Manuscript Protection Policy before manuscript submission.
- Provide reporting for suspicious accounts or content. Reports may lead to platform moderation; Lisette does not adjudicate copyright ownership or legal disputes.
- Do not promise prevention of all impersonation or manuscript theft. Identity-document checks, plagiarism investigations and authorship certificates are not first-version requirements.

## Confirmed Public Publisher Profile
- Publisher profiles include an introduction, explicitly associated authors and books, open submission calls or competitions, literary events, ordinary posts and location-based literary discoveries.
- Public profile associations are explicit. Submitting a manuscript, moving to Maybe or being selected does not automatically label an author or work as published by that publisher.
- Public sections respect their underlying visibility and publication permissions. Private submissions, contact details and evaluations do not appear on the publisher profile.
- When a publisher adds an existing Lisette author to its published-author list, require confirmation from that author before displaying the association publicly. A pending or declined association must not appear as an established publishing relationship.
- Book-specific association rules, association removal and handling authors who are not on Lisette remain to be defined. Confirmation of an author association does not automatically confirm every claimed book relationship.

## Confirmed Publisher Kinds (2026-10-21)
- A publisher account has one kind: publishing house (editură), literary magazine or publication (revistă / publicație literară), or independent editor (editor independent, a person who receives manuscripts in their own name).
- All kinds use the same publisher profile, settings, calls, sharing policies, review, evaluation, posts, events and discoveries. The kind is shown on the profile and can filter the publisher catalogue; it introduces no separate permissions or workflow.
- Account approval stays manual. An independent editor usually lacks an official publisher email, so approval relies on direct confirmation.
- Approved taglines and the Romanian central promise keep their exact wording.

## Confirmed Publisher Discovery Catalogue
- Provide a searchable publisher catalogue so authors can discover recipients before submitting manuscripts.
- Publisher profiles show an introduction, accepted literary genres and manuscript languages, whether ongoing submissions are open, and currently open calls or competitions.
- Support search and filtering by accepted genre, manuscript language and submission availability. Exact filter UI and search implementation remain design choices.
- Show applicable requirements before submission. Catalogue discovery must not bypass manual publisher approval: unapproved publisher accounts cannot receive manuscripts.
- Accepted manuscript languages are independent of the author's selected interface language.

## Confirmed Publisher Submissions and Events
- Anyone may request a publisher account. The team must manually approve its connection to the publisher before the account can receive manuscripts, including through calls or competitions.
- Check that connection through an official publisher email address or direct confirmation; identity documents are not required. This is platform account approval, not legal certification.
- Before approval, a publisher account can already post, comment, share quotes and create events and discoveries. Only receiving manuscripts, directly or through calls, waits for approval (confirmed 2026-10-21).
- Each publisher has an app setting to enable or disable ongoing direct manuscript submissions.
- Representation (decided 2026-10-21): every intake route is a call. Ongoing submissions are a call without an end date; a publisher may run several calls at once, each with its own requirements, accepted manuscript languages and genres. Whether a publisher accepts submissions is derived from its open calls. Calls and competitions are not separate types; a competition is named as such by the publisher. The genres on a publisher's profile are separate from the genres a call accepts.
- Publishers can separately create time-bound submission calls or competitions with their own requirements and submission periods.
- Disabling ongoing direct submissions does not itself disable a separately open call or competition. Each follows its own published availability.
- Publishers can also create literary events, such as launches and meetings, for the event map. Literary events are distinct from manuscript calls and competitions; creating an event does not automatically open manuscript submissions.
- Any accepted sharing restrictions follow the Confirmed Sharing Policy in this document.

## Confirmed Manuscript Protection Policy
- Before submitting, require an explicit declaration: "I confirm that I wrote this manuscript, or have permission from all rights holders to submit it and share the selected material."
- This records the submitter's declaration; it does not verify authorship or ownership. This is working product copy, not finalized legal terms. Final wording depends on the launch jurisdiction.
- Use the phone's system authentication to confirm uploads and unlock private manuscripts on the author's device: biometrics with a phone PIN/password fallback.
- Device authentication verifies an enrolled device credential, not the writer's identity or authorship. Lisette does not collect or store biometric templates.
- Account authorization and stored-file access controls separately restrict access to the author and selected publishers. The author's local app lock does not prevent authorized publisher access through their own accounts.
- A file hash and upload timestamp record the uploaded version and time; do not describe them as proof of authorship or copyright registration.
- Brand wording: "Protect access to your manuscript." Do not promise that only the author can open it.
- Manuscripts are not encrypted by Lisette in the first version (confirmed 2026-10-18). Protection relies on private storage, account authorization and access controls. Do not describe manuscripts as encrypted.
- These are agreed requirements for implementation, not claims that the protections already exist.

## Confirmed Public Author Profile and Portfolio
- In addition to the personal reader library, author profiles have targeted sections: Work in progress, Recently published, and Inspirations. These are public-profile sections, not replacements for the author's reader library.
- Work in progress presents projects the author explicitly chooses to show and their permitted excerpts; it never exposes private manuscript files, submission history or unapproved text.
- Recently published draws on the author's publication portfolio. Inspirations presents books the author explicitly chooses to share as influences; it does not reveal the rest of the private collection.
- Authors retain the ordinary reader-library features in the same account. Exact Romanian section labels, ordering and the definition of "recent" remain design choices.
- Public author profiles include name or pen name, profile photo, short biography, public posts, excerpts permitted under the sharing policy, and associated literary events.
- Provide a portfolio/publications section for existing published work: books, contributions to newspapers or magazines, and appearances in anthologies or other collective publications.
- Authors can also present links to their blog, website and social media profiles.
- Manuscript files, submission recipients, submission statuses, private publisher evaluations and submission contact details are not exposed by the public author profile. Only the author and authorised recipient publisher can access their respective submission details.
- Portfolio entries describe published work and external references; adding an entry does not automatically upload or publish the full copyrighted text.
- Authors create and manage their own portfolio entries without team approval. Present these as author-provided information, not independently verified claims, and do not add an automatic verification badge.
- Publication entries can include the work title, publication name, year and an optional external link. Exact validation, optionality of remaining fields and catalogue matching remain to be designed.

## Confirmed Community Scope
- Chat and private direct messaging are outside the first-version scope. Public conversation uses comments and replies; publishers contact submitting authors through the agreed private email/phone disclosure.
- Readers, authors and publishers can publish posts, follow accounts, react to posts and reply.
- Ordinary posts may contain text, images, or both. Audio and video posts are outside the first-version scope. Exact image counts, file limits and text limits remain design decisions.
- Ordinary posts are public in the first version; a followers-only post audience is not required. Excerpts may be public or followers-only under the Confirmed Sharing Policy. This does not make manuscripts, submission details, contact data or personal-library contents public by default. Content browsing requires authentication; there are no signed-out public content pages.

- Support resharing public ordinary posts and public excerpts to the feed, either as a simple reshare or with the resharing person's own comment. Preserve attribution and a link to the original source.
- Resharing references the original public content rather than creating an independent copy that bypasses its permissions. Private manuscripts and unapproved excerpts cannot be reshared. Removal or loss of public visibility of the original must be respected by reshare views; exact unavailable-content presentation remains a design choice.

- Authors can separately share excerpts under the Confirmed Sharing Policy; a social post must not bypass required excerpt approvals.
- Readers can react and comment directly on public excerpts, separately from ordinary social posts. The first version supports discussion at excerpt level, not annotations on individual paragraphs. Private manuscript submissions do not become community discussion surfaces.
- Both ordinary posts and public excerpts support the same set of multiple reaction types rather than only a single like. The intended range includes enthusiasm ("love it"), a neutral response ("it was OK") and dislike. Reaction faces were drawn on 2026-11-11 (the bookmark mascot with heart eyes, neutral, and frowning; see `docs/product/screens.md`). Exact names and the final visual treatment are undecided and belong to design; do not treat these working labels as approved brand copy. The shared reaction set applies to both content types.
- Readers can save the parent book/work of a discovered excerpt to their personal collection. This decision does not imply a separate private excerpt-bookmark list.
- The person publishing an excerpt or post explicitly selects its associated book/work. Lisette does not infer or automatically assign that relationship from the text, title or file. Grouping and related-content pages use that explicitly selected relationship. This is separate from identifying a scanned published book by ISBN.
- Provide a book/work page that brings together its permitted public excerpts and explicitly linked public posts, letting readers explore related discussion from the saved work. Include unpublished works as well as published books; an ISBN is not required for an author's unpublished work.
- Related-content views must respect the original content's visibility and manuscript-sharing permissions. Saving a work does not grant access to private or unapproved material.
- Group public excerpts by their parent work on the author profile, so readers can browse the available excerpts from the same story without searching the feed. This grouping exposes only permitted public excerpts, not the private manuscript, submission history or unapproved text.

- The first-version feed shows posts from followed accounts in chronological order. Algorithmic recommendations are outside this initial scope.
- Reporting suspicious accounts or content follows the platform moderation boundaries above.

## Confirmed Personal Library and Book Discovery
- Reader-library shelves: To read ("De citit"), Currently reading ("Citesc acum") and Read ("Citite"). These remain available to author accounts alongside their dedicated author-profile sections.
- Personal libraries are private by default. People can explicitly make selected book/work entries public; adding or scanning a book does not publish it automatically. Public profile collections and related discovery views must honour these per-entry choices.
- The library is a personal book collection connected to the literary community, not a product centred on ratings or review rankings.
- Reviews and ratings (confirmed 2026-10-18 for the first version). Readers can rate a book/work and write a review of it. Each account has at most one rating and one review per book/work, and can edit or delete them. Reviews are public content: they can be reported and follow blocking rules. Ratings use a 1–5 scale, no average rating is shown, and only published books can be rated or reviewed for now (confirmed 2026-10-18).
- Support ISBN camera scanning and manual book entry. Scanning identifies a book; connect it to author and publisher profiles on Lisette when a reliable match exists.
- "Is this the book?" (confirmed 2026-10-21). Before creating a manually added book, show existing Lisette books with a similar title or author and let the person pick one or continue with a new entry. Lisette never merges books automatically.
- Required product behaviour: from a scanned or saved book, show linked authors and publishers present on Lisette and relevant literary events associated with the book, its author or its publisher. This discovery connection is a priority implementation requirement, not an optional extra.
- Distinguish events directly associated with the book from other events involving its author or publisher. Do not imply that all publisher events concern that book.
- Where available, connected profiles also lead to permitted excerpts and shared reading collections. Do not invent a profile, event or relationship when there is no reliable match.
- Readers may discover what followed authors read when those authors choose to share their collection.
- Custom shelves and notes remain to be designed; the three standard reader shelves and private-by-default, per-entry public sharing are agreed; the previously proposed bundle was not approved wholesale.

## Confirmed Map and Location Discoveries
- The literary-event map and location-based literary surprises are important product features, not optional extras. The exact first-release scope still needs planning.
- The map supports discovery of all public literary events listed on Lisette, not only events from followed accounts. Highlight events associated with followed authors or publishers by default and provide a filter for those followed accounts. People can also discover events involving accounts they do not follow.
- Both authors and publishers can create literary events. Events can be associated with participating authors, publishers and relevant books, supporting discovery from a scanned or saved book as well as followed profiles.
- Readers can mark an event Interested ("Mă interesează") or Going ("Particip"). These are expressions of interest or intent, not tickets, confirmed reservations or verified physical attendance.
- Event creators may add an external registration link when needed. Ticketing, payments and reservation management are outside the first-version scope.

- Participants linked by others must confirm before public listing; detailed association management remains to be designed; creating a link must not imply an unconfirmed endorsement.
- Location-based discoveries can exist independently of literary events, at places selected by their creator. Creating or unlocking one does not require an associated event; any event link is optional. Exact publication duration and retention after removal remain to be defined.
- An author or publisher can create a location-based discovery with multiple content variants: text, images, or a combination. A standalone image or special artwork is a valid discovery; text is not required. Examples include excerpts, poems, messages, stories about a place, and exclusive illustrations or artwork.
- The first-version discovery content scope is text and images. Audio and video are not first-version requirements. Submitted-manuscript excerpts still follow the agreed sharing-approval policy; do not automatically apply manuscript-specific approval rules to unrelated original artwork.
- Before unlocking, show discovery markers on the map with the discovery title, creator and a hint. Keep the actual text, images and variant contents hidden until the reader satisfies the unlock condition; previews must not expose the hidden assets.
- A reader unlocks a discovery when physically present at its location. Assign one random variant per reader per discovery and retain that assignment; revisiting does not reroll it or reveal another variant.
- After unlocking, retain the assigned discovery variant in the reader's personal collection. The reader can revisit it from anywhere without another location check. Location is required for the initial unlock, not each later viewing.
- Offline downloads are not yet defined. Stopping new unlocks preserves existing collections; full creator or moderation removal revokes content access in those collections, with an unavailable-content explanation.
- Excerpts in discoveries follow the confirmed sharing policy, including approval of the exact text by all publishers whose accepted restrictions apply.
- Discoveries are optional literary experiences, without points, leaderboards, streaks or pressure to visit.
- Still to define: proximity threshold, lifecycle after expiry and storage retention after removal; full removal revokes access from previously unlocked collections. Unlock is explicit and foreground-only; variant updates affect future unlocks only.
- The app must use at least three phone sensors/capabilities. See "Android sensors and web boundary" for the proposed set; the final qualifying set depends on competition rules and target devices.

## Confirmed Reading Patterns for Authors (heatmap)
- Confirmed for the competition version on 2026-10-18; previously a deferred experiment. Authors see an aggregated reading-pattern view (heatmap) for each of their own public excerpts, showing where readers linger, reread or stop.
- Scope: public excerpts only for now (confirmed 2026-10-18). Private manuscripts, submitted copies, publisher review sessions, followers-only excerpts and beta-reader shares are not tracked.
- By default only the excerpt's author sees its reading patterns. The author may explicitly share the patterns of selected excerpts with chosen publishers, for example alongside a submission (confirmed 2026-10-18). Other readers, public profiles and search never see them.
- Readers explicitly opt in before any reading data is collected; the default is off. They can turn it off later in Settings, which stops future collection.
- Two consent levels, both off by default (confirmed 2026-10-18). Standard: the reader's patterns count only once an excerpt has at least 10 opted-in readers. No threshold: a separate, explicit choice to be included even when few people have read the excerpt; its consent text must say plainly that the author may then be able to tell how that reader read. Below 10 readers, show patterns only from readers who chose the second level, and none if there are none. Never show names, identities or a list of readers, including in patterns shared with publishers.
- Collect only while the reader has the excerpt open in Lisette; no background tracking.
- Signals (confirmed 2026-10-18): reading position and time on each part of the excerpt, rereads and stopping points, plus reading context from the phone's motion sensors (accelerometer/gyroscope) and the ambient noise level from the microphone.
- Microphone use is limited to an on-device noise level. Lisette never records, stores or transmits audio; only a coarse noise level enters the aggregate. Android asks for microphone permission separately; refusing it does not prevent reading or sharing other reading patterns.
- Signals are reading patterns and reading context, not proof of attention, comprehension or writing quality. Sharing patterns with a publisher is not an audience score. No scores, rankings, comparisons between authors or quality labels.
- Still to define: granularity, data retention, whether earlier contributions are deleted when a reader opts out, how patterns behave when excerpt text is edited, exactly what motion and noise context is shown, and web/Android parity (motion and noise context are Android-only).

## Deferred / Maybe Features
- Reader genre preferences on the profile: wanted, but after the core functions work (2026-10-21). Not in the first version.
- Read-aloud with transcription and pace report: dropped (2026-10-18). The microphone is used only for the heatmap's ambient noise level.

## Product Notes (from the original concept, adjusted by confirmed decisions)
- **Pillars**: manuscript hub, community for writers, readers and publishers, personal library, literary map and discoveries.
- **Sensors/capabilities**: see "Android sensors and web boundary" under Consolidated Cross-Module Decisions. In-app manuscript dictation/editing is outside scope.
- **Candidate first-release scope (not a finalized delivery commitment)**: account and profile, manuscript upload with a submitter declaration and device authentication, submission to publishers with status tracker, basic social network, excerpts for public, followers and beta-reader audiences, reviews and ratings, personal library with ISBN scan, author reading-pattern heatmap (confirmed), adaptive reading, literary-event map and location-based discoveries (detailed first-release scope to define).
- **If time allows**: shelf-based recommendations and genre groups. Web submission review is now part of the requested product scope, not automatically an optional extra.
- **Tech** (decided 2026-10-21): React Native with Expo and React Native Web, TypeScript, Supabase (EU region), Open Library for ISBN lookups.
- **Simulated for the demo**: 3–4 fictional publishers with automated replies, test accounts and libraries.

## Confirmed Search Scope
- Provide search across authors, publishers, books/works and literary events, with results separated by category.
- Book/work results may include unpublished projects that their authors explicitly present publicly, not just published ISBN catalogue entries.
- Search must respect visibility and association rules: do not expose private collections, manuscripts, submission details, contact data, unapproved excerpts, followers-only excerpts to non-followers, beta-reader shares or pending author-publisher relationships.
- Exact ranking, advanced filters and search technology remain design choices; algorithmic recommendations are not implied.

## Confirmed Reporting and Moderation
- People can report accounts, posts, comments, public excerpts, literary events and location-based discoveries, selecting a reason and providing an explanation.
- Provide a restricted administration area for the team to review reports and hide content or suspend accounts when appropriate.
- A report alone does not automatically delete content. Moderation decisions are manual in the first version.
- Moderation is a platform operation, not a legal ruling on authorship, copyright or contractual disputes. Existing manuscript access and visibility rules still apply to moderation tooling; report review does not imply unrestricted administrator browsing of private manuscripts.
- Detailed report reasons, suspension effects, restoration and appeal flows remain design questions.

## Consolidated Cross-Module Decisions

### Blocking
- Blocking hides each account's posts from the other and prevents following, comments and reactions between them. This limits interactions inside Lisette, not information already seen or copied.
- Blocking a publisher prevents new submissions to it but does not automatically withdraw existing submissions. Manage withdrawal separately under the agreed eligibility rules.
- Blocking can be reversed. Restoration of previous follows/reactions is not implied and remains a detailed design choice.

### Event participation and cancellation
- Authors or publishers linked by someone else as event participants must confirm before they appear publicly as participants. The creator's own participation does not require a separate invitation.
- Event creators can modify or cancel events. Notify people marked Interested or Going in-app when an event changes or is cancelled; delivery and grouping details remain implementation design.
- Cancelled events retain a clearly marked Cancelled page instead of silently disappearing.

### Discovery unlocks and updates
- Initial discovery unlock requires an explicit button action while sufficiently close to the location. No background location tracking is required. Define proximity thresholds and location-quality handling during detailed design.
- Creators can stop new unlocks while preserving previously assigned variants in readers' personal collections.
- Variant updates affect future unlocks, not previously assigned variants. Keep the assigned content version stable; this is distinct from a later decision to remove content completely.
- Provide a separate full-removal action for creators and authorised moderators. After explicit confirmation for creator removal, revoke access to the removed text/images in existing unlocked collections as well as blocking future unlocks. Show an unavailable-content explanation instead of the removed content. This is distinct from stopping new unlocks, which preserves existing collections. Previously captured or externally saved copies cannot be revoked.

### Community editing and access
- An account may have one reaction per post or excerpt, change it or remove it. Use the same reaction set on both content types.
- People can edit or delete their own ordinary posts and comments. Excerpt editing must still respect the exact-text approval policy; existing approvals do not automatically cover revised text. The pending-revision presentation remains to be designed.
- Application content requires authentication on Android and web. Public means visible to other eligible signed-in accounts under the relevant policies, not anonymous browsing. No signed-out public content pages are planned. Necessary sign-in/recovery screens are not public content browsing.
- Work links (2026-11-11): any account (reader, author or publisher) may link a post to any work that is publicly visible to it, for example a reader posting about a book they finished. A private work can never be linked, not even by its owner, so its title does not leak through a post. The link exists only when the poster picks it.
- Shared content base (2026-11-11, agreed by both streams): posts and excerpts share `contents`, created only through database functions, never by direct client inserts. One visibility rule, `can_view_content`, decides who sees any content; each subtype adds its own condition (posts are always public; excerpts add audience and approval in 03.1). A reshare follows the source's visibility for each viewer, so a followers-only excerpt never reaches a non-follower through a reshare. Deleting a post or comment is a soft delete: comments and reactions on it stay stored but are no longer shown.
- Blocking removes existing follows and reactions between the two accounts; unblocking does not restore them.

### Publisher administration and account lifecycle
- A publisher account has a single administering user in the first version: the account's own login. Multi-user publisher teams are deferred.
- Include password recovery, a request to delete the account and personal-data export. Retention rules for submission history and relationships require a separate design decision; these functions do not promise erasure of copies already downloaded outside Lisette.

### Android sensors and web boundary
- Proposed sensor set (updated 2026-10-18): camera ISBN scanning, location-based discovery unlocks, ambient-light reading adaptation, motion sensors (accelerometer/gyroscope) and microphone noise level for the reading-pattern heatmap. At least three must qualify under the assessment rules and work on the test devices.
- Biometric protection is also included, with the agreed phone PIN/password fallback for manuscript upload confirmation and local private-manuscript unlock. It is additional to the sensor set above, not deferred.
- Web supports library management, map viewing and viewing already unlocked discoveries. ISBN camera scanning and initial discovery unlock are Android-only in the first version. Other agreed web functions, including manuscript management and review, remain in scope.

## Open product questions
- No outstanding approval remains for discovery removal: stopping unlocks preserves existing access; full removal revokes it. Detailed recovery/retention implementation still needs design.
- Detailed association management for books, profiles and events; post-selection sharing-policy changes; submission-history retention and account-deletion effects. Resolve these at the affected feature’s decision gate; they do not block the bilingual shell or PDF compatibility work.
- Final delivery sequence, technology selection and validation on actual Android phones/tablets. Sensor roles and web-only/Android-only boundaries are now agreed.
- Remaining implementation design: file and text limits, validation rules, error states, reaction labels/icons, location thresholds, notification delivery and deletion/editing presentation. These are not all separate product-approval questions.

## Planning boundary
The approved functional baseline supports implementation planning. Record new functional decisions here and keep technical contracts and sequenced tasks in the delivery plans. Resolve remaining questions at the affected feature’s decision gate; do not restart discovery for settled areas. Unanswered questions and technical proposals are not approved product decisions.

## Technical delivery proposal
See `../superpowers/plans/2026-10-17-lisette-delivery.md` and its six linked subsystem plans. React Native with Expo and React Native Web (TypeScript) and Supabase (Postgres, Auth, Storage, Edge Functions) are approved (2026-10-21); the plans are approved for implementation. Database layout: `../superpowers/specs/2026-10-21-lisette-database-design.md`.
