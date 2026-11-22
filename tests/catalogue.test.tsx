import * as rntl from "@testing-library/react-native";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { Catalogue } from "@/features/submissions/catalogue";

import { createFakeSupabase, type FakeSupabase } from "./helpers/fake-supabase";
import { SafeArea } from "./helpers/safe-area";

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

const call = (id: string, title: string, closes_at: string | null) => ({
  id,
  publisher_id: "pub-1",
  publisher_name: "Editura Pagina Albă",
  publisher_kind: "publishing_house",
  sharing_policy: "author_controlled",
  title,
  description: null,
  opens_at: "2026-11-01T00:00:00.000Z",
  closes_at,
  accepted_languages: ["ro"],
  req_full_manuscript: true,
  req_synopsis: true,
  req_sample: false,
  req_genre: false,
  req_author_intro: false,
  genre_ids: [],
});

jest.mock("@/features/submissions/catalogue-api", () => ({
  ...jest.requireActual("@/features/submissions/catalogue-api"),
  listOpenCalls: jest.fn(async () => [
    call("c1", "Concurs de debut", "2026-12-01T22:59:59.999Z"),
    call("c2", "Manuscrise de roman", null),
  ]),
  listPublications: jest.fn(async () => [
    {
      id: "pub-1",
      name: "Editura Pagina Albă",
      kind: "publishing_house",
      intro: "Publicăm proză contemporană.",
      logo_path: null,
      genre_ids: ["g-novel"],
      open_call_count: 2,
      languages: ["ro"],
    },
  ]),
}));
jest.mock("@/features/calls/api", () => ({
  ...jest.requireActual("@/features/calls/api"),
  listGenres: jest.fn(async () => [{ id: "g-novel", code: "novel", name_ro: "Roman", name_en: "Novel" }]),
}));

const api = jest.requireMock("@/features/submissions/catalogue-api");

beforeEach(async () => {
  jest.clearAllMocks();
  mockDeviceStorage.clear();
  mockDeviceStorage.set("lisette.locale", "en");
  mockSupabase = createFakeSupabase();
  const user = mockSupabase.addVerifiedUser("reader@example.test", "correct-horse-1", "en");
  mockSupabase.signInAs(user.email);
  await renderRouter("./src/app", { initialUrl: "/discover" });
});

const filtersOf = (mock: jest.Mock) => mock.mock.calls.at(-1)[0];

describe("catalogue", () => {
  test("Discover opens on Publications, with each publication's genres", async () => {
    expect(await screen.findByText("Publicăm proză contemporană.")).toBeOnTheScreen();
    expect(await screen.findByText("2 open calls")).toBeOnTheScreen();
    expect(screen.getByText("Novel")).toBeOnTheScreen();
    expect(screen.getByText("Romanian")).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Publications", selected: true })).toBeOnTheScreen();
  });

  test("Open calls keeps the server's order and says when a call takes any genre", async () => {
    await fireEvent.press(await screen.findByRole("tab", { name: "Open calls" }));

    const titles = await screen.findAllByText(/Concurs de debut|Manuscrise de roman/);
    expect(titles.map((node) => node.props.children)).toEqual(["Concurs de debut", "Manuscrise de roman"]);
    expect(screen.getByText(/^Always open/)).toBeOnTheScreen();
    expect(screen.getAllByText(/Any genre$/)).toHaveLength(2);
  });

  test("a call opens its own page", async () => {
    await fireEvent.press(await screen.findByRole("tab", { name: "Open calls" }));
    await fireEvent.press(await screen.findByRole("button", { name: /^Concurs de debut/ }));

    expect(screen).toHavePathname("/open-call/c1");
  });

  test("filters are compact pills; choosing in a pill's sheet asks again with that filter", async () => {
    await fireEvent.press(await screen.findByRole("tab", { name: "Open calls" }));
    expect(screen.queryByRole("radio", { name: "English" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Language" }));
    await fireEvent.press(screen.getByRole("radio", { name: "English" }));

    await waitFor(() => expect(filtersOf(api.listOpenCalls)).toMatchObject({ language: "en" }));
    expect(screen.getByRole("button", { name: "Language: English" })).toBeOnTheScreen();
  });

  test("a publication opens its own open calls", async () => {
    await fireEvent.press(await screen.findByRole("button", { name: /^Editura Pagina Albă/ }));

    await waitFor(() => expect(filtersOf(api.listOpenCalls)).toMatchObject({ publisherId: "pub-1" }));
    expect(screen.getByRole("tab", { name: "Open calls", selected: true })).toBeOnTheScreen();
    expect(await screen.findByText("Calls from Editura Pagina Albă")).toBeOnTheScreen();
  });

  test("a publication with no open calls says so calmly", async () => {
    api.listOpenCalls.mockResolvedValueOnce([]);
    await fireEvent.press(await screen.findByRole("button", { name: /^Editura Pagina Albă/ }));

    expect(await screen.findByText("Editura Pagina Albă isn't taking manuscripts right now.")).toBeOnTheScreen();
  });

  test("a reader browses without checkboxes", async () => {
    await fireEvent.press(await screen.findByRole("tab", { name: "Open calls" }));
    await screen.findByText("Concurs de debut");

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});

describe("catalogue in the composer", () => {
  test("ticks calls by call id and reports each tap", async () => {
    const onToggle = jest.fn();
    const selected = new Map([["c1", (await api.listOpenCalls())[0]]]);
    const view = await rntl.render(<Catalogue initialTab="calls" selectable={{ selected, onToggle }} />, {
      wrapper: SafeArea,
    });

    expect(await view.findAllByRole("checkbox")).toHaveLength(2);
    expect(
      view.getByRole("checkbox", {
        name: "Concurs de debut, Editura Pagina Albă",
      }).props.accessibilityState.checked,
    ).toBe(true);
    await rntl.fireEvent.press(view.getByRole("checkbox", { name: /^Manuscrise de roman/ }));
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: "c2" }));
  });

  test("tapping a call's row ticks it too, instead of opening the call", async () => {
    const onToggle = jest.fn();
    const view = await rntl.render(<Catalogue initialTab="calls" selectable={{ selected: new Map(), onToggle }} />, {
      wrapper: SafeArea,
    });

    await rntl.fireEvent.press(await view.findByRole("checkbox", { name: /^Concurs de debut/ }));
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }));
  });
});
