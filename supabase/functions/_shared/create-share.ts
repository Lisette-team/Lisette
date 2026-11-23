import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { getDocument } from "npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs";
import { admin, caller, cors, json, UUID } from "./caller.ts";
import { matchShare, quotedText } from "./provenance.ts";

export async function createShare(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const who = await caller(req);
  if (!who) return json(401, { error: "unauthorized" });
  const input = await req.json().catch(() => null);
  const { workId, kind, source, submissionId, body, audience, versionId, pageStart, pageEnd, imagePath } = input ?? {};
  if (!UUID.test(workId ?? "") || !["excerpt", "synopsis", "beta_pages"].includes(kind) ||
      !["own_work", "own_book", "received_manuscript"].includes(source) || !["public", "followers"].includes(audience) ||
      typeof body !== "string" || body.trim().length === 0 || body.length > 30000 ||
      (submissionId != null && !UUID.test(submissionId)) || (versionId != null && !UUID.test(versionId)) ||
      ((pageStart != null || pageEnd != null) && (!Number.isInteger(pageStart) || !Number.isInteger(pageEnd) || pageStart < 1 || pageEnd < pageStart || !versionId)) ||
      (imagePath != null && typeof imagePath !== "string") ||
      (kind === "beta_pages" && (!pageStart || source !== "own_work"))) return json(400, { error: "bad_request" });

  if (imagePath != null) {
    if (!imagePath.startsWith(`${who.user.id}/`)) return json(403, { error: "forbidden" });
    const parts = imagePath.split("/");
    const filename = parts.pop()!;
    const { data: objects } = await admin.storage.from("excerpt-images").list(parts.join("/"), { search: filename });
    if (!objects?.some((object) => object.name === filename)) return json(403, { error: "forbidden" });
  }

  let extracted: string | null = null;
  let score: number | null = null;
  let path: string | null = null;
  if (versionId) {
    const { data: version } = await admin.from("manuscript_versions").select("id,work_id,storage_path,page_count,works(owner_id)").eq("id", versionId).maybeSingle();
    if (!version || version.work_id !== workId || (pageEnd && pageEnd > version.page_count) || (kind === "beta_pages" && pageStart === 1 && pageEnd === version.page_count)) return json(403, { error: "forbidden" });
    if (source === "received_manuscript") {
      const { data: submission } = await who.db.from("submissions").select("id,publisher_id,version_id,status").eq("id", submissionId).maybeSingle();
      if (!submission || submission.publisher_id !== who.user.id || submission.version_id !== versionId || !["submitted", "in_review", "on_hold", "selected"].includes(submission.status)) return json(403, { error: "forbidden" });
    } else {
      const { data: owned } = await who.db.from("manuscript_versions").select("id").eq("id", versionId).maybeSingle();
      if (!owned || source !== "own_work") return json(403, { error: "forbidden" });
    }
    const { data: file, error } = await admin.storage.from("manuscripts").download(version.storage_path);
    if (error || !file) return json(404, { error: "not_found" });
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      if (kind === "beta_pages") {
        const original = await PDFDocument.load(bytes);
        const subset = await PDFDocument.create();
        const pages = await subset.copyPages(original, Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => pageStart - 1 + i));
        pages.forEach((page) => subset.addPage(page));
        path = `${who.user.id}/shares/${crypto.randomUUID()}.pdf`;
        const upload = await admin.storage.from("manuscripts").upload(path, await subset.save({ useObjectStreams: false }), { contentType: "application/pdf" });
        if (upload.error) throw upload.error;
      } else if (pageStart) {
        const pdf = await getDocument({ data: bytes, useSystemFonts: true }).promise;
        const chunks: string[] = [];
        for (let page = pageStart; page <= pageEnd; page++) {
          const text = await (await pdf.getPage(page)).getTextContent();
          chunks.push(text.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join(""));
        }
        extracted = chunks.join("\n");
        score = matchShare(quotedText(body), extracted);
        await pdf.destroy();
      }
    } catch {
      return json(422, { error: "invalid_pdf" });
    }
  }
  const { data, error } = await admin.rpc("create_processed_share", {
    actor: who.user.id, work_id: workId, share_kind: kind, source, submission_id: submissionId ?? null,
    body, audience, manuscript_version_id: versionId ?? null, page_start: pageStart ?? null, page_end: pageEnd ?? null,
    provenance_score: score, source_text: extracted, pages_path: path, image_path: imagePath ?? null,
  });
  if (error) {
    if (path) await admin.storage.from("manuscripts").remove([path]);
    return json(403, { error: "forbidden" });
  }
  return json(201, { id: data });
}
