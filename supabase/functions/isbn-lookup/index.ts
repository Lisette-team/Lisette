// ISBN lookup for the scanner and manual add.
//
// Lookup: POST {isbn} (a valid ISBN-13).
//   → {status: "found", work} | {status: "not_found"} | {status: "unavailable"}.
//   The cache in `works` is read as the caller; on a miss, Open Library is asked once and its answer
//   cached with the service role. An unknown ISBN creates nothing, so no title is ever invented.
//
// Create (manual add with an ISBN): POST {isbn, title, authors, create: true}.
//   → {status: "found", work}: the ISBN names a known book; nothing is created, the app offers it.
//   → {status: "created", workId, isbnKept}: a new manual book, created as the caller. It keeps the
//     ISBN only when Open Library has no record of it and no other book holds it. Unavailable lookups
//     and any conflict (also with a private work the caller cannot see) give the same answer,
//     isbnKept false, so the answer never reveals a private ISBN. Clients cannot set an ISBN
//     themselves (ruling 2026-11-13).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { admin, caller, cors, json } from "../_shared/caller.ts";
import { isIsbn13, lookupOpenLibrary, OPEN_LIBRARY_URL, type LookupResult } from "../_shared/open-library.ts";

// OPEN_LIBRARY_URL replaces openlibrary.org only where it is set: the local stack's gateway tests set
// it to a stub in supabase/functions/.env (git-ignored). Requests cannot change it.
const openLibraryUrl = Deno.env.get("OPEN_LIBRARY_URL") || OPEN_LIBRARY_URL;

type Lookup = { status: "found"; work: unknown } | { status: "not_found" } | { status: "unavailable" };

async function lookup(db: SupabaseClient, isbn: string, baseUrl: string): Promise<Lookup> {
  const cached = await db.rpc("lookup_isbn", { isbn });
  if (cached.error) {
    console.error("isbn-lookup: lookup_isbn failed", cached.error);
    return { status: "unavailable" };
  }
  if (cached.data) return { status: "found", work: cached.data };

  const result: LookupResult = await lookupOpenLibrary(isbn, { baseUrl });
  if (result.status !== "found") return result;

  const { data: work, error } = await admin.rpc("cache_isbn_work", {
    isbn,
    title: result.book.title,
    author_names: result.book.authorNames,
    publisher_name: result.book.publisherName,
    external_id: result.book.externalId,
  });
  if (error) {
    console.error("isbn-lookup: cache_isbn_work failed", error);
    return { status: "unavailable" };
  }
  // Null when the ISBN belongs to a work the caller may not see: say nothing about it.
  return work ? { status: "found", work } : { status: "unavailable" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const who = await caller(req);
  if (!who) return json(401, { error: "unauthorized" });

  const body = await req.json().catch(() => null);
  const isbn = body?.isbn;
  if (typeof isbn !== "string" || !isIsbn13(isbn)) return json(400, { error: "bad_request" });

  if (body?.create !== true) return json(200, await lookup(who.db, isbn, openLibraryUrl));

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const authors = Array.isArray(body.authors) ? body.authors : [];
  if (!title || title.length > 200 || authors.length > 20 || authors.some((a: unknown) => typeof a !== "string")) {
    return json(400, { error: "bad_request" });
  }

  // Checked again here, so a client cannot skip the lookup and claim an ISBN.
  const found = await lookup(who.db, isbn, openLibraryUrl);
  if (found.status === "found") return json(200, found);

  // Created as the caller: create_catalogue_work checks the person account and the title.
  const created = await who.db.rpc("create_catalogue_work", { title, authors });
  if (created.error) {
    if (created.error.code === "42501") return json(403, { error: "forbidden" });
    if (created.error.code === "23514") return json(400, { error: "bad_request" });
    console.error("isbn-lookup: create_catalogue_work failed", created.error);
    return json(500, { error: "server_error" });
  }
  const workId = created.data as string;

  let isbnKept = false;
  if (found.status === "not_found") {
    const attached = await admin.rpc("attach_isbn", { work_id: workId, isbn });
    if (attached.error) console.error("isbn-lookup: attach_isbn failed", attached.error);
    isbnKept = attached.data === true;
  }
  return json(200, { status: "created", workId, isbnKept });
});
