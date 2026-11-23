# 04 Book pages and reviews

Read the [delivery plan](2026-10-17-lisette-delivery.md) first. Tables: database design §6 (`works`) and §8, `lisette-schema.html` module "Bibliotecă și recenzii". Requirements: Personal Library and Book Discovery. Done and merged: 04.1 (library, ISBN scan, "Is this the book?"; notes in `docs/technical/04-library-open-library.md`).

### 04.2 Book page connections

- **Builds:** the book/work page (S-54, S-63): confirmed authors and publications on Lisette, permitted excerpts, posts linked to the work, reviews, events (empty until 05.1). Works without ISBN (unpublished projects) included when public.
- **Functions:** `get_work_connections(work_id) → {authors, publishers, events: [], excerpts, posts}`; 05.1 fills `events` with `{id, relation: "book" | "author" | "publisher"}`.
- **Rules:** only confirmed links; when nothing matches reliably, show an empty state, never a guessed profile. Do not imply endorsement.
- **Acceptance:** `work_connections_preserve_visibility`: confirmed links appear; no match gives an empty state; private or followers-only excerpts and private posts are absent; `events` is an empty array.

### 04.3 Reviews and ratings

- **Builds:** one rating (1–5) and one review per person per published book, editable and deletable, shown on the book page with attribution (S-64). No average anywhere, no sorting by rating.
- **Tables:** `ratings`, `reviews`.
- **Functions:** `set_rating(work_id, value | null)`, `upsert_review(work_id, body) → uuid`, `delete_review(work_id)`.
- **Acceptance:** `one_review_per_reader`: a second rating or review updates instead of duplicating; another account cannot edit or delete it; blocked accounts do not see each other's reviews; a deleted review disappears; no function returns an average; an unpublished work cannot be rated or reviewed; a publisher account cannot rate.
