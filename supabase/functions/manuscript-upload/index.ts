// Checks a manuscript PDF, stores it in the private bucket and records an immutable version.
// Request: POST with the PDF as the whole body, and ?workId=…&label=… (label optional).
import { PDFDocument } from "npm:pdf-lib@1.17.1";

import { admin, caller, cors, json, UUID } from "../_shared/caller.ts";

const MAX_BYTES = 20 * 1024 * 1024; // byte_size limit in lisette-schema.html (proposal)

async function pageCount(bytes: Uint8Array): Promise<number> {
  // The content decides, not the file name or the declared type.
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") return 0;
  try {
    return (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount();
  } catch {
    return 0;
  }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const who = await caller(req);
  if (!who) return json(401, { error: "unauthorized" });

  const params = new URL(req.url).searchParams;
  const workId = params.get("workId") ?? "";
  if (!UUID.test(workId)) return json(400, { error: "bad_request" });

  // Row-level security shows a private work only to its owner.
  const { data: work } = await who.db.from("works").select("id").eq("id", workId).eq("owner_id", who.user.id).maybeSingle();
  if (!work) return json(403, { error: "forbidden" });

  // Refuse oversized bodies before reading them, then read the file once: the check, the hash and the
  // stored object all use this one copy.
  if (Number(req.headers.get("Content-Length")) > MAX_BYTES) return json(413, { error: "too_large" });
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > MAX_BYTES) return json(413, { error: "too_large" });
  const pages = await pageCount(bytes);
  if (pages < 1) return json(422, { error: "invalid_pdf" });

  const path = `${who.user.id}/${workId}/${crypto.randomUUID()}.pdf`;
  const stored = await admin.storage.from("manuscripts").upload(path, bytes, { contentType: "application/pdf" });
  if (stored.error) return json(500, { error: "upload_failed" });

  const { data: version, error } = await admin.rpc("record_manuscript_version", {
    uploader: who.user.id,
    work_id: workId,
    storage_path: path,
    sha256: await sha256(bytes),
    byte_size: bytes.length,
    page_count: pages,
    label: params.get("label"),
  });
  if (error) {
    await admin.storage.from("manuscripts").remove([path]);
    return json(error.code === "23514" ? 400 : 500, { error: error.code === "23514" ? "bad_request" : "upload_failed" });
  }

  const { storage_path: _, ...metadata } = version;
  return json(201, metadata);
});
