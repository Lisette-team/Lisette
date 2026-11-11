import { sessionFromContext } from "@/features/account/session";

// The shape returned by get_session_context() in supabase/migrations (task/01-database).
describe("get_session_context response", () => {
  test("keeps the account id, the saved language and the writer flag", () => {
    const data = { accountId: "8f0c…", kind: "person", locale: "en", authorEnabled: true, approvalStatus: null };
    expect(sessionFromContext(data)).toEqual({ userId: "8f0c…", locale: "en", authorEnabled: true });
  });

  test("an unknown language or a missing account is not a session", () => {
    expect(sessionFromContext({ accountId: "8f0c…", locale: "fr" })).toBeNull();
    expect(sessionFromContext({ locale: "ro" })).toBeNull();
    expect(sessionFromContext(null)).toBeNull();
  });
});
