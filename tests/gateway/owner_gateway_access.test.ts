// Runs against the local stack's Edge Functions (`supabase start`). Needs SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY from `npx supabase status`; skipped otherwise.
import { createClient } from "@supabase/supabase-js";

import { anonKey, createVerifiedUser, deleteAuthor, localSupabaseAvailable, url } from "../helpers/local-users";

// Smallest well-formed PDF: one empty page, with a correct cross-reference table.
function onePagePdf(): Uint8Array<ArrayBuffer> {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = objects.map((object, i) => {
    const offset = body.length;
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

const functions = `${url}/functions/v1`;

async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

const text = (value: string) => new TextEncoder().encode(value);

// The PDF is the whole request body; workId and label travel in the URL.
function upload(token: string | null, workId: string, file: Uint8Array<ArrayBuffer>) {
  const query = new URLSearchParams({ workId, label: "v1 după redactare" });
  return fetch(`${functions}/manuscript-upload?${query}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/pdf",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: file,
  });
}

function readFile(token: string | null, body: object) {
  return fetch(`${functions}/manuscript-file`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function signIn(user: { email: string; password: string }) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword(user);
  if (error) throw error;
  return { client, token: data.session.access_token };
}

(localSupabaseAvailable ? describe : describe.skip)("owner_gateway_access", () => {
  const pdf = onePagePdf();
  let ana: Awaited<ReturnType<typeof signIn>>;
  let bogdan: Awaited<ReturnType<typeof signIn>>;
  let workId: string;
  let version: { id: string; sha256: string; byte_size: number; page_count: number; label: string };

  const users: string[] = [];

  beforeAll(async () => {
    const anaUser = await createVerifiedUser();
    const bogdanUser = await createVerifiedUser();
    users.push(anaUser.id, bogdanUser.id);
    ana = await signIn(anaUser);
    bogdan = await signIn(bogdanUser);
    await ana.client.rpc("activate_author");
    const { data, error } = await ana.client.rpc("create_work", { title: "Proiectul Anei" });
    if (error) throw error;
    workId = data as string;

    const response = await upload(ana.token, workId, pdf);
    expect(response.status).toBe(201);
    version = await response.json();
  });

  afterAll(async () => {
    await Promise.all(users.map(deleteAuthor));
  });

  test("an upload records the hash, size and page count of the real file", async () => {
    expect(version).toMatchObject({
      sha256: await sha256(pdf),
      byte_size: pdf.length,
      page_count: 1,
      label: "v1 după redactare",
    });
    expect(version).not.toHaveProperty("storage_path");
  });

  test("the owner reads the bytes, never cached", async () => {
    const response = await readFile(ana.token, { versionId: version.id, purpose: "read" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await sha256(new Uint8Array(await response.arrayBuffer()))).toBe(version.sha256);
  });

  test("the owner can download", async () => {
    const response = await readFile(ana.token, { versionId: version.id, purpose: "download" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/^attachment/);
  });

  test("signed out gets 401", async () => {
    expect((await readFile(null, { versionId: version.id, purpose: "read" })).status).toBe(401);
    expect((await upload(null, workId, pdf)).status).toBe(401);
  });

  test("another account gets 403", async () => {
    expect((await readFile(bogdan.token, { versionId: version.id, purpose: "read" })).status).toBe(403);
    expect((await upload(bogdan.token, workId, pdf)).status).toBe(403);
  });

  test("any submissionId is denied, even for the owner", async () => {
    const response = await readFile(ana.token, {
      versionId: version.id,
      submissionId: "00000000-0000-0000-0000-000000000000",
      purpose: "read",
    });
    expect(response.status).toBe(403);
  });

  test("a malformed request gets 400", async () => {
    expect((await readFile(ana.token, { versionId: version.id, purpose: "print" })).status).toBe(400);
  });

  test("a non-PDF renamed .pdf is rejected and stores nothing", async () => {
    const response = await upload(ana.token, workId, text("PK\u0003\u0004 not a pdf"));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "invalid_pdf" });
    const { count } = await ana.client.from("manuscript_versions").select("*", { count: "exact", head: true });
    expect(count).toBe(1);
  });

  test("a file with only a PDF header is rejected", async () => {
    expect((await upload(ana.token, workId, text("%PDF-1.4\ngarbage"))).status).toBe(422);
  });

  test("a file over 20 MiB is rejected", async () => {
    const big = new Uint8Array(pdf.length + 20 * 1024 * 1024);
    big.set(pdf);
    expect((await upload(ana.token, workId, big)).status).toBe(413);
  });
});
