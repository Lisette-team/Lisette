// Local-only fixtures: creates verified users in the local Supabase stack.
// The service-role key comes from `npx supabase status` and must never be
// put in an EXPO_PUBLIC_ variable or shipped code.
import { createClient } from "@supabase/supabase-js";

import type { Locale } from "@/i18n";

export const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
export const anonKey = process.env.SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const localSupabaseAvailable = Boolean(serviceRoleKey);

export function adminClient() {
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set; run `npx supabase status`.");
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error(`Refusing to create fixture users outside a local stack: ${url}`);
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createVerifiedUser(locale: Locale = "ro") {
  const email = `reader-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = "parola_test";
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Test Reader", locale },
  });
  if (error) throw error;
  return { id: data.user.id, email, password };
}

export async function deleteUser(id: string) {
  const { error } = await adminClient().auth.admin.deleteUser(id);
  if (error) throw error;
}

export type PublisherKind = "publishing_house" | "literary_magazine" | "independent_editor";

// Publication sign-up is not in the app yet; fixtures create approved publications directly.
export async function createApprovedPublisher(kind: PublisherKind = "publishing_house") {
  const admin = adminClient();
  const email = `publisher-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = "parola_test";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Test Publication", locale: "ro", account_kind: "publisher", publisher_kind: kind },
  });
  if (error) throw error;
  const approved = await admin
    .from("publishers")
    .update({ approval_status: "approved", verification_method: "direct_confirmation" })
    .eq("id", data.user.id);
  if (approved.error) throw approved.error;
  return { id: data.user.id, email, password };
}

// Cleanup must fail loudly: a silently skipped delete surfaces later as a vague "Database error deleting user".
async function must<T extends { error: unknown }>(request: PromiseLike<T>): Promise<T> {
  const result = await request;
  if (result.error) throw result.error;
  return result;
}

// Submissions reference the calls, so they go first.
export async function deletePublisher(id: string) {
  const admin = adminClient();
  await must(admin.from("submissions").delete().eq("publisher_id", id));
  await must(admin.from("calls").delete().eq("publisher_id", id));
  await deleteUser(id);
}

// A user who owns works cannot be deleted (retention is undecided), so fixtures remove their
// submissions, works, manuscript versions and files first. Materials and history go with the submissions.
export async function deleteAuthor(id: string) {
  const admin = adminClient();
  const { data: sent } = await must(admin.from("submissions").select("id").eq("author_id", id));
  await must(admin.from("domain_events").delete().in("subject_id", (sent ?? []).map((s) => s.id)));
  await must(admin.from("submissions").delete().eq("author_id", id));
  const { data: materials } = await must(admin.storage.from("manuscripts").list(`${id}/materials`));
  if (materials?.length) {
    await must(admin.storage.from("manuscripts").remove(materials.map((m) => `${id}/materials/${m.name}`)));
  }
  const { data: works } = await must(admin.from("works").select("id").eq("owner_id", id));
  const workIds = (works ?? []).map((work) => work.id);
  const { data: versions } = await must(admin.from("manuscript_versions").select("storage_path").in("work_id", workIds));
  if (versions?.length) await must(admin.storage.from("manuscripts").remove(versions.map((v) => v.storage_path)));
  await must(admin.from("manuscript_versions").delete().in("work_id", workIds));
  await must(admin.from("works").delete().in("id", workIds));
  await deleteUser(id);
}
