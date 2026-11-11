import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import i18n, { isLocale, type Locale } from "@/i18n";
import * as storage from "@/lib/storage";
import { supabase } from "@/lib/supabase";

export type AuthSession = { userId: string; locale: Locale; authorEnabled: boolean };

// "loading" is kept apart from "signedOut" so a restored session never
// triggers a redirect to the start screen while it is still being read.
export type SessionState =
  | { status: "loading" }
  | { status: "signedOut"; locale: Locale | null }
  | { status: "signedIn"; session: AuthSession };

export type AuthErrorKey =
  | "errors.invalidCredentials"
  | "errors.emailNotConfirmed"
  | "errors.passwordTooShort"
  | "errors.requiredFields"
  | "errors.invalidEmail"
  | "errors.emailTaken"
  | "errors.network"
  | "errors.generic";

type Result = { error: AuthErrorKey | null };

type SessionContextValue = {
  state: SessionState;
  chooseLocale(locale: Locale): Promise<void>;
  signIn(email: string, password: string): Promise<Result>;
  signUp(input: { name: string; email: string; password: string }): Promise<Result>;
  resendVerification(email: string): Promise<Result>;
  // From the email check screen: signs in with the details just used to sign up, once the email is
  // confirmed. False while it is not confirmed yet, or when there is nothing pending.
  signInAfterConfirmation(): Promise<boolean>;
  requestPasswordReset(email: string): Promise<Result>;
  signOut(): Promise<void>;
  // Re-reads the session context, for example after the writer profile is activated.
  reload(): Promise<void>;
};

const LOCALE_KEY = "lisette.locale";
const MIN_PASSWORD_LENGTH = 10;

const SessionContext = createContext<SessionContextValue | null>(null);

// The sign-up details, kept in memory only (never on the device), so the person isn't asked for
// them again after confirming their email. Lost when the app closes; cleared on sign-in or sign-out.
let pendingSignUp: { email: string; password: string } | null = null;

async function applyLocale(locale: Locale) {
  await i18n.changeLanguage(locale);
  await storage.setItem(LOCALE_KEY, locale);
}

// get_session_context() derives the account from auth.uid() on the server and returns
// { accountId, kind, locale, authorEnabled, approvalStatus }.
export function sessionFromContext(data: unknown): AuthSession | null {
  if (!data || typeof data !== "object") return null;
  const { accountId, locale, authorEnabled } = data as { accountId?: unknown; locale?: unknown; authorEnabled?: unknown };
  if (typeof accountId !== "string" || !isLocale(locale)) return null;
  return { userId: accountId, locale, authorEnabled: authorEnabled === true };
}

async function loadSessionContext(): Promise<AuthSession | null> {
  const { data, error } = await supabase.rpc("get_session_context");
  return error ? null : sessionFromContext(data);
}

function toErrorKey(error: { code?: string; message?: string; status?: number }): AuthErrorKey {
  switch (error.code) {
    case "invalid_credentials":
      return "errors.invalidCredentials";
    case "email_not_confirmed":
      return "errors.emailNotConfirmed";
    case "weak_password":
      return "errors.passwordTooShort";
    case "email_address_invalid":
    case "validation_failed":
      return "errors.invalidEmail";
    case "user_already_exists":
    case "email_exists":
      return "errors.emailTaken";
  }
  if (error.message?.includes("Network request failed") || error.message?.includes("Failed to fetch")) {
    return "errors.network";
  }
  return "errors.generic";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  const refresh = useCallback(async (hasSession: boolean) => {
    const storedLocale = await storage.getItem(LOCALE_KEY);
    const deviceLocale = isLocale(storedLocale) ? storedLocale : null;
    if (hasSession) {
      const session = await loadSessionContext();
      if (session) {
        await applyLocale(session.locale);
        setState({ status: "signedIn", session });
        return;
      }
    }
    if (deviceLocale) await i18n.changeLanguage(deviceLocale);
    setState({ status: "signedOut", locale: deviceLocale });
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) return refresh(Boolean(data.session));
      })
      .catch(() => {
        if (active) return refresh(false);
      });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION is already covered by getSession above. The refresh
      // calls Supabase again, so it is deferred: calling the client inside
      // this callback can deadlock on the SDK's auth lock.
      if (event === "INITIAL_SESSION") return;
      setTimeout(() => {
        if (active) void refresh(Boolean(session));
      }, 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      async chooseLocale(locale) {
        await applyLocale(locale);
        if (state.status === "signedIn") {
          await supabase.rpc("set_locale", { locale });
          setState({ status: "signedIn", session: { ...state.session, locale } });
        } else {
          setState({ status: "signedOut", locale });
        }
      },
      async signIn(email, password) {
        if (!email.trim() || !password) return { error: "errors.requiredFields" };
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (!error) pendingSignUp = null;
        return { error: error ? toErrorKey(error) : null };
      },
      async signUp({ name, email, password }) {
        if (!name.trim() || !email.trim() || !password) return { error: "errors.requiredFields" };
        if (!EMAIL_PATTERN.test(email.trim())) return { error: "errors.invalidEmail" };
        if (password.length < MIN_PASSWORD_LENGTH) return { error: "errors.passwordTooShort" };
        const locale = isLocale(i18n.language) ? i18n.language : "ro";
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim(), locale } },
        });
        pendingSignUp = error ? null : { email: email.trim(), password };
        return { error: error ? toErrorKey(error) : null };
      },
      async resendVerification(email) {
        const { error } = await supabase.auth.resend({ type: "signup", email });
        return { error: error ? toErrorKey(error) : null };
      },
      async signInAfterConfirmation() {
        const pending = pendingSignUp;
        if (!pending) return false;
        const { error } = await supabase.auth.signInWithPassword(pending);
        // Anything other than "not confirmed yet" ends the wait; the person signs in normally then.
        if (!error || error.code !== "email_not_confirmed") pendingSignUp = null;
        return !error;
      },
      async requestPasswordReset(email) {
        if (!EMAIL_PATTERN.test(email.trim())) return { error: "errors.invalidEmail" };
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        return { error: error ? toErrorKey(error) : null };
      },
      async signOut() {
        pendingSignUp = null;
        await supabase.auth.signOut();
      },
      async reload() {
        // A failed re-read keeps the current session rather than signing the person out.
        const session = await loadSessionContext();
        if (session) setState({ status: "signedIn", session });
      },
    }),
    [state],
  );

  return createElement(SessionContext.Provider, { value }, children);
}

export function useSessionContext(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSessionContext must be used inside SessionProvider");
  return value;
}

// Null means signed out or still loading; use useSessionContext().state to tell them apart.
export function useSession(): AuthSession | null {
  const { state } = useSessionContext();
  return state.status === "signedIn" ? state.session : null;
}
