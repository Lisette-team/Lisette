// Local-only fixtures: creates verified users in the local Supabase stack.
// The service-role key comes from `npx supabase status` and must never be
// put in an EXPO_PUBLIC_ variable or shipped code.
import { createClient } from "@supabase/supabase-js";

import type { Locale } from "@/i18n";

export const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
export const anonKey = process.env.SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const localSupabaseAvailable = Boolean(serviceRoleKey);

function adminClient() {
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set; run `npx supabase status`.");
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error(`Refusing to create fixture users outside a local stack: ${url}`);
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createVerifiedUser(locale: Locale = "ro") {
  const email = `reader-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = "local-only-password-1";
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

// A user who owns works cannot be deleted (retention is undecided), so fixtures remove their works,
// manuscript versions and files first.
export async function deleteAuthor(id: string) {
  const admin = adminClient();
  const { data: works } = await admin.from("works").select("id").eq("owner_id", id);
  const workIds = (works ?? []).map((work) => work.id);
  const { data: versions } = await admin.from("manuscript_versions").select("storage_path").in("work_id", workIds);
  if (versions?.length) await admin.storage.from("manuscripts").remove(versions.map((v) => v.storage_path));
  await admin.from("manuscript_versions").delete().in("work_id", workIds);
  await admin.from("works").delete().in("id", workIds);
  await deleteUser(id);
}
