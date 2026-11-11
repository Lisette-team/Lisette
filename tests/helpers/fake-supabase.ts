// In-memory stand-in for the Supabase client at the network boundary.
// Component tests use it because they run without a database; the SQL
// policy tests in supabase/tests exercise the real owner-scope rules.
import type { Locale } from "@/i18n";

type FakeUser = {
  id: string;
  email: string;
  password: string;
  locale: Locale;
  verified: boolean;
  authorEnabled?: boolean;
  metadata?: Record<string, unknown>;
};
type Listener = (event: string, session: { user: { id: string } } | null) => void;

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;

export function createFakeSupabase() {
  const users = new Map<string, FakeUser>();
  const listeners = new Set<Listener>();
  let current: FakeUser | null = null;

  const session = () => (current ? { user: { id: current.id, email: current.email } } : null);
  const emit = (event: string) => listeners.forEach((listener) => listener(event, session()));

  return {
    users,
    addVerifiedUser(email: string, password: string, locale: Locale = "ro") {
      const user: FakeUser = { id: `user-${users.size + 1}`, email, password, locale, verified: true };
      users.set(email, user);
      return user;
    },
    signInAs(email: string) {
      current = users.get(email) ?? null;
    },
    auth: {
      async getSession() {
        return { data: { session: session() }, error: null };
      },
      onAuthStateChange(listener: Listener) {
        listeners.add(listener);
        return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const user = users.get(email);
        if (!user || user.password !== password) {
          return { data: { session: null }, error: { code: "invalid_credentials", message: "Invalid login credentials" } };
        }
        if (!user.verified) {
          return { data: { session: null }, error: { code: "email_not_confirmed", message: "Email not confirmed" } };
        }
        current = user;
        emit("SIGNED_IN");
        return { data: { session: session() }, error: null };
      },
      async signUp({
        email,
        password,
        options,
      }: {
        email: string;
        password: string;
        options?: { data?: Record<string, unknown> };
      }) {
        if (!users.has(email)) {
          const metadata = options?.data ?? {};
          users.set(email, { id: `user-${users.size + 1}`, email, password, locale: "ro", verified: false, metadata });
        }
        return { data: { session: null }, error: null };
      },
      async resend() {
        return { data: {}, error: null };
      },
      async resetPasswordForEmail() {
        return { data: {}, error: null };
      },
      async signOut() {
        current = null;
        emit("SIGNED_OUT");
        return { error: null };
      },
    },
    async rpc(name: string, args?: { locale?: Locale }) {
      if (!current) return { data: null, error: { code: "42501", message: "not authenticated" } };
      if (name === "get_session_context") {
        return { data: { accountId: current.id, kind: "person", locale: current.locale, authorEnabled: Boolean(current.authorEnabled), approvalStatus: null }, error: null };
      }
      if (name === "activate_author") {
        current.authorEnabled = true;
        return { data: null, error: null };
      }
      if (name === "set_locale" && args?.locale) {
        current.locale = args.locale;
        return { data: null, error: null };
      }
      return { data: null, error: { code: "PGRST202", message: `unknown function ${name}` } };
    },
  };
}
