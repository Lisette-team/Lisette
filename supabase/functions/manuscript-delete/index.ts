import { admin, caller, cors, json, UUID } from "../_shared/caller.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const who = await caller(req);
  if (!who) return json(401, { error: "unauthorized" });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "bad_request" }); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 ||
      !((typeof body.versionId === "string" && UUID.test(body.versionId)) ||
        (typeof body.workId === "string" && UUID.test(body.workId)))) return json(400, { error: "bad_request" });
  const version = typeof body.versionId === "string";
  const { data, error } = await who.db.rpc(version ? "delete_manuscript_version" : "delete_manuscript",
    version ? { version_id: body.versionId } : { work_id: body.workId });
  if (error) {
    const code = error.message;
    if (code === "not_owner") return json(403, { error: code });
    if (["version_sent", "work_sent", "work_in_use"].includes(code)) return json(409, { error: code });
    return json(500, { error: "delete_failed" });
  }
  const paths: string[] = version ? [data as string] : data as string[];
  if (paths.length) {
    try { await admin.storage.from("manuscripts").remove(paths); } catch { /* The rows are already deleted; an orphan is acceptable. */ }
  }
  return json(200, { deleted: paths.length });
});
