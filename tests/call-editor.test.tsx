import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";

import type { CallInput } from "@/features/calls/api";

import { createFakeSupabase, type FakeSupabase } from "./helpers/fake-supabase";

const mockDeviceStorage = new Map<string, string>();
let mockSupabase: FakeSupabase;

jest.mock("@/lib/storage", () => ({
  getItem: async (key: string) => mockDeviceStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => void mockDeviceStorage.set(key, value),
  removeItem: async (key: string) => void mockDeviceStorage.delete(key),
}));
jest.mock("@/lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
}));
jest.mock("@/ui/launch-video", () => ({ LaunchVideo: () => null }));
jest.mock("@/features/calls/api", () => ({
  ...jest.requireActual("@/features/calls/api"),
  listMyCalls: jest.fn(async () => []),
  getCall: jest.fn(),
  saveCall: jest.fn(async () => "call-1"),
  publishCall: jest.fn(async () => undefined),
  cancelCall: jest.fn(async () => undefined),
  listGenres: jest.fn(async () => [{ id: "g-poetry", code: "poetry", name_ro: "Poezie", name_en: "Poetry" }]),
}));

const api = jest.requireMock("@/features/calls/api");

beforeEach(() => {
  jest.clearAllMocks();
  mockDeviceStorage.clear();
  mockDeviceStorage.set("lisette.locale", "en");
  mockSupabase = createFakeSupabase();
  const user = mockSupabase.addVerifiedUser("editura@example.test", "correct-horse-1", "en");
  user.kind = "publisher";
  mockSupabase.signInAs(user.email);
});

const lastInput = (): CallInput => api.saveCall.mock.calls.at(-1)[1];

const storedCall = (overrides: object) => ({
  id: "call-9",
  title: "Vechi",
  description: null,
  opens_at: "2026-10-01T00:00:00.000Z",
  closes_at: null,
  accepted_languages: ["ro"],
  req_full_manuscript: true,
  req_synopsis: false,
  req_sample: false,
  req_genre: false,
  req_author_intro: false,
  published_at: "2026-10-01T00:00:00.000Z",
  cancelled_at: null,
  genre_ids: [],
  ...overrides,
});

describe("calls_list", () => {
  test("each call shows its status badge", async () => {
    api.listMyCalls.mockResolvedValueOnce([
      storedCall({ id: "c-1", title: "Debut 2027", closes_at: "2099-11-30T21:59:59.999Z" }),
      storedCall({ id: "c-2", title: "Ciornă de toamnă", published_at: null }),
      storedCall({ id: "c-3", title: "Proză scurtă", cancelled_at: "2026-10-05T00:00:00.000Z" }),
    ]);
    await renderRouter("./src/app", { initialUrl: "/calls" });

    const row = async (title: string) => within(await screen.findByRole("button", { name: new RegExp(title) }));
    expect((await row("Debut 2027")).getByLabelText("Status: Open")).toBeOnTheScreen();
    expect((await row("Ciornă de toamnă")).getByLabelText("Status: Draft")).toBeOnTheScreen();
    expect((await row("Ciornă de toamnă")).getByText("Always open")).toBeOnTheScreen();
    expect((await row("Proză scurtă")).getByLabelText("Status: Cancelled")).toBeOnTheScreen();
  });
});

