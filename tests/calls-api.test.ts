import { callStatus, dayToIso, type Call } from "@/features/calls/api";

const base: Call = {
  id: "c",
  title: "Apel",
  description: null,
  opens_at: "2026-11-01T00:00:00.000Z",
  closes_at: "2026-12-01T00:00:00.000Z",
  accepted_languages: ["ro"],
  req_full_manuscript: true,
  req_synopsis: false,
  req_sample: false,
  req_genre: false,
  req_author_intro: false,
  published_at: "2026-11-01T00:00:00.000Z",
  cancelled_at: null,
  genre_ids: [],
};

describe("dayToIso", () => {
  test("a day starts at local midnight and a deadline ends at its last moment", () => {
    expect(dayToIso("2027-01-31")).toBe(new Date(2027, 0, 31).toISOString());
    expect(dayToIso("2027-01-31", true)).toBe(new Date(2027, 0, 31, 23, 59, 59, 999).toISOString());
  });

  test("an impossible or badly written day is not a date", () => {
    expect(dayToIso("2027-02-30")).toBeNull();
    expect(dayToIso("31.01.2027")).toBeNull();
    expect(dayToIso("")).toBeNull();
  });
});

describe("callStatus", () => {
  const at = (iso: string) => new Date(iso);

  test("follows the call through its life", () => {
    expect(callStatus({ ...base, published_at: null }, at("2026-11-15T00:00:00Z"))).toBe("draft");
    expect(callStatus(base, at("2026-10-15T00:00:00Z"))).toBe("scheduled");
    expect(callStatus(base, at("2026-11-15T00:00:00Z"))).toBe("open");
    expect(callStatus(base, at("2026-12-01T00:00:00Z"))).toBe("closed");
    expect(callStatus({ ...base, cancelled_at: "2026-11-02T00:00:00Z" }, at("2026-11-15T00:00:00Z"))).toBe("cancelled");
  });
});
