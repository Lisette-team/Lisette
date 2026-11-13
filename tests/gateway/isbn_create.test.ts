/// <reference types="node" />
// The create path of the isbn-lookup Edge Function (ruling 2026-11-13: only the server attaches an
// ISBN to a manual book). Open Library is replaced by a stub server in this process, reached from the
// Edge Runtime container through host.docker.internal and the function's service-key-guarded test
// seam, so no test reaches the live API. Needs the local stack and its keys; skipped otherwise.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { createClient } from "@supabase/supabase-js";

import { anonKey, createVerifiedUser, deleteAuthor, deleteUser, localSupabaseAvailable, url } from "../helpers/local-users";

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function randomIsbn() {
  const body = `979${1 + Math.floor(Math.random() * 9)}${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  const sum = [...body].reduce((total, digit, i) => total + Number(digit) * (i % 2 === 0 ? 1 : 3), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

(localSupabaseAvailable ? describe : describe.skip)("isbn_create", () => {
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // ISBNs the stub answers with an error (Open Library unavailable); every other ISBN has no record.
  const failing = new Set<string>();
  const asked: string[] = [];
  let stub: Server;
  let stubUrl: string;
  let reader: { id: string; token: string };
  let author: { id: string; token: string };
  const works: string[] = [];

  async function signIn(user: { email: string; password: string }) {
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signInWithPassword(user);
    if (error) throw error;
    return { client, token: data.session.access_token };
  }

  function call(token: string, body: unknown) {
    return fetch(`${url}/functions/v1/isbn-lookup`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-lisette-open-library-url": stubUrl,
        "x-lisette-service-key": serviceRoleKey,
      },
      body: JSON.stringify(body),
    });
  }

  beforeAll(async () => {
    stub = createServer((req: IncomingMessage, res: ServerResponse) => {
      const isbn = new URL(req.url ?? "/", "http://stub").searchParams.get("isbn") ?? "";
      asked.push(isbn);
      if (failing.has(isbn)) {
        res.writeHead(503).end("busy");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ numFound: 0, docs: [] }));
    });
    await new Promise<void>((resolve) => stub.listen(0, "0.0.0.0", resolve));
    stubUrl = `http://host.docker.internal:${(stub.address() as AddressInfo).port}`;

    const readerUser = await createVerifiedUser();
    const authorUser = await createVerifiedUser();
    reader = { id: readerUser.id, token: (await signIn(readerUser)).token };
    const signedAuthor = await signIn(authorUser);
    author = { id: authorUser.id, token: signedAuthor.token };
    await signedAuthor.client.rpc("activate_author");
  });

  afterAll(async () => {
    stub.close();
    await admin.from("library_entries").delete().in("work_id", works);
    await admin.from("works").delete().in("id", works);
    await deleteUser(reader.id);
    await deleteAuthor(author.id);
  });

  test("an ISBN Open Library has no record of is attached by the server", async () => {
    const isbn = randomIsbn();
    const response = await call(reader.token, { isbn, title: "Carte nouă", authors: ["Autoare"], create: true });
    expect(response.status).toBe(200);
    const body = await response.json();
    works.push(body.workId);

    expect(body).toEqual({ status: "created", workId: expect.any(String), isbnKept: true });
    expect(asked).toContain(isbn);
    const { data } = await admin.from("works").select("title, author_names, isbn, source, visibility, owner_id").eq("id", body.workId).single();
    expect(data).toEqual({
      title: "Carte nouă",
      author_names: ["Autoare"],
      isbn,
      source: "manual",
      visibility: "public",
      owner_id: null,
    });
  });

  test("a known ISBN is offered, not created again", async () => {
    const isbn = randomIsbn();
    const first = await (await call(reader.token, { isbn, title: "Prima", authors: [], create: true })).json();
    works.push(first.workId);

    const second = await (await call(reader.token, { isbn, title: "A doua", authors: [], create: true })).json();

    expect(second).toEqual({ status: "found", work: expect.objectContaining({ id: first.workId, title: "Prima", isbn }) });
  });

  test("a private work holding the ISBN gets the same answer as an unavailable lookup", async () => {
    // Ana's private project carries an ISBN the reader cannot see.
    const authorDb = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${author.token}` } },
    });
    const { data: projectId, error } = await authorDb.rpc("create_work", { title: "Proiect privat" });
    if (error) throw error;
    const privateIsbn = randomIsbn();
    await admin.from("works").update({ isbn: privateIsbn }).eq("id", projectId);

    const unavailableIsbn = randomIsbn();
    failing.add(unavailableIsbn);

    const conflict = await (await call(reader.token, { isbn: privateIsbn, title: "Alta", authors: [], create: true })).json();
    const unavailable = await (await call(reader.token, { isbn: unavailableIsbn, title: "Alta", authors: [], create: true })).json();
    works.push(conflict.workId, unavailable.workId);

    expect(conflict).toEqual({ status: "created", workId: expect.any(String), isbnKept: false });
    expect(unavailable).toEqual({ status: "created", workId: expect.any(String), isbnKept: false });
    expect(Object.keys(conflict).sort()).toEqual(Object.keys(unavailable).sort());
    const { data } = await admin.from("works").select("id, isbn").in("id", [conflict.workId, unavailable.workId]);
    expect(data?.map((w) => w.isbn)).toEqual([null, null]);
    const { data: project } = await admin.from("works").select("isbn, title").eq("id", projectId).single();
    expect(project).toEqual({ isbn: privateIsbn, title: "Proiect privat" });
  });

  test("a create request needs a title", async () => {
    const response = await call(reader.token, { isbn: randomIsbn(), title: "  ", authors: [], create: true });
    expect(response.status).toBe(400);
  });

  test("an ISMN is not accepted as an ISBN", async () => {
    const response = await call(reader.token, { isbn: "9790060115615", title: "Partitură", authors: [], create: true });
    expect(response.status).toBe(400);
  });
});
