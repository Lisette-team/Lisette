import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonKey, createVerifiedUser, createApprovedPublisher, deletePublisher, deleteAuthor, localSupabaseAvailable, url } from "../helpers/local-users";
import { onePagePdf } from "../helpers/pdf";
import { listWorks } from "@/features/manuscripts/api";
let mockClient: SupabaseClient;
jest.mock("@/lib/supabase", () => ({ get supabase() { return mockClient; } }));
jest.mock("react-native", () => ({ Platform: { OS: "web" } }));

(localSupabaseAvailable ? describe : describe.skip)("manuscript deletion", () => {
  let author: Awaited<ReturnType<typeof createVerifiedUser>>;
  let other: Awaited<ReturnType<typeof createVerifiedUser>>;
  let token: string;
  let otherToken: string;
  let workId: string;
  let versionId: string;
  let path: string;
  let publisher: Awaited<ReturnType<typeof createApprovedPublisher>>;
  let sentVersion: string;
  let sentPath: string;
  const admin = adminClient;
  async function remove(auth: string, body: object) {
    return fetch(`${url}/functions/v1/manuscript-delete`, { method: "POST", headers: { apikey: anonKey, Authorization: `Bearer ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  beforeAll(async () => {
    author = await createVerifiedUser(); other = await createVerifiedUser();
    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    const a = await client.auth.signInWithPassword(author); token = a.data.session!.access_token;
    await client.rpc("activate_author");
    const work = await client.rpc("create_work", { title: "Manuscris" }); workId = work.data;
    const uploaded = await fetch(`${url}/functions/v1/manuscript-upload?workId=${workId}`, { method: "POST", headers: { apikey: anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/pdf" }, body: onePagePdf() });
    expect(uploaded.status).toBe(201); versionId = (await uploaded.json()).id;
    const row = await admin().from("manuscript_versions").select("storage_path").eq("id", versionId).single(); path = row.data!.storage_path;
    const second = await fetch(`${url}/functions/v1/manuscript-upload?workId=${workId}`, { method: "POST", headers: { apikey: anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/pdf" }, body: onePagePdf() });
    sentVersion = (await second.json()).id;
    sentPath = (await admin().from("manuscript_versions").select("storage_path").eq("id", sentVersion).single()).data!.storage_path;
    await admin().from("private_contacts").update({ phone: "+40712345678" }).eq("user_id", author.id);
    publisher = await createApprovedPublisher();
    const pubClient = createClient(url, anonKey, { auth: { persistSession: false } });
    await pubClient.auth.signInWithPassword(publisher);
    const call = await pubClient.rpc("save_call", { call_id: null, title: "Apel", description: null, opens_at: new Date(Date.now() - 86400000).toISOString(), closes_at: null, accepted_languages: ["ro"], req_full_manuscript: true, req_synopsis: false, req_sample: false, req_genre: false, req_author_intro: false, genre_ids: [] });
    if (call.error) throw call.error;
    const published = await pubClient.rpc("publish_call", { call_id: call.data }); if (published.error) throw published.error;
    const submitted = await client.rpc("submit_manuscript", { call_id: call.data, version_id: sentVersion, genre_id: null, materials: {}, idempotency_key: crypto.randomUUID(), rights_declared: true, contact_consent: true });
    if (submitted.error) throw submitted.error;
    mockClient = createClient(url, anonKey, { auth: { persistSession: false } });
    await mockClient.auth.signInWithPassword(author);
    const b = await client.auth.signInWithPassword(other); otherToken = b.data.session!.access_token;
  });
  afterAll(async () => { await deleteAuthor(author.id); await deleteAuthor(other.id); await deletePublisher(publisher.id); });
  test("another user cannot delete a version", async () => { expect((await remove(otherToken, { versionId })).status).toBe(403); });
  test("listWorks includes sent state and private preferences", async () => {
    const marked = await mockClient.rpc("set_work_starred", { work_id: workId, starred: true }); if (marked.error) throw marked.error;
    const main = await mockClient.rpc("set_main_version", { work_id: workId, version_id: sentVersion }); if (main.error) throw main.error;
    const works = await listWorks(author.id);
    const work = works.find((item) => item.id === workId)!;
    expect(work).toMatchObject({ is_starred: true, main_version_id: sentVersion });
    expect(work.versions.find((item) => item.id === sentVersion)).toMatchObject({ sent: true });
    expect(work.versions.find((item) => item.id === versionId)).toMatchObject({ sent: false });
  });
  test("a sent version cannot be deleted and its object stays", async () => {
    const response = await remove(token, { versionId: sentVersion });
    expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: "version_sent" });
    expect((await admin().storage.from("manuscripts").download(sentPath)).error).toBeNull();
  });
  test("rows are deleted before files", async () => {
    const result = await remove(token, { versionId }); expect(result.status).toBe(200);
    const row = await admin().from("manuscript_versions").select("id").eq("id", versionId).maybeSingle(); expect(row.data).toBeNull();
    const object = await admin().storage.from("manuscripts").download(path); expect(object.error).toBeTruthy();
  });
});
