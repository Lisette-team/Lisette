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
