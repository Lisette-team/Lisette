import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { createFakeSupabase, type FakeSupabase } from "./helpers/fake-supabase";

// Each test renders the whole router; give slow machines (a dev server running alongside) room.
jest.setTimeout(20_000);

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
let mockWide = false;
jest.mock("@/ui/layout", () => ({ ...jest.requireActual("@/ui/layout"), useWide: () => mockWide }));

beforeEach(() => {
  mockDeviceStorage.clear();
  mockDeviceStorage.set("lisette.locale", "en");
  mockSupabase = createFakeSupabase();
  mockWide = false;
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

describe("wide_screen_shell", () => {
  test("wide screens get the left sidebar instead of the bottom bar", async () => {
    mockWide = true;
    const app = await signedIn(true);

    await waitFor(() => expect(tabNames()).toEqual(["Home", "Discover", "Library", "Manuscripts", "Profile"]));
    expect(screen.getByRole("tab", { name: "Home" })).toBeSelected();
    // No global Create on wide screens: each page has its own action.
    expect(screen.queryByRole("button", { name: "Create" })).toBeNull();

    await fireEvent.press(screen.getByRole("tab", { name: "Library" }));
    await waitFor(() => expect(app.getPathname()).toBe("/library"));
    expect(screen.getByRole("tab", { name: "Library" })).toBeSelected();
  });

  test("a reader's sidebar has no Manuscripts", async () => {
    mockWide = true;
    await signedIn(false);

    await waitFor(() => expect(tabNames()).toEqual(["Home", "Discover", "Library", "Profile"]));
  });

  test("the sidebar stays on screens outside the tabs", async () => {
    mockWide = true;
    await signedIn(false, "/settings");

    await waitFor(() => expect(tabNames()).toEqual(["Home", "Discover", "Library", "Profile"]));
  });
});

describe("wide_screen_pages", () => {
  test("Home shows the wordmark only once, and its own New post action", async () => {
    mockWide = true;
    const app = await signedIn(false);

    await fireEvent.press(await screen.findByRole("button", { name: "New post" }));
    await waitFor(() => expect(app.getPathname()).toBe("/create"));
  });

  test("the Lisette wordmark is not repeated in Home's header", async () => {
    mockWide = true;
    await signedIn(false);

    await screen.findByRole("button", { name: "New post" });
    expect(screen.getAllByText("Lisette")).toHaveLength(1);
  });

  test("the composer highlights no sidebar entry", async () => {
    mockWide = true;
    await signedIn(false, "/create");

    await waitFor(() => expect(tabNames()).toEqual(["Home", "Discover", "Library", "Profile"]));
    for (const tab of screen.getAllByRole("tab")) expect(tab).not.toBeSelected();
  });

  test("phones keep the wordmark and the + button", async () => {
    await signedIn(false);

    expect(await screen.findByText("Lisette")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "New post" })).toBeNull();
    expect(screen.getByRole("button", { name: "Create" })).toBeOnTheScreen();
  });
});
