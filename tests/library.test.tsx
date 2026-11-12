import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import type { Book, LibraryEntry } from "@/features/library/api";

import { createFakeSupabase, type FakeSupabase } from "./helpers/fake-supabase";

const mockDeviceStorage = new Map<string, string>();
let mockSupabase: FakeSupabase;

type Permission = { granted: boolean; canAskAgain: boolean; status: string };
let mockPermission: Permission | null;
const mockRequestPermission = jest.fn();
let mockOnScan: ((result: { data: string; type: string }) => void) | undefined;

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
// The camera is replaced by a stand-in that hands its barcode callback to the test.
jest.mock("expo-camera", () => ({
  useCameraPermissions: () => [mockPermission, mockRequestPermission],
  CameraView: (props: { onBarcodeScanned?: (result: { data: string; type: string }) => void }) => {
    mockOnScan = props.onBarcodeScanned;
    return null;
  },
}));
// The rules (privacy, blocks, one entry per book, no merging) live in the database and are covered by
// library_is_private_and_scans_recover.test.sql and similar_books_never_merge.test.sql; these tests
// check what the screens send and show.
jest.mock("@/features/library/api", () => ({
  ...jest.requireActual("@/features/library/api"),
  myLibrary: jest.fn(),
  followedLibrary: jest.fn(),
  getBook: jest.fn(),
  lookupIsbn: jest.fn(),
  cachedBook: jest.fn(),
  findSimilarWorks: jest.fn(),
  createCatalogueWork: jest.fn(),
  saveBook: jest.fn(),
  setEntryPublic: jest.fn(),
  setInspiration: jest.fn(),
  removeBook: jest.fn(),
}));

const api = jest.requireMock("@/features/library/api") as Record<string, jest.Mock>;

const FOX: Book = {
  id: "w-fox",
  title: "Fantastic Mr Fox",
  authorNames: ["Roald Dahl"],
  publisherName: "Puffin",
  isbn: "9780140328721",
};

function entry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    workId: "w1",
    title: "Amintiri din copilărie",
    authorNames: ["Ion Creangă"],
    shelf: "to_read",
    isPublic: false,
    isInspiration: false,
    updatedAt: "2026-11-10T10:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDeviceStorage.clear();
  mockDeviceStorage.set("lisette.locale", "en");
  mockSupabase = createFakeSupabase();
  mockPermission = { granted: true, canAskAgain: true, status: "granted" };
  mockOnScan = undefined;
  api.myLibrary.mockResolvedValue([]);
  api.followedLibrary.mockResolvedValue([]);
  api.getBook.mockResolvedValue(FOX);
  api.cachedBook.mockResolvedValue(null);
  api.findSimilarWorks.mockResolvedValue([]);
  api.createCatalogueWork.mockResolvedValue("w-new");
  api.saveBook.mockResolvedValue(undefined);
  api.setEntryPublic.mockResolvedValue(undefined);
  api.setInspiration.mockResolvedValue(undefined);
  api.removeBook.mockResolvedValue(undefined);
});

function signedIn(initialUrl: string, { author = false } = {}) {
  const user = mockSupabase.addVerifiedUser("reader@example.test", "correct-horse-1", "en");
  user.authorEnabled = author;
  mockSupabase.signInAs(user.email);
  return renderRouter("./src/app", { initialUrl });
}

async function scan(code: string) {
  await waitFor(() => expect(mockOnScan).toBeDefined());
  await act(async () => mockOnScan?.({ data: code, type: "ean13" }));
}

