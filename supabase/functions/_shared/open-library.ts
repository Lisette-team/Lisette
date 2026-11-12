// Open Library ISBN lookup, kept free of Deno APIs so the app's tests can run it with recorded answers.
// Terms checked 2026-11-12: docs/technical/04-library-open-library.md.

export const OPEN_LIBRARY_URL = "https://openlibrary.org";

// Generic name, no personal contact details (see the technical note).
export const USER_AGENT = "Lisette/1.0 (literary app prototype)";

export const LOOKUP_TIMEOUT_MS = 5000;

export type FoundBook = {
  title: string;
  authorNames: string[];
  publisherName: string | null;
  externalId: string | null;
};

export type LookupResult = { status: "found"; book: FoundBook } | { status: "not_found" } | { status: "unavailable" };

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const FIELDS = "key,title,author_name,editions,editions.key,editions.title,editions.publisher";

export function isIsbn13(isbn: string): boolean {
  if (!/^97[89][0-9]{10}$/.test(isbn)) return false;
  const sum = [...isbn].reduce((total, digit, i) => total + Number(digit) * (i % 2 === 0 ? 1 : 3), 0);
  return sum % 10 === 0;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim()) : [];

// One search.json answer: the work, with the edition that has this ISBN. Null when there is no title,
// so a title is never made up.
export function parseSearch(body: unknown): FoundBook | null {
  const doc = (body as { docs?: unknown[] } | null)?.docs?.[0] as Record<string, unknown> | undefined;
  if (!doc || typeof doc !== "object") return null;
  const edition = ((doc.editions as { docs?: unknown[] } | undefined)?.docs?.[0] ?? {}) as Record<string, unknown>;
  const title = [edition.title, doc.title].find((t): t is string => typeof t === "string" && t.trim() !== "");
  if (!title) return null;
  const key = typeof edition.key === "string" ? edition.key : typeof doc.key === "string" ? doc.key : null;
  return {
    title: title.trim(),
    authorNames: strings(doc.author_name),
    publisherName: strings(edition.publisher)[0] ?? null,
    externalId: key ? key.split("/").pop() || null : null,
  };
}

export async function lookupOpenLibrary(
  isbn: string,
  options: { baseUrl?: string; fetch?: Fetch; timeoutMs?: number } = {},
): Promise<LookupResult> {
  const { baseUrl = OPEN_LIBRARY_URL, fetch: doFetch = fetch, timeoutMs = LOOKUP_TIMEOUT_MS } = options;
  const url = `${baseUrl}/search.json?${new URLSearchParams({ isbn, fields: FIELDS, limit: "1" })}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await doFetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return { status: "unavailable" };
    const book = parseSearch(await response.json());
    return book ? { status: "found", book } : { status: "not_found" };
  } catch {
    return { status: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
