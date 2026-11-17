import { createClient } from "@supabase/supabase-js";

import { newIdempotencyKey, submitBatch, type SubmitItem } from "@/features/submissions/batch";

const item: SubmitItem = {
  callId: "call-1",
  versionId: "version-1",
  genreId: null,
  materials: {},
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
  rightsDeclared: true,
  contactConsent: true,
};

// A connection that never answers, as when a phone switches networks mid-request.
const hangingFetch: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) =>
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
  );

describe("newIdempotencyKey", () => {
  test("gives a UUID v4 even where crypto.randomUUID is missing, as on Hermes", () => {
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const keys = new Set(Array.from({ length: 50 }, newIdempotencyKey));
      expect(keys.size).toBe(50);
      for (const key of keys) expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      Object.defineProperty(globalThis.crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});

describe("submitBatch", () => {
  test("a request that never answers becomes unknown after the timeout", async () => {
    const client = createClient("http://127.0.0.1:54321", "anon", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: hangingFetch },
    });

    await expect(submitBatch(client, [item], 50)).resolves.toEqual([{ callId: "call-1", status: "unknown" }]);
  });
});
