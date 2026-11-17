import { supabase } from "@/lib/supabase";

// shortcut: only the two interface languages; add codes here when calls accept other manuscript languages.
export const CALL_LANGUAGES = ["ro", "en"] as const;

export type CallInput = {
  title: string;
  description: string | null;
  // null start = now; null deadline = always open.
  opensAt: string | null;
  closesAt: string | null;
  acceptedLanguages: string[];
  requirements: { fullManuscript: boolean; synopsis: boolean; sample: boolean; genre: boolean; authorIntro: boolean };
  genreIds: string[];
};

export type Call = {
  id: string;
  title: string;
  description: string | null;
  opens_at: string;
  closes_at: string | null;
  accepted_languages: string[];
  req_full_manuscript: boolean;
  req_synopsis: boolean;
  req_sample: boolean;
  req_genre: boolean;
  req_author_intro: boolean;
  published_at: string | null;
  cancelled_at: string | null;
  genre_ids: string[];
};

export type Genre = { id: string; code: string; name_ro: string; name_en: string };

export type CallStatus = "draft" | "scheduled" | "open" | "closed" | "cancelled";

export function callStatus(call: Call, now = new Date()): CallStatus {
  if (call.cancelled_at) return "cancelled";
  if (!call.published_at) return "draft";
  if (new Date(call.opens_at) > now) return "scheduled";
  if (call.closes_at && new Date(call.closes_at) <= now) return "closed";
  return "open";
}

// "YYYY-MM-DD" in the device's time zone: the start of that day, or (for a deadline) its last moment.
export function dayToIso(day: string, end = false): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!match) return null;
  const [year, month, date] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const value = end ? new Date(year, month, date, 23, 59, 59, 999) : new Date(year, month, date);
  return value.getMonth() === month && value.getDate() === date ? value.toISOString() : null;
}

export function isoToDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CALL_COLUMNS =
  "id, title, description, opens_at, closes_at, accepted_languages, req_full_manuscript, req_synopsis, req_sample, " +
  "req_genre, req_author_intro, published_at, cancelled_at, call_genres(genre_id)";

type CallRow = Omit<Call, "genre_ids"> & { call_genres: { genre_id: string }[] };
const toCall = ({ call_genres, ...row }: CallRow): Call => ({ ...row, genre_ids: call_genres.map((g) => g.genre_id) });

// Row-level security returns all of the caller's own calls, drafts included.
export async function listMyCalls(publisherId: string): Promise<Call[]> {
  const { data, error } = await supabase
    .from("calls")
    .select(CALL_COLUMNS)
    .eq("publisher_id", publisherId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as CallRow[]).map(toCall);
}

export async function getCall(id: string): Promise<Call> {
  const { data, error } = await supabase.from("calls").select(CALL_COLUMNS).eq("id", id).single();
  if (error) throw error;
  return toCall(data as unknown as CallRow);
}

export async function saveCall(id: string | null, input: CallInput): Promise<string> {
  const { data, error } = await supabase.rpc("save_call", {
    call_id: id,
    title: input.title,
    description: input.description,
    opens_at: input.opensAt,
    closes_at: input.closesAt,
    accepted_languages: input.acceptedLanguages,
    req_full_manuscript: input.requirements.fullManuscript,
    req_synopsis: input.requirements.synopsis,
    req_sample: input.requirements.sample,
    req_genre: input.requirements.genre,
    req_author_intro: input.requirements.authorIntro,
    genre_ids: input.genreIds,
  });
  if (error) throw error;
  return data as string;
}

export async function publishCall(id: string): Promise<void> {
  const { error } = await supabase.rpc("publish_call", { call_id: id });
  if (error) throw error;
}

export async function cancelCall(id: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_call", { call_id: id });
  if (error) throw error;
}

export async function listGenres(): Promise<Genre[]> {
  const { data, error } = await supabase.from("genres").select("id, code, name_ro, name_en").order("name_en");
  if (error) throw error;
  return data;
}
