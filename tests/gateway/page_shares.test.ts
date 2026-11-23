import { createClient } from "@supabase/supabase-js";
import { adminClient, anonKey, createVerifiedUser, createApprovedPublisher, deletePublisher, deleteAuthor, deleteUser, localSupabaseAvailable, url } from "../helpers/local-users";
import { twoPagePdf } from "../helpers/pdf";

(localSupabaseAvailable ? describe : describe.skip)("page shares", () => {
  const users: string[] = [];
  let author: ReturnType<typeof adminClient>, follower: ReturnType<typeof adminClient>, stranger: ReturnType<typeof adminClient>;
  let authorToken: string, followerToken: string, strangerToken: string, workId: string, versionId: string, shareId: string;
  const shares: string[] = [];
  let publisher: Awaited<ReturnType<typeof createApprovedPublisher>> | undefined;
  const post = (name: string, token: string, body: unknown) => fetch(`${url}/functions/v1/${name}`, { method: "POST", headers: { apikey: anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  beforeAll(async () => {
    const accounts = await Promise.all([createVerifiedUser(), createVerifiedUser(), createVerifiedUser()]);
    users.push(...accounts.map((u) => u.id));
    const sessions = await Promise.all(accounts.map(async (u) => {
      const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await client.auth.signInWithPassword(u); if (error) throw error;
      return { client, token: data.session!.access_token };
    }));
    [author, follower, stranger] = sessions.map((s) => s.client);
    [authorToken, followerToken, strangerToken] = sessions.map((s) => s.token);
    await author.rpc("activate_author");
    const { data, error } = await author.rpc("create_work", { title: "Page share fixture" }); if (error) throw error; workId = data;
    const upload = await fetch(`${url}/functions/v1/manuscript-upload?workId=${workId}`, { method: "POST", headers: { apikey: anonKey, Authorization: `Bearer ${authorToken}`, "Content-Type": "application/pdf" }, body: twoPagePdf() });
    if (upload.status !== 201) throw new Error(await upload.text());
    versionId = (await upload.json()).id;
    await follower.rpc("set_follow", { target_id: users[0], following: true });
  });
  afterAll(async () => {
    const admin = adminClient();
    if (users[0]) await admin.storage.from("excerpt-images").remove([`${users[0]}/test.png`, `${users[0]}/page.png`]);
    for (const savedId of shares) {
      const { data: versions } = await admin.from("text_versions").select("id").eq("excerpt_id", savedId);
      const ids = (versions ?? []).map((v) => v.id);
      const { data: requests } = await admin.from("sharing_requests").select("id").in("text_version_id", ids);
      await admin.from("sharing_decisions").delete().in("request_id", (requests ?? []).map((r) => r.id));
      await admin.from("sharing_requests").delete().in("text_version_id", ids);
      await admin.from("excerpts").update({ published_version_id: null }).eq("content_id", savedId);
      await admin.from("text_versions").delete().in("id", ids);
      await admin.from("contents").delete().eq("id", savedId);
    }
    const { data: derived } = await admin.storage.from("manuscripts").list(`${users[0]}/shares`);
    if (derived?.length) await admin.storage.from("manuscripts").remove(derived.map((f) => `${users[0]}/shares/${f.name}`));
    if (publisher) await deletePublisher(publisher.id);
    if (users[0]) await deleteAuthor(users[0]);
    for (const id of users.slice(1)) await deleteUser(id);
  });
  test("a follower reads only the generated subset; outsiders and full manuscript access are denied", async () => {
    const created = await post("manuscript-file", authorToken, { purpose: "create_share", workId, kind: "beta_pages", source: "own_work", body: "p. 1", audience: "followers", versionId, pageStart: 1, pageEnd: 1 });
    expect(created.status).toBe(201); shareId = (await created.json()).id; shares.push(shareId);
    const { data } = await author.from("excerpts").select("published_version_id").eq("content_id", shareId).single();
    const shareVersionId = data!.published_version_id;
    const allowed = await post("manuscript-file", followerToken, { shareVersionId, purpose: "read" });
    expect(allowed.status).toBe(200); expect(allowed.headers.get("content-type")).toBe("application/pdf");
    const subset = new TextDecoder().decode(await allowed.arrayBuffer());
    expect(subset).toContain("The first page contains");
    expect(subset).not.toContain("The second page is a different secret");
    expect((await post("manuscript-file", followerToken, { versionId, purpose: "read" })).status).toBe(403);
    expect((await post("manuscript-file", strangerToken, { shareVersionId, purpose: "read" })).status).toBe(403);
  });
  test("page image follows the audience", async () => {
    const imagePath = `${users[0]}/page.png`;
    const uploaded = await author.storage.from("excerpt-images").upload(imagePath, new Uint8Array([137, 80, 78, 71]), { contentType: "image/png" });
    expect(uploaded.error).toBeNull();
    const created = await post("manuscript-file", authorToken, { purpose: "create_share", workId, kind: "beta_pages", source: "own_work", body: "p. 1", audience: "followers", versionId, pageStart: 1, pageEnd: 1, imagePath });
    expect(created.status).toBe(201);
    const id = (await created.json()).id; shares.push(id);
    const { data } = await author.from("excerpts").select("published_version_id").eq("content_id", id).single();
    const textVersionId = data!.published_version_id;
    const allowed = await post("manuscript-file", followerToken, { purpose: "excerpt_image_url", textVersionId });
    expect(allowed.status).toBe(200); expect((await allowed.json()).url).toBeTruthy();
    expect((await post("manuscript-file", strangerToken, { purpose: "excerpt_image_url", textVersionId })).status).toBe(403);
  });
  test("the server extracts selected text and stores its match", async () => {
    const created = await post("manuscript-file", authorToken, { purpose: "create_share", workId, kind: "excerpt", source: "own_work", body: "The first page contains a clear and quiet little story.", audience: "public", versionId, pageStart: 1, pageEnd: 1 });
    expect(created.status).toBe(201);
    const id = (await created.json()).id; shares.push(id);
    const { data, error } = await author.from("text_versions").select("provenance_score,page_start,page_end,manuscript_version_id").eq("excerpt_id", id).single();
    expect(error).toBeNull(); expect(data).toMatchObject({ provenance_score: 1, page_start: 1, page_end: 1, manuscript_version_id: versionId });
  });

  test("image access follows the published version audience", async () => {
    const imagePath = `${users[0]}/test.png`;
    const uploaded = await author.storage.from("excerpt-images").upload(imagePath, new Uint8Array([137, 80, 78, 71]), { contentType: "image/png" });
    expect(uploaded.error).toBeNull();
    const request = { purpose: "create_share", workId, kind: "excerpt", source: "own_work", body: "<p>One small story</p>", audience: "followers", imagePath };
    const created = await post("manuscript-file", authorToken, request);
    expect(created.status).toBe(201);
    const id = (await created.json()).id; shares.push(id);
    const { data } = await author.from("excerpts").select("published_version_id").eq("content_id", id).single();
    const textVersionId = data!.published_version_id;
    for (const token of [authorToken, followerToken]) {
      const response = await post("manuscript-file", token, { purpose: "excerpt_image_url", textVersionId });
      expect(response.status).toBe(200); expect((await response.json()).url).toBeTruthy();
    }
    expect((await post("manuscript-file", strangerToken, { purpose: "excerpt_image_url", textVersionId })).status).toBe(403);
    publisher = await createApprovedPublisher();
    const pubClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const session = await pubClient.auth.signInWithPassword(publisher);
    const admin = adminClient();
    const call = await admin.from("calls").insert({ publisher_id: publisher.id, title: "Image approval", opens_at: new Date().toISOString(), accepted_languages: ["ro"] }).select("id").single();
    if (call.error) throw call.error;
    const submission = await admin.from("submissions").insert({ author_id: users[0], work_id: workId, version_id: versionId, publisher_id: publisher.id, call_id: call.data.id, contact_email: "fixture@example.test", contact_phone: "123", rights_declared_at: new Date().toISOString(), contact_consent_at: new Date().toISOString(), accepted_policy: { sharing_policy: "synopsis_and_excerpt_approval" }, idempotency_key: crypto.randomUUID() }).select("id").single();
    if (submission.error) throw submission.error;
    const requestRow = await admin.from("sharing_requests").select("id").eq("text_version_id", textVersionId).single();
    const decision = await admin.from("sharing_decisions").insert({ request_id: requestRow.data!.id, submission_id: submission.data.id, publisher_id: publisher.id });
    if (decision.error) throw decision.error;
    expect((await post("manuscript-file", session.data.session!.access_token, { purpose: "excerpt_image_url", textVersionId })).status).toBe(200);

    expect((await post("manuscript-file", authorToken, { ...request, imagePath: `${users[1]}/test.png` })).status).toBe(403);
  });

  test("the entire manuscript cannot be shared as a page range", async () => {
    const response = await post("manuscript-file", authorToken, { purpose: "create_share", workId, kind: "beta_pages", source: "own_work", body: "p. 1–2", audience: "public", versionId, pageStart: 1, pageEnd: 2 });
    expect(response.status).toBe(403);
  });

});
