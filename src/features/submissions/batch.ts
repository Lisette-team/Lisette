// Sends one manuscript version to several calls. Each call is an independent submission: one failing
// never undoes another. Imports only types, so it runs in tests against the local stack too.
import type { SupabaseClient } from "@supabase/supabase-js";

export type SubmitItem = {
  callId: string;
  versionId: string;
  genreId: string | null;
  // Synopsis and sample are storage paths from uploadMaterial; the author introduction is text.
  materials: { synopsis?: string; sample?: string; author_intro?: string };
  // One key per call, kept for every retry, so a repeat after an unknown outcome finds the first attempt.
  idempotencyKey: string;
  rightsDeclared: boolean;
  contactConsent: boolean;
};

// The server's reasons (submit_manuscript). Anything else, including no answer, is "unknown".
const FAILURES = [
  "call_not_open",
  "not_owner",
  "blocked",
  "duplicate_active",
  "resubmission_not_allowed",
  "missing_phone",
  "missing_consent",
  "missing_material",
  "invalid_material",
  "invalid_genre",
] as const;

export type SubmitFailure = (typeof FAILURES)[number];

export type SubmitOutcome = { callId: string } & (
  | { status: "sent"; submissionId: string }
  | { status: "failed"; reason: SubmitFailure }
  | { status: "unknown" }
);

// A dropped mobile connection can hang a request for minutes; past the timeout the item is unknown, so the
// others still get their result and a retry with the same key resolves it.
export async function submitBatch(client: SupabaseClient, items: SubmitItem[], timeoutMs = 30_000): Promise<SubmitOutcome[]> {
  return Promise.all(
    items.map(async ({ callId, ...item }): Promise<SubmitOutcome> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const { data, error } = await client.rpc("submit_manuscript", {
          call_id: callId,
          version_id: item.versionId,
          genre_id: item.genreId,
          materials: item.materials,
          idempotency_key: item.idempotencyKey,
          rights_declared: item.rightsDeclared,
          contact_consent: item.contactConsent,
        }).abortSignal(controller.signal);
        if (!error && typeof data === "string") return { callId, status: "sent", submissionId: data };
        const reason = FAILURES.find((failure) => failure === error?.message);
        return reason ? { callId, status: "failed", reason } : { callId, status: "unknown" };
      } catch {
        return { callId, status: "unknown" };
      } finally {
        clearTimeout(timer);
      }
    }),
  );
}

// A key only has to be unique per attempt, not secret. Hermes on phones has no crypto.randomUUID.
// shortcut: Math.random fallback instead of expo-crypto; switch if keys ever need to be unguessable.
export function newIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Everything not yet sent, with the same keys: failed items are checked again, unknown ones resolve.
export function retryItems(items: SubmitItem[], outcomes: SubmitOutcome[]): SubmitItem[] {
  const sent = new Set(outcomes.filter((outcome) => outcome.status === "sent").map((outcome) => outcome.callId));
  return items.filter((item) => !sent.has(item.callId));
}
