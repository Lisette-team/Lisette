# 04.1 ISBN lookup with Open Library

## Terms checked on 2026-11-12

Sources: https://openlibrary.org/developers/api and https://openlibrary.org/dev/docs/api/books.

- **Rate limit:** 1 request per second without identification; 3 per second when the User-Agent names the application and gives a contact email or phone. Breaking the limits can lead to blocking.
- **User-Agent:** "regular or frequent use" (several calls a minute) should send `User-Agent: AppName (contact@example.org)`. Lisette sends the generic `Lisette/1.0 (literary app prototype)`, with no personal details. So it stays at 1 request per second, which is enough for people scanning one book at a time.
- **Use:** the APIs are not a bulk data backend. Requests should be made for real people, and answers cached. Lisette asks once per ISBN that is not yet cached and stores the answer in `works`. It never harvests in bulk.
- **Attribution:** no explicit attribution is required. Open Library asks apps to register their use case through a form on the developers page.
- **Endpoint:** the Legacy Books API (`/api/books`) "may be phased out" and the Book Search API is recommended. Lisette uses `search.json?isbn=…&fields=key,title,author_name,editions,editions.key,editions.title,editions.publisher&limit=1`. The edition that has the ISBN gives the title, publisher and `external_id` (an edition key such as `OL7353617M`); the work gives the author names.

## Open questions for the team

1. Should the app identify itself with a team contact address, for the 3 requests per second limit? It needs a shared, non-personal mailbox. Until then the generic User-Agent stays.
2. Should Lisette be registered through Open Library's use-case form before the demo?

## How it works

- `supabase/functions/isbn-lookup` takes `POST {isbn}`. It requires a signed-in caller and a valid ISBN-13 (400 otherwise). The app turns ISBN-10 into ISBN-13 first.
- It first reads the cache through `lookup_isbn` as the caller. On a miss it asks Open Library, with a 5 s timeout, and caches a found book with the service-role-only `cache_isbn_work`. Catalogue books are public and published, with no owner.
- The answer is `found` (with the book), `not_found` or `unavailable` (timeout, network or server error). `not_found` and `unavailable` create nothing. The app then opens manual add with the ISBN filled in and an empty title.
- `OPEN_LIBRARY_URL` can point the function at a stand-in server. It is not set normally.
- Tests never call the live API. The parser and client are tested with recorded answers in `tests/fixtures/open-library-search-*.json`, which were recorded once by hand on 2026-11-12, and with fake fetches (timeout, 503, network down). The gateway test only uses cached ISBNs and refused requests.

## Typed ISBNs on manual add (rounds 1 and 3, 2026-11-12 and 2026-11-13)

- Only the server sets the ISBN of a manual book. `create_catalogue_work(title, authors)` takes no ISBN, the service-role-only `attach_isbn` is the one write path, and no client function that takes an ISBN can write it. A pgTAP test checks this through `pg_proc` and a direct update.
- A valid ISBN typed on manual add, or filled in after a scan, is first looked up as a scan is. `found`: the "Is this the book?" sheet offers that book. If the person still chooses "No, it's a new book", the new book is created without the ISBN, and the library says it already belongs to the book offered.
- Creating a book with an ISBN goes through `isbn-lookup` with `{isbn, title, authors, create: true}`. The function checks the cache and Open Library again:
  - `found`: returns the book, and the app offers it.
  - `not_found`: creates the manual book as the caller, then attaches the ISBN with `attach_isbn`.
  - `unavailable`, or any conflict on the ISBN (including a private work the caller cannot see): creates the book without the ISBN.

  The last two give the same answer, `{status: "created", workId, isbnKept: false}`, so the response never reveals that a private work holds the ISBN.
- `cache_isbn_work` returns null when the row holding the ISBN is not public. The lookup then answers `unavailable`.
- An ISMN (9790…, printed music) is not accepted as an ISBN by the app or the Edge Function. The database's `is_valid_isbn13` (01.3, shared `works`) still accepts it; changing it needs both streams to agree.
- Gateway test seam: the headers `x-lisette-open-library-url` and `x-lisette-service-key` point the function at a stub Open Library. They take effect only when the key equals the service role key, which only the server and local test setups hold. `tests/gateway/isbn_create.test.ts` uses them with a stub served from the test process (`host.docker.internal`).

## Known gaps

- There is no per-user throttle on `isbn-lookup` or `create_catalogue_work`. A signed-in account could send many lookups, which share Lisette's Open Library limit, or create many catalogue books.
