// Runs submitBatch, the client code the composer uses, against the local stack.
import { createClient } from "@supabase/supabase-js";

import { retryItems, submitBatch, type SubmitItem } from "@/features/submissions/batch";

import {
  adminClient,
  anonKey,
  createApprovedPublisher,
  createVerifiedUser,
  deleteAuthor,
  deletePublisher,
  localSupabaseAvailable,
  url,
} from "../helpers/local-users";
import { onePagePdf } from "../helpers/pdf";

async function signIn(user: { email: string; password: string }) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword(user);
  if (error) throw error;
  return { client, token: data.session.access_token };
}

type Session = Awaited<ReturnType<typeof signIn>>;

async function newVersion(author: Session, title: string): Promise<string> {
  const { data: workId, error } = await author.client.rpc("create_work", { title });
  if (error) throw error;
  const response = await fetch(`${url}/functions/v1/manuscript-upload?workId=${workId}`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${author.token}`, "Content-Type": "application/pdf" },
    body: onePagePdf(),
  });
  expect(response.status).toBe(201);
  return (await response.json()).id;
}

async function openCall(publisher: Session, title: string, closesAt: string | null = null): Promise<string> {
  const opensAt = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const { data, error } = await publisher.client.rpc("save_call", {
    call_id: null, title, description: null, opens_at: opensAt, closes_at: closesAt, accepted_languages: ["ro"],
    req_full_manuscript: true, req_synopsis: false, req_sample: false, req_genre: false, req_author_intro: false,
    genre_ids: [],
  });
  if (error) throw error;
  const published = await publisher.client.rpc("publish_call", { call_id: data });
  if (published.error) throw published.error;
  return data as string;
}

const item = (callId: string, versionId: string): SubmitItem => ({
  callId,
  versionId,
  genreId: null,
  materials: {},
  idempotencyKey: crypto.randomUUID(),
  rightsDeclared: true,
  contactConsent: true,
});

(localSupabaseAvailable ? describe : describe.skip)("batch_retry_is_independent", () => {
  const authors: string[] = [];
  const publishers: string[] = [];
  let author: Session;
  let first: Session;
  let second: Session;

  beforeAll(async () => {
    const authorUser = await createVerifiedUser();
    authors.push(authorUser.id);
    author = await signIn(authorUser);
    await author.client.rpc("activate_author");
    const phone = await adminClient().from("private_contacts").update({ phone: "+40712345678" }).eq("user_id", authorUser.id);
    if (phone.error) throw phone.error;
    const firstUser = await createApprovedPublisher("publishing_house");
    const secondUser = await createApprovedPublisher("literary_magazine");
    publishers.push(firstUser.id, secondUser.id);
    first = await signIn(firstUser);
    second = await signIn(secondUser);
  });

  afterAll(async () => {
    await Promise.all(authors.map(deleteAuthor));
    await Promise.all(publishers.map(deletePublisher));
  });

  test("A succeeds and B fails; the retry sends only B and creates no second A", async () => {
    const versionId = await newVersion(author, "Prima operă");
    const callA = await openCall(first, "Apel A");
    const callB = await openCall(second, "Apel B", new Date(Date.now() - 86_400_000).toISOString());
    const items = [item(callA, versionId), item(callB, versionId)];

    const outcomes = await submitBatch(author.client, items);
    expect(outcomes).toEqual([
      { callId: callA, status: "sent", submissionId: expect.any(String) },
      { callId: callB, status: "failed", reason: "call_not_open" },
    ]);

    const reopened = await adminClient().from("calls").update({ closes_at: null }).eq("id", callB);
    if (reopened.error) throw reopened.error;
    const retry = retryItems(items, outcomes);
    expect(retry).toEqual([items[1]]);
    expect(await submitBatch(author.client, retry)).toEqual([
      { callId: callB, status: "sent", submissionId: expect.any(String) },
    ]);

    const { count } = await author.client.from("submissions").select("*", { count: "exact", head: true }).eq("call_id", callA);
    expect(count).toBe(1);
  });

  test("unknown outcome resolves to the existing submission", async () => {
    const versionId = await newVersion(author, "A doua operă");
    const call = await openCall(first, "Apel C");
    const sent = item(call, versionId);
    // The server commits, then the answer is lost on the way back.
    const lossy = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { Authorization: `Bearer ${author.token}` },
        fetch: async (input, init) => {
          await fetch(input, init);
          throw new TypeError("connection lost");
        },
      },
    });

    expect(await submitBatch(lossy, [sent])).toEqual([{ callId: call, status: "unknown" }]);
    const [resolved] = await submitBatch(author.client, [sent]);
    expect(resolved).toMatchObject({ status: "sent" });

    const { count } = await author.client.from("submissions").select("*", { count: "exact", head: true }).eq("call_id", call);
    expect(count).toBe(1);
    const events = await adminClient()
      .from("domain_events")
      .select("*", { count: "exact", head: true })
      .eq("subject_id", resolved.status === "sent" ? resolved.submissionId : "");
    expect(events.count).toBe(1);
  });

  test("two concurrent submits of one work to one publisher leave one active submission", async () => {
    const versionId = await newVersion(author, "A treia operă");
    const call = await openCall(first, "Apel D");
    const outcomes = await Promise.all([
      submitBatch(author.client, [item(call, versionId)]),
      submitBatch(author.client, [item(call, versionId)]),
    ]);
    expect(outcomes.flat().map((outcome) => outcome.status).sort()).toEqual(["failed", "sent"]);
    expect(outcomes.flat()).toContainEqual({ callId: call, status: "failed", reason: "duplicate_active" });
  });

  test("the same key sent twice at once gives one submission", async () => {
    const versionId = await newVersion(author, "A patra operă");
    const call = await openCall(first, "Apel E");
    const once = item(call, versionId);
    const [[a], [b]] = await Promise.all([submitBatch(author.client, [once]), submitBatch(author.client, [once])]);
    expect(a).toMatchObject({ status: "sent" });
    expect(b).toEqual(a);
  });
  test("recipient file access follows status and records opening", async () => {
    const versionId = await newVersion(author, "Citire");
    const call = await openCall(first, "Citire");
    const [sent] = await submitBatch(author.client, [item(call, versionId)]);
    if (sent.status !== "sent") throw new Error("submission failed");
    const read = (purpose: string) => fetch(`${url}/functions/v1/manuscript-file`, {
      method: "POST", headers: { apikey: anonKey, Authorization: `Bearer ${first.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ versionId, submissionId: sent.submissionId, purpose }),
    });
    expect((await read("read")).status).toBe(200);
    const marker = await first.client.from("submission_inbox").select("opened_at").eq("submission_id", sent.submissionId).single();
    expect(marker.data?.opened_at).toBeTruthy();
    expect((await first.client.from("submissions").select("status").eq("id", sent.submissionId).single()).data?.status).toBe("submitted");
    expect((await read("read")).status).toBe(200);
    expect((await first.client.from("submission_inbox").select("opened_at").eq("submission_id", sent.submissionId).single()).data?.opened_at).toBe(marker.data?.opened_at);
    expect((await first.client.rpc("transition_submission", { submission_id: sent.submissionId, target: "on_hold" })).error).toBeNull();
    expect((await read("read")).status).toBe(200);
    expect((await read("download")).status).toBe(403);
    expect((await author.client.rpc("withdraw_submission", { submission_id: sent.submissionId })).error).toBeNull();
    expect((await read("read")).status).toBe(403);
  });

  test("every status protects manuscript and material independently for each recipient", async () => {
    const versionId = await newVersion(author, "Două publicații");
    const calls = await Promise.all([openCall(first, "Primul"), openCall(second, "Al doilea")]);
    const outcomes = await submitBatch(author.client, calls.map((call) => item(call, versionId)));
    if (outcomes[0].status !== "sent" || outcomes[1].status !== "sent") throw new Error("submission failed");
    const a = outcomes[0].submissionId; const b = outcomes[1].submissionId;
    const uploaded = await fetch(`${url}/functions/v1/manuscript-upload?purpose=material`, {
      method: "POST", headers: { apikey: anonKey, Authorization: `Bearer ${author.token}`, "Content-Type": "application/pdf" }, body: onePagePdf(),
    });
    const { storagePath } = await uploaded.json();
    const material = await adminClient().from("submission_materials").insert({ submission_id: a, kind: "sample", storage_path: storagePath }).select("id").single();
    if (material.error) throw material.error;
    const request = (session: Session, submissionId: string, purpose: string, materialId?: string) => fetch(`${url}/functions/v1/manuscript-file`, {
      method: "POST", headers: { apikey: anonKey, Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ versionId, submissionId, materialId, purpose }),
    });
    for (const [status, read, download] of [["submitted", 200, 200], ["in_review", 200, 200], ["on_hold", 200, 403], ["selected", 200, 200], ["rejected", 403, 403], ["withdrawn", 403, 403]] as const) {
      const changed = await adminClient().from("submissions").update({ status }).eq("id", a); if (changed.error) throw changed.error;
      for (const materialId of [undefined, material.data.id]) {
        expect((await request(first, a, "read", materialId)).status).toBe(read);
        expect((await request(first, a, "download", materialId)).status).toBe(download);
      }
    }
    expect((await request(second, b, "read")).status).toBe(200);
    expect((await request(second, b, "download")).status).toBe(200);
  });

});
