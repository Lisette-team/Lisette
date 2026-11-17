// Runs against the local stack after `supabase db reset`, which loads supabase/seed.sql. Calls changed by
// hand in the app make it fail until the next reset.
import { createClient } from "@supabase/supabase-js";

import { anonKey, createVerifiedUser, deleteUser, localSupabaseAvailable, url } from "../helpers/local-users";

const client = () => createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

(localSupabaseAvailable ? describe : describe.skip)("seed_accounts", () => {
  test.each(["editura@lisette.local", "revista@lisette.local", "editor@lisette.local"])(
    "%s signs in as an approved publication",
    async (email) => {
      const db = client();
      const { error } = await db.auth.signInWithPassword({ email, password: "local-only-password-1" });
      expect(error).toBeNull();
      const { data } = await db.rpc("get_session_context");
      expect(data).toMatchObject({ kind: "publisher", approvalStatus: "approved" });
    },
  );

  test("a new reader sees the seeded open calls, not the closed one or the draft", async () => {
    const reader = await createVerifiedUser();
    try {
      const db = client();
      await db.auth.signInWithPassword(reader);
      const seeded = [1, 2, 3, 4, 5].map((n) => `d1000000-0000-4000-8000-00000000000${n}`);
      const { data, error } = await db.from("open_calls").select("id").in("id", seeded);
      expect(error).toBeNull();
      expect(data!.map((call) => call.id).sort()).toEqual([
        "d1000000-0000-4000-8000-000000000001",
        "d1000000-0000-4000-8000-000000000002",
        "d1000000-0000-4000-8000-000000000005",
      ]);
    } finally {
      await deleteUser(reader.id);
    }
  });
});
