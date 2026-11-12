# 04 Personal library and book pages

Owner: Person B. Read the [delivery plan](2026-10-17-lisette-delivery.md) rules first. Tables: database design §6 (`works`) and §8, `lisette-schema.html` module "Bibliotecă și recenzii". Requirements: Personal Library and Book Discovery.

### 04.1 Library, ISBN scan, "Is this the book?"

- **Needs:** 01.3.
- **Builds:** shelves To read / Currently reading / Read, private by default with a per-book public switch and an Inspiration mark for authors. ISBN scan with `expo-camera` on Android (checksum check, ignore duplicate callbacks); manual entry on every platform, and when the camera is denied. ISBN lookup through a small Edge Function calling Open Library (check current API terms first; timeout and "unavailable" fallback), cached in `works`. Manual add first shows existing books with a similar title or author ("Is this the book?"); the person picks one or adds a new book. Nothing is merged automatically.
- **Tables:** `library_entries`.
- **Functions:** `save_book(work_id, shelf)`, `set_entry_public(work_id, public)`, `set_inspiration(work_id, is_on)`, `remove_book(work_id)`, `lookup_isbn(isbn) → work | null`, `find_similar_works(title, author?) → works[]`, `create_catalogue_work(title, authors, isbn?) → uuid`.
- **Acceptance:** `library_is_private_and_scans_recover`: a new entry is private; a denied camera opens manual entry; scanning the same book again updates the same entry; an unknown ISBN offers manual add without inventing a title. `similar_books_never_merge`: a near-identical title is suggested; choosing "new book" creates a second work; nothing is merged. Removing an entry never deletes the work. After merge, rerun 03.2's Inspirations test with real rows.

### 04.2 Book page connections

- **Needs:** 04.1 and 03.3.
- **Builds:** the book/work page: confirmed authors and publications on Lisette, permitted excerpts, posts linked to the work, reviews, events (empty until 05.1). Works without ISBN (unpublished projects) included when public.
- **Functions:** `get_work_connections(work_id) → {authors, publishers, events: [], excerpts, posts}`; 05.1 fills `events` with `{id, relation: "book" | "author" | "publisher"}`.
- **Rules:** only confirmed links; when nothing matches reliably, show an empty state, never a guessed profile. Do not imply endorsement.
- **Acceptance:** `work_connections_preserve_visibility`: confirmed links appear; no match gives an empty state; private or followers-only excerpts and private posts are absent; `events` is an empty array.

### 04.3 Reviews and ratings

- **Needs:** 04.2.
- **Builds:** one rating (1–5) and one review per person per published book, editable and deletable, shown on the book page with attribution. No average anywhere, no sorting by rating.
- **Tables:** `ratings`, `reviews`.
- **Functions:** `set_rating(work_id, value | null)`, `upsert_review(work_id, body) → uuid`, `delete_review(work_id)`.
- **Acceptance:** `one_review_per_reader`: a second rating or review updates instead of duplicating; another account cannot edit or delete it; blocked accounts do not see each other's reviews; a deleted review disappears; no function returns an average; an unpublished work cannot be rated or reviewed; a publisher account cannot rate.