describe("library_is_private_and_scans_recover", () => {
  test("the library says it is private and a new entry shows as private", async () => {
    api.myLibrary.mockResolvedValue([entry()]);
    await signedIn("/library");

    expect(await screen.findByText("Amintiri din copilărie")).toBeOnTheScreen();
    expect(screen.getByText("Your library is private. You choose which books appear on your profile.")).toBeOnTheScreen();
    expect(screen.getByText("Private")).toBeOnTheScreen();
    expect(screen.queryByText("On profile")).toBeNull();
  });

  test("an empty shelf invites a scan or a manual add", async () => {
    await signedIn("/library");

    expect(await screen.findByText("This shelf is empty")).toBeOnTheScreen();
    expect(screen.getByText("Scan a barcode or add a book by hand.")).toBeOnTheScreen();
  });

  test("a denied camera opens manual entry", async () => {
    mockPermission = { granted: false, canAskAgain: false, status: "denied" };
    const app = await signedIn("/book/scan");

    expect(await screen.findByText("The camera is off")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Add the book by hand" }));

    await waitFor(() => expect(app.getPathname()).toBe("/book/add"));
    expect(screen.getByLabelText("Title")).toBeOnTheScreen();
  });

  test("an undecided camera permission is asked for", async () => {
    mockPermission = { granted: false, canAskAgain: true, status: "undetermined" };
    mockRequestPermission.mockResolvedValue({ granted: false, canAskAgain: true, status: "denied" });
    await signedIn("/book/scan");

    await waitFor(() => expect(mockRequestPermission).toHaveBeenCalledTimes(1));
  });

  test("a scan looks the book up once, however often the camera reports it", async () => {
    let answer: (value: unknown) => void = () => undefined;
    api.lookupIsbn.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const app = await signedIn("/book/scan");

    await scan("9780140328721");
    await scan("9780140328721");
    await scan("9780140328721");

    expect(await screen.findByText("Looking up the book by ISBN")).toBeOnTheScreen();
    expect(api.lookupIsbn).toHaveBeenCalledTimes(1);
    expect(api.lookupIsbn).toHaveBeenCalledWith("9780140328721");

    await act(async () => answer({ status: "found", work: FOX }));
    await waitFor(() => expect(app.getPathname()).toBe("/book/add"));
    expect(await screen.findByText("Fantastic Mr Fox")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.saveBook).toHaveBeenCalledWith("w-fox", "to_read"));
    expect(api.createCatalogueWork).not.toHaveBeenCalled();
    await waitFor(() => expect(app.getPathname()).toBe("/library"));
  });

  test("scanning a book already in the library opens it on its current shelf", async () => {
    api.lookupIsbn.mockResolvedValue({ status: "found", work: FOX });
    api.myLibrary.mockResolvedValue([entry({ workId: "w-fox", title: "Fantastic Mr Fox", shelf: "reading" })]);
    await signedIn("/book/scan");

    await scan("9780140328721");
    await waitFor(() => expect(screen.getByRole("button", { name: "Currently reading" })).toBeSelected());

    await fireEvent.press(screen.getByRole("button", { name: "Read" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.saveBook).toHaveBeenCalledWith("w-fox", "read"));
  });

  test("a barcode that is not an ISBN shows the failed scan, and Try again scans again", async () => {
    api.lookupIsbn.mockResolvedValue({ status: "found", work: FOX });
    await signedIn("/book/scan");

    await scan("4006381333931");
    expect(await screen.findByText("We couldn't scan that barcode. Try again, or add the book by hand.")).toBeOnTheScreen();
    expect(api.lookupIsbn).not.toHaveBeenCalled();

    await scan("9780140328721");
    expect(api.lookupIsbn).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(screen.queryByText("We couldn't scan that barcode. Try again, or add the book by hand.")).toBeNull();
    await scan("9780140328721");
    await waitFor(() => expect(api.lookupIsbn).toHaveBeenCalledWith("9780140328721"));
  });

  test("an unknown ISBN offers manual add without inventing a title", async () => {
    api.lookupIsbn.mockResolvedValue({ status: "not_found" });
    const app = await signedIn("/book/scan");

    await scan("9786069999127");

    await waitFor(() => expect(app.getPathname()).toBe("/book/add"));
    expect(await screen.findByText("We couldn't find this book by its ISBN. Add the title and author.")).toBeOnTheScreen();
    expect(screen.getByLabelText("Title").props.value).toBe("");
    expect(screen.getByLabelText("ISBN (optional)").props.value).toBe("9786069999127");
    expect(api.createCatalogueWork).not.toHaveBeenCalled();
  });

  test("when the lookup is unavailable the book can still be added by hand", async () => {
    api.lookupIsbn.mockResolvedValue({ status: "unavailable" });
    await signedIn("/book/scan");

    await scan("9780140328721");

    expect(
      await screen.findByText("Looking up books by ISBN isn't working right now. You can add the book by hand."),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Title").props.value).toBe("");
  });

  test("an entry is shown on the profile only when its owner switches it on", async () => {
    api.myLibrary.mockResolvedValue([entry()]);
    await signedIn("/library");

    await fireEvent.press(await screen.findByRole("button", { name: "Amintiri din copilărie" }));
    expect(screen.getByText("Off. Only you see this book.")).toBeOnTheScreen();
    await fireEvent(screen.getByRole("switch", { name: "Show on my profile" }), "valueChange", true);

    await waitFor(() => expect(api.setEntryPublic).toHaveBeenCalledWith("w1", true));
  });

  test("the entry moves to another shelf", async () => {
    api.myLibrary.mockResolvedValue([entry()]);
    await signedIn("/library");

    await fireEvent.press(await screen.findByRole("button", { name: "Amintiri din copilărie" }));
    const sheetShelves = screen.getAllByRole("button", { name: "Read" });
    await fireEvent.press(sheetShelves[sheetShelves.length - 1]);

    await waitFor(() => expect(api.saveBook).toHaveBeenCalledWith("w1", "read"));
  });

  test("only authors see the Inspiration mark", async () => {
    api.myLibrary.mockResolvedValue([entry()]);
    await signedIn("/library", { author: true });

    await fireEvent.press(await screen.findByRole("button", { name: "Amintiri din copilărie" }));
    await fireEvent(screen.getByRole("switch", { name: "Inspiration" }), "valueChange", true);

    await waitFor(() => expect(api.setInspiration).toHaveBeenCalledWith("w1", true));
  });

  test("a reader has no Inspiration mark", async () => {
    api.myLibrary.mockResolvedValue([entry()]);
    await signedIn("/library");

    await fireEvent.press(await screen.findByRole("button", { name: "Amintiri din copilărie" }));
    expect(screen.queryByRole("switch", { name: "Inspiration" })).toBeNull();
  });

  test("removing a book asks first and says the book stays on Lisette", async () => {
    api.myLibrary.mockResolvedValue([entry()]);
    await signedIn("/library");

    await fireEvent.press(await screen.findByRole("button", { name: "Amintiri din copilărie" }));
    await fireEvent.press(screen.getByRole("button", { name: "Remove from library" }));
    expect(api.removeBook).not.toHaveBeenCalled();
    expect(screen.getByText("The book stays on Lisette. Only your entry goes.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Yes, remove" }));

    await waitFor(() => expect(api.removeBook).toHaveBeenCalledWith("w1"));
    await waitFor(() => expect(screen.queryByText("Amintiri din copilărie")).toBeNull());
  });

  test("public entries of followed authors appear in their own strip", async () => {
    api.followedLibrary.mockResolvedValue([
      { accountId: "a1", name: "Ioana Mareș", workId: "w9", title: "Apa de sub pod", authorNames: [], shelf: "reading", updatedAt: "2026-11-10T10:00:00Z" },
      { accountId: "a2", name: "Mara Toma", workId: "w8", title: "Iarna lungă", authorNames: [], shelf: "read", updatedAt: "2026-11-09T10:00:00Z" },
    ]);
    await signedIn("/library");

    expect(await screen.findByText("What the authors you follow are reading")).toBeOnTheScreen();
    expect(screen.getByText("Ioana Mareș is reading")).toBeOnTheScreen();
    expect(screen.getByText("Mara Toma finished it")).toBeOnTheScreen();
    expect(screen.getAllByText("Public")).toHaveLength(2);
  });

  test("no strip when no followed author shares a book", async () => {
    await signedIn("/library");

    await screen.findByText("This shelf is empty");
    expect(screen.queryByText("What the authors you follow are reading")).toBeNull();
  });
});

describe("similar_books_never_merge", () => {
  async function fillManualAdd(title: string, author: string, isbn = "") {
    const app = await signedIn("/book/add");
    await fireEvent.changeText(await screen.findByLabelText("Title"), title);
    await fireEvent.changeText(screen.getByLabelText("Author"), author);
    if (isbn) await fireEvent.changeText(screen.getByLabelText("ISBN (optional)"), isbn);
    return app;
  }

  const SIMILAR: Book = { id: "w-old", title: "Anotimpul cenușiu", authorNames: ["Elena Dobre"], publisherName: null, isbn: null };

  test("with no similar book, Save creates the book and saves it at once", async () => {
    const app = await fillManualAdd("Anotimpul cenușiu", "Elena Dobre");
    await fireEvent.press(screen.getByRole("button", { name: "Currently reading" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.findSimilarWorks).toHaveBeenCalledWith("Anotimpul cenușiu", "Elena Dobre"));
    await waitFor(() => expect(api.createCatalogueWork).toHaveBeenCalledWith("Anotimpul cenușiu", ["Elena Dobre"], null));
    await waitFor(() => expect(api.saveBook).toHaveBeenCalledWith("w-new", "reading"));
    await waitFor(() => expect(app.getPathname()).toBe("/library"));
  });

  test("a near-identical title is suggested and picking it saves that book", async () => {
    api.findSimilarWorks.mockResolvedValue([SIMILAR]);
    await fillManualAdd("Anotimpul cenusiu", "Elena Dobre");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Is this the book?")).toBeOnTheScreen();
    expect(api.createCatalogueWork).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Anotimpul cenușiu, Elena Dobre" }));

    await waitFor(() => expect(api.saveBook).toHaveBeenCalledWith("w-old", "to_read"));
    expect(api.createCatalogueWork).not.toHaveBeenCalled();
  });

  test("choosing a new book creates a second, separate book", async () => {
    api.findSimilarWorks.mockResolvedValue([SIMILAR]);
    await fillManualAdd("Anotimpul cenușiu", "Elena Dobre");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    await fireEvent.press(await screen.findByRole("button", { name: "No, it's a new book" }));

    await waitFor(() => expect(api.createCatalogueWork).toHaveBeenCalledWith("Anotimpul cenușiu", ["Elena Dobre"], null));
    await waitFor(() => expect(api.saveBook).toHaveBeenCalledWith("w-new", "to_read"));
    expect(api.saveBook).not.toHaveBeenCalledWith("w-old", expect.anything());
  });

  test("a book already on Lisette with the typed ISBN is offered first", async () => {
    api.cachedBook.mockResolvedValue(FOX);
    await fillManualAdd("Mr Fox", "Dahl", "0-14-032872-6");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.cachedBook).toHaveBeenCalledWith("9780140328721"));
    expect(await screen.findByRole("button", { name: "Fantastic Mr Fox, Roald Dahl" })).toBeOnTheScreen();
  });

  test("an ISBN that is not valid is refused before anything is saved", async () => {
    await fillManualAdd("Carte", "Autor", "978-0-14-032872-2");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("This ISBN doesn't look right. Check the digits or leave it empty.")).toBeOnTheScreen();
    expect(api.findSimilarWorks).not.toHaveBeenCalled();
    expect(api.createCatalogueWork).not.toHaveBeenCalled();
  });

  test("a title is required", async () => {
    await fillManualAdd("  ", "Autor");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Write the book's title.")).toBeOnTheScreen();
    expect(api.createCatalogueWork).not.toHaveBeenCalled();
  });
});
