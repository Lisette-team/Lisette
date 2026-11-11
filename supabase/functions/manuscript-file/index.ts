// Serves manuscript bytes from the private bucket after checking the caller on every request.
// Request: POST {versionId, submissionId?, purpose: "read" | "download"}.
import { admin, caller, cors, json, UUID } from "../_shared/caller.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const who = await caller(req);
  if (!who) return json(401, { error: "unauthorized" });

  const body = await req.json().catch(() => null);
  const { versionId, submissionId, purpose } = body ?? {};
  if (typeof versionId !== "string" || !UUID.test(versionId) || (purpose !== "read" && purpose !== "download")) {
    return json(400, { error: "bad_request" });
  }
  // Recipient publishers read through their submission from 02.3; until then only the owner reads.
  if (submissionId != null) return json(403, { error: "forbidden" });

  // Row-level security returns the row only to the owner of the work.
  const { data: version } = await who.db
    .from("manuscript_versions")
    .select("storage_path")
    .eq("id", versionId)
    .maybeSingle();
  if (!version) return json(403, { error: "forbidden" });

  const { data: file, error } = await admin.storage.from("manuscripts").download(version.storage_path);
  if (error || !file) return json(404, { error: "not_found" });

  return new Response(file, {
    headers: {
      ...cors,
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Content-Disposition": purpose === "download" ? 'attachment; filename="manuscript.pdf"' : "inline",
    },
  });
});
