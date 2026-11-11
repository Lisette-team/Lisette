import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

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

beforeEach(() => {
  mockDeviceStorage.clear();
  mockDeviceStorage.set("lisette.locale", "en");
  mockSupabase = createFakeSupabase();
});

function signedIn(authorEnabled: boolean, initialUrl = "/home") {
  const user = mockSupabase.addVerifiedUser("reader@example.test", "correct-horse-1", "en");
  user.authorEnabled = authorEnabled;
  mockSupabase.signInAs(user.email);
  return renderRouter("./src/app", { initialUrl });
}

const tabNames = () => screen.getAllByRole("tab").map((tab) => tab.props.accessibilityLabel);

describe("app_menu", () => {
  test("a reader gets Home, Discover, Library and Profile, around the + button", async () => {
    await signedIn(false);

    expect(await screen.findByRole("tab", { name: "Home" })).toBeOnTheScreen();
    expect(tabNames()).toEqual(["Home", "Discover", "Library", "Profile"]);
    expect(screen.getByRole("button", { name: "Create" })).toBeOnTheScreen();
  });

  test("a writer gets Manuscripts in place of Profile, and Profile from the header", async () => {
    const app = await signedIn(true);

    expect(await screen.findByRole("tab", { name: "Manuscripts" })).toBeOnTheScreen();
    expect(tabNames()).toEqual(["Home", "Discover", "Library", "Manuscripts"]);

    await fireEvent.press(screen.getByRole("button", { name: "Profile" }));
    await waitFor(() => expect(app.getPathname()).toBe("/profile"));
  });

  test("a reader who opens /manuscripts is sent to Profile", async () => {
    const app = await signedIn(false, "/manuscripts");

    await waitFor(() => expect(app.getPathname()).toBe("/profile"));
  });

  test("adding a writer profile from Profile unlocks Manuscripts", async () => {
    const app = await signedIn(false, "/profile");

    await fireEvent.press(await screen.findByRole("button", { name: "Add a writer profile" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Add writer profile" }));

    await waitFor(() => expect(app.getPathname()).toBe("/manuscripts"));
    expect(await screen.findByRole("tab", { name: "Manuscripts" })).toBeOnTheScreen();
    expect(screen.queryByRole("tab", { name: "Profile" })).toBeNull();
  });
});
