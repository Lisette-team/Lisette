// Serves manuscript bytes from the private bucket after checking the caller on every request.
// Request: POST {versionId, submissionId?, purpose: "read" | "download"}.
import { admin, caller, cors, json, UUID } from "../_shared/caller.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const who = await caller(req);
  if (!who) return json(401, { error: "unauthorized" });

  const body = await req.json().catch(() => null);
  const { versionId, submissionId, materialId, purpose, shareVersionId, textVersionId } = body ?? {};
  if (purpose === "create_share") {
    const { createShare } = await import("../_shared/create-share.ts");
    return createShare(new Request(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(body) }));
  }
  if (purpose === "excerpt_image_url") {
    if (typeof textVersionId !== "string" || !UUID.test(textVersionId)) return json(400, { error: "bad_request" });
    const { data: version } = await who.db.from("text_versions").select("id,image_path").eq("id", textVersionId).maybeSingle();
    if (!version) return json(403, { error: "forbidden" });
    if (!version.image_path) return json(404, { error: "not_found" });
    const { data, error } = await admin.storage.from("excerpt-images").createSignedUrl(version.image_path, 300);
    if (error || !data) return json(404, { error: "not_found" });
    return json(200, { url: data.signedUrl });
  }
  if (shareVersionId) {
    if (!UUID.test(shareVersionId) || purpose !== "read") return json(400, { error: "bad_request" });
    const { data: permitted, error: accessError } = await who.db.rpc("can_read_shared_pages", { version_id: shareVersionId });
    if (accessError || !permitted) return json(403, { error: "forbidden" });
    const { data: privateShare } = await admin.from("share_private").select("pages_path").eq("text_version_id", shareVersionId).maybeSingle();
    if (!privateShare?.pages_path) return json(404, { error: "not_found" });
    const { data: subset } = await admin.storage.from("manuscripts").download(privateShare.pages_path);
    if (!subset) return json(404, { error: "not_found" });
    return new Response(subset, { headers: { ...cors, "Content-Type": "application/pdf", "Cache-Control": "no-store", "Content-Disposition": "inline" } });
  }
  if (typeof versionId !== "string" || !UUID.test(versionId) || (purpose !== "read" && purpose !== "download") ||
      (submissionId != null && (typeof submissionId !== "string" || !UUID.test(submissionId))) ||
      (materialId != null && (typeof materialId !== "string" || !UUID.test(materialId) || !submissionId))) {
    return json(400, { error: "bad_request" });
  }

  let path: string | null = null;
  if (submissionId) {
    const { data: submission } = await who.db.from("submissions").select("publisher_id, version_id, status")
      .eq("id", submissionId).maybeSingle();
    if (!submission || submission.publisher_id !== who.user.id || submission.version_id !== versionId ||
        !["submitted", "in_review", "on_hold", "selected"].includes(submission.status) ||
        (purpose === "download" && submission.status === "on_hold")) return json(403, { error: "forbidden" });
    if (materialId) {
      const { data: material } = await who.db.from("submission_materials").select("storage_path")
        .eq("id", materialId).eq("submission_id", submissionId).maybeSingle();
      path = material?.storage_path ?? null;
    } else {
      const { data: version } = await admin.from("manuscript_versions").select("storage_path").eq("id", versionId).maybeSingle();
      path = version?.storage_path ?? null;
    }
  } else {
    const { data: version } = await who.db.from("manuscript_versions").select("storage_path").eq("id", versionId).maybeSingle();
    path = version?.storage_path ?? null;
  }
  if (!path) return json(403, { error: "forbidden" });
  const { data: file, error } = await admin.storage.from("manuscripts").download(path);
  if (error || !file) return json(404, { error: "not_found" });
  if (submissionId && !materialId && purpose === "read") {
    const { error: markerError } = await admin.from("submission_inbox").upsert(
      { submission_id: submissionId, opened_at: new Date().toISOString() },
      { onConflict: "submission_id", ignoreDuplicates: true },
    );
    if (markerError) return json(500, { error: "unknown" });
  }

  return new Response(file, {
    headers: {
      ...cors,
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Content-Disposition": purpose === "download" ? 'attachment; filename="manuscript.pdf"' : "inline",
    },
  });
});
