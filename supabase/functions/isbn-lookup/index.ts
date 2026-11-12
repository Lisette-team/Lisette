// ISBN lookup for the scanner and manual add. Request: POST {isbn} (a valid ISBN-13).
// Answer: {status: "found", work} | {status: "not_found"} | {status: "unavailable"}.
// The cache in `works` is read as the caller; on a miss, Open Library is asked once and its answer
// cached with the service role. An unknown ISBN creates nothing, so no title is ever invented.
import { admin, caller, cors, json } from "../_shared/caller.ts";
import { isIsbn13, lookupOpenLibrary, OPEN_LIBRARY_URL } from "../_shared/open-library.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const who = await caller(req);
  if (!who) return json(401, { error: "unauthorized" });

  const body = await req.json().catch(() => null);
  const isbn = body?.isbn;
  if (typeof isbn !== "string" || !isIsbn13(isbn)) return json(400, { error: "bad_request" });

  const cached = await who.db.rpc("lookup_isbn", { isbn });
  if (cached.error) return json(200, { status: "unavailable" });
  if (cached.data) return json(200, { status: "found", work: cached.data });

  // OPEN_LIBRARY_URL lets a local stack point at a stand-in server; production uses openlibrary.org.
  const result = await lookupOpenLibrary(isbn, { baseUrl: Deno.env.get("OPEN_LIBRARY_URL") ?? OPEN_LIBRARY_URL });
  if (result.status !== "found") return json(200, result);

  const { data: work, error } = await admin.rpc("cache_isbn_work", {
    isbn,
    title: result.book.title,
    author_names: result.book.authorNames,
    publisher_name: result.book.publisherName,
    external_id: result.book.externalId,
  });
  if (error || !work) return json(200, { status: "unavailable" });
  return json(200, { status: "found", work });
});
