// Runs against the local stack's isbn-lookup Edge Function (`supabase start`). Needs SUPABASE_ANON_KEY
// and SUPABASE_SERVICE_ROLE_KEY from `npx supabase status`; skipped otherwise. Only cached ISBNs and
// refused requests are tested here, so no test reaches Open Library; the Open Library client itself
// (unknown ISBN, timeout, unavailable) is tested with recorded answers in tests/library-pure.test.ts.
import { createClient } from "@supabase/supabase-js";

import { anonKey, createVerifiedUser, deleteUser, localSupabaseAvailable, url } from "../helpers/local-users";

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// A random valid ISBN-13, so reruns never collide with a book cached earlier.
function randomIsbn() {
  const body = `979${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
  const sum = [...body].reduce((total, digit, i) => total + Number(digit) * (i % 2 === 0 ? 1 : 3), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

function lookup(token: string | null, body: unknown) {
  return fetch(`${url}/functions/v1/isbn-lookup`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

(localSupabaseAvailable ? describe : describe.skip)("isbn_lookup", () => {
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const isbn = randomIsbn();
  let token: string;
  let userId: string;
  let workId: string;

  beforeAll(async () => {
    const user = await createVerifiedUser();
    userId = user.id;
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signInWithPassword(user);
    if (error) throw error;
    token = data.session.access_token;
    const { data: work, error: cacheError } = await admin.rpc("cache_isbn_work", {
      isbn,
      title: "Cartea din cache",
      author_names: ["Autoare Test"],
      publisher_name: "Editura Test",
      external_id: null,
    });
    if (cacheError) throw cacheError;
    workId = (work as { id: string }).id;
  });

  afterAll(async () => {
    await admin.from("works").delete().eq("id", workId);
    await deleteUser(userId);
  });

  test("a signed-out request is refused", async () => {
    const response = await lookup(null, { isbn });
    expect(response.status).toBe(401);
  });

  test("an ISBN with a wrong check digit is refused before any lookup", async () => {
    const wrong = `${isbn.slice(0, 12)}${(Number(isbn[12]) + 1) % 10}`;
    const response = await lookup(token, { isbn: wrong });
    expect(response.status).toBe(400);
  });

  test("a cached ISBN is answered from works", async () => {
    const response = await lookup(token, { isbn });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "found",
      work: {
        id: workId,
        title: "Cartea din cache",
        authorNames: ["Autoare Test"],
        publisherName: "Editura Test",
        isbn,
      },
    });
  });
});
