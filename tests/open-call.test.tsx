import { Text } from "react-native";
import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

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

jest.mock("@/features/submissions/catalogue-api", () => ({
  ...jest.requireActual("@/features/submissions/catalogue-api"),
  getOpenCall: jest.fn(async (id: string) =>
    id === "c1"
      ? {
          id: "c1",
          publisher_id: "pub-1",
          publisher_name: "Editura Pagina Albă",
          publisher_kind: "publishing_house",
          sharing_policy: "synopsis_approval",
          title: "Concurs de debut",
          description: "Pentru autori fără volum publicat.",
          opens_at: "2026-11-01T00:00:00.000Z",
          closes_at: null,
          accepted_languages: ["ro", "en"],
          req_full_manuscript: true,
          req_synopsis: true,
          req_sample: false,
          req_genre: false,
          req_author_intro: true,
          genre_ids: ["g-novel"],
        }
      : null,
  ),
}));
jest.mock("@/features/calls/api", () => ({
  ...jest.requireActual("@/features/calls/api"),
  listGenres: jest.fn(async () => [{ id: "g-novel", code: "novel", name_ro: "Roman", name_en: "Novel" }]),
}));

async function openAs(author: boolean, url = "/open-call/c1") {
  mockDeviceStorage.set("lisette.locale", "en");
  mockSupabase = createFakeSupabase();
  const user = mockSupabase.addVerifiedUser("person@example.test", "correct-horse-1", "en");
  user.authorEnabled = author;
  mockSupabase.signInAs(user.email);
  // The send flow's first step belongs to another task; only the navigation to it is checked here.
  return renderRouter(
    { appDir: "./src/app", overrides: { "(app)/submit/choose": () => <Text>Choose a manuscript</Text> } },
    { initialUrl: url },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDeviceStorage.clear();
});

describe("open call page", () => {
  test("shows the call, what to send and the publication's sharing rule", async () => {
    await openAs(false);

    expect(await screen.findByRole("header", { name: "Concurs de debut" })).toBeOnTheScreen();
    expect(screen.getByText("Editura Pagina Albă · Publishing house")).toBeOnTheScreen();
    expect(screen.getByText("Always open")).toBeOnTheScreen();
    expect(screen.getByText("Pentru autori fără volum publicat.")).toBeOnTheScreen();
    expect(screen.getByText("Full manuscript")).toBeOnTheScreen();
    expect(screen.getByText("Synopsis")).toBeOnTheScreen();
    expect(screen.getByText("Short author introduction")).toBeOnTheScreen();
    expect(screen.queryByText("Sample chapters")).toBeNull();
    expect(screen.getByText("Genres: Novel")).toBeOnTheScreen();
    expect(screen.getByText(/^Sharing: synopsis approval\. .*Editura Pagina Albă approves/)).toBeOnTheScreen();
  });

  test("a reader gets no send button", async () => {
    await openAs(false);
    await screen.findByRole("header", { name: "Concurs de debut" });

    expect(screen.queryByRole("button", { name: "Send a manuscript" })).toBeNull();
  });

  test("a writer sends from the call", async () => {
    const view = await openAs(true);
    await fireEvent.press(await screen.findByRole("button", { name: "Send a manuscript" }));

    expect(screen).toHavePathname("/submit/choose");
    expect(view.getSearchParams()).toMatchObject({ callId: "c1" });
    expect(await screen.findByText("Choose a manuscript")).toBeOnTheScreen();
  });

  test("a call that is no longer open says so calmly", async () => {
    await openAs(true, "/open-call/gone");

    expect(await screen.findByText("This call isn't open anymore.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Back to Discover" })).toBeOnTheScreen();
  });
});