describe("call_editor", () => {
  test("saving a new call sends what was typed and ticked", async () => {
    await renderRouter("./src/app", { initialUrl: "/call/new" });

    await fireEvent.changeText(await screen.findByLabelText("Title"), "Concurs de poezie");
    await fireEvent.changeText(screen.getByLabelText("Description"), "Trimite trei poezii.");
    await fireEvent.press(screen.getByRole("checkbox", { name: "Synopsis" }));
    await fireEvent.press(await screen.findByRole("checkbox", { name: "Poetry" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(api.saveCall).toHaveBeenCalledTimes(1));
    expect(api.saveCall.mock.calls[0][0]).toBeNull();
    expect(lastInput()).toEqual({
      title: "Concurs de poezie",
      description: "Trimite trei poezii.",
      opensAt: null,
      closesAt: null,
      acceptedLanguages: ["ro"],
      requirements: { fullManuscript: true, synopsis: true, sample: false, genre: false, authorIntro: false },
      genreIds: ["g-poetry"],
    });
  });

  test("a deadline closes the call at the end of that day", async () => {
    await renderRouter("./src/app", { initialUrl: "/call/new" });

    await fireEvent.changeText(await screen.findByLabelText("Title"), "Cu termen");
    await fireEvent.press(screen.getByRole("checkbox", { name: "Always open" }));
    await fireEvent.changeText(screen.getByLabelText("Deadline"), "2027-01-31");
    await fireEvent.press(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(api.saveCall).toHaveBeenCalled());
    expect(lastInput().closesAt).toBe(new Date(2027, 0, 31, 23, 59, 59, 999).toISOString());
  });

  test("Publish is offered only after the first save", async () => {
    await renderRouter("./src/app", { initialUrl: "/call/new" });

    await fireEvent.changeText(await screen.findByLabelText("Title"), "Apel");
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Save draft" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Publish" }));

    await waitFor(() => expect(api.publishCall).toHaveBeenCalledWith("call-1"));
  });

  test("a cancelled call is read-only", async () => {
    api.getCall.mockResolvedValue(storedCall({ cancelled_at: "2026-10-05T00:00:00.000Z" }));
    await renderRouter("./src/app", { initialUrl: "/call/call-9" });

    expect(await screen.findByText("Cancelled. This call can no longer be changed.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel this call" })).toBeNull();
    expect(screen.getByLabelText("Title").props.editable).toBe(false);
  });

  test("cancelling asks twice, then leaves the call read-only", async () => {
    api.getCall.mockResolvedValue(storedCall({}));
    await renderRouter("./src/app", { initialUrl: "/call/call-9" });

    expect(await screen.findByLabelText("Status: Open")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Cancel this call" }));
    expect(screen.getByText(/Press again to cancel/)).toBeOnTheScreen();
    expect(api.cancelCall).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Cancel this call" }));
    expect(await screen.findByText("Cancelled. This call can no longer be changed.")).toBeOnTheScreen();
    expect(api.cancelCall).toHaveBeenCalledWith("call-9");
    expect(screen.queryByRole("button", { name: "Cancel this call" })).toBeNull();
  });

  test("Publish saves the latest edits first", async () => {
    await renderRouter("./src/app", { initialUrl: "/call/new" });

    await fireEvent.changeText(await screen.findByLabelText("Title"), "Prima variantă");
    await fireEvent.press(screen.getByRole("button", { name: "Save draft" }));
    await fireEvent.changeText(screen.getByLabelText("Title"), "Varianta corectată");
    await fireEvent.press(await screen.findByRole("button", { name: "Publish" }));

    await waitFor(() => expect(api.publishCall).toHaveBeenCalledWith("call-1"));
    expect(api.saveCall).toHaveBeenLastCalledWith("call-1", expect.objectContaining({ title: "Varianta corectată" }));
    expect(api.saveCall.mock.invocationCallOrder.at(-1)).toBeLessThan(api.publishCall.mock.invocationCallOrder[0]);
  });

  test("a call that fails to load shows no form to save over it", async () => {
    api.getCall.mockRejectedValue(new Error("offline"));
    await renderRouter("./src/app", { initialUrl: "/call/call-9" });

    expect(await screen.findByText("You seem to be offline. Check your connection and try again.")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  test("a deadline before the start is not saved", async () => {
    await renderRouter("./src/app", { initialUrl: "/call/new" });

    await fireEvent.changeText(await screen.findByLabelText("Title"), "Greșit");
    await fireEvent.changeText(screen.getByLabelText("Starts on"), "2027-03-10");
    await fireEvent.press(screen.getByRole("checkbox", { name: "Always open" }));
    await fireEvent.changeText(screen.getByLabelText("Deadline"), "2027-03-01");
    await fireEvent.press(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByText("The deadline must come after the start.")).toBeOnTheScreen();
    expect(api.saveCall).not.toHaveBeenCalled();
  });

  test("an empty title or no language is not saved", async () => {
    await renderRouter("./src/app", { initialUrl: "/call/new" });

    await fireEvent.press(await screen.findByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Fill in all the fields.")).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText("Title"), "Fără limbă");
    await fireEvent.press(screen.getByRole("checkbox", { name: "Română" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save draft" }));
    expect(api.saveCall).not.toHaveBeenCalled();
  });
});
