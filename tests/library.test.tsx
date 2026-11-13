import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import type { Book, LibraryEntry } from "@/features/library/api";

import { createFakeSupabase, type FakeSupabase } from "./helpers/fake-supabase";

// Each test renders the whole router; give slow machines (a dev server running alongside) room.
jest.setTimeout(20_000);

const mockDeviceStorage = new Map<string, string>();
let mockSupabase: FakeSupabase;

type Permission = { granted: boolean; canAskAgain: boolean; status: string };
let mockPermission: Permission | null;
const mockRequestPermission = jest.fn();
let mockOnScan: ((result: { data: string; type: string }) => void) | undefined;
let mockCameraProps: { barcodeScannerSettings?: { barcodeTypes?: string[] } } | undefined;

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
// Phone layout unless a test switches to the wide (web/tablet) one.
let mockWide = false;
jest.mock("@/ui/layout", () => ({ ...jest.requireActual("@/ui/layout"), useWide: () => mockWide }));
// The camera is replaced by a stand-in that hands its barcode callback to the test.
jest.mock("expo-camera", () => ({
  useCameraPermissions: () => [mockPermission, mockRequestPermission],
  CameraView: (props: {
    onBarcodeScanned?: (result: { data: string; type: string }) => void;
    barcodeScannerSettings?: { barcodeTypes?: string[] };
  }) => {
    mockOnScan = props.onBarcodeScanned;
    mockCameraProps = props;
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
  findSimilarWorks: jest.fn(),
  createCatalogueWork: jest.fn(),
  createWithIsbn: jest.fn(),
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
  mockWide = false;
  api.myLibrary.mockResolvedValue([]);
  api.followedLibrary.mockResolvedValue([]);
  api.getBook.mockResolvedValue(FOX);
  api.findSimilarWorks.mockResolvedValue([]);
  api.createCatalogueWork.mockResolvedValue("w-new");
  api.createWithIsbn.mockResolvedValue({ status: "created", workId: "w-new", isbnKept: true });
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

  test("the scanner also reacts to product barcodes, not only EAN-13", async () => {
    await signedIn("/book/scan");
    await waitFor(() => expect(mockCameraProps?.barcodeScannerSettings?.barcodeTypes).toEqual(["ean13", "ean8", "upc_a", "upc_e"]));
  });

  test.each([
    ["an EAN-13 product code", "4006381333931", "ean13"],
    ["an EAN-8 code", "96385074", "ean8"],
    ["a UPC-A code", "036000291452", "upc_a"],
    ["a UPC-E code", "04252614", "upc_e"],
  ])("%s is explained as not a book's ISBN", async (_name, code, type) => {
    await signedIn("/book/scan");
    await waitFor(() => expect(mockOnScan).toBeDefined());
    await act(async () => mockOnScan?.({ data: code, type }));

    expect(
      await screen.findByText(
        "This isn't a book's ISBN. Look for the barcode that starts with 978 or 979, usually on the back cover.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText("We couldn't scan that barcode. Try again, or add the book by hand.")).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Add the book by hand" })).toBeOnTheScreen();
    expect(api.lookupIsbn).not.toHaveBeenCalled();
  });

  test("a book code with a wrong check digit shows the failed scan, and Try again scans again", async () => {
    api.lookupIsbn.mockResolvedValue({ status: "found", work: FOX });
    await signedIn("/book/scan");

    await scan("9780140328722");
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

  test("a refused switch is explained inside the sheet", async () => {
    api.myLibrary.mockResolvedValue([entry()]);
    api.setEntryPublic.mockRejectedValue({ code: "22023" });
    await signedIn("/library");

    await fireEvent.press(await screen.findByRole("button", { name: "Amintiri din copilărie" }));
    await fireEvent(screen.getByRole("switch", { name: "Show on my profile" }), "valueChange", true);

    expect(await screen.findByText("A private project can't appear on your profile.")).toBeOnTheScreen();
    expect(screen.getByRole("switch", { name: "Show on my profile" }).props.value).toBe(false);
  });

  test("a book no longer in the library gets its own message", async () => {
    api.myLibrary.mockResolvedValue([entry()]);
    api.setEntryPublic.mockRejectedValue({ code: "P0002" });
    await signedIn("/library");

    await fireEvent.press(await screen.findByRole("button", { name: "Amintiri din copilărie" }));
    await fireEvent(screen.getByRole("switch", { name: "Show on my profile" }), "valueChange", true);

    expect(await screen.findByText("This book is no longer in your library.")).toBeOnTheScreen();
  });

  test("the Read card counts this year's finished books and opens the Read shelf", async () => {
    const year = new Date().getFullYear();
    const last = `${year}-01-20T10:00:00Z`;
    api.myLibrary.mockResolvedValue([
      entry({ workId: "r1", title: "Ion", shelf: "read", updatedAt: last }),
      entry({ workId: "r2", title: "Baltagul", shelf: "read", updatedAt: `${year}-01-05T10:00:00Z` }),
      entry({ workId: "r3", title: "Enigma Otiliei", shelf: "read", updatedAt: `${year - 1}-12-30T10:00:00Z` }),
      entry({ workId: "t1", title: "Amintiri din copilărie" }),
    ]);
    await signedIn("/library");

    const date = new Date(last).toLocaleDateString("en", { day: "numeric", month: "long" });
    expect(await screen.findByText(`2 books in ${year}, the last on ${date}`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: `Read. 2 books in ${year}, the last on ${date}` }));

    expect(await screen.findByText("Baltagul")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Amintiri din copilărie" })).toBeNull();
  });

  test("a failed load of the library is shown, not hidden", async () => {
    api.myLibrary.mockRejectedValue(new Error("offline"));
    api.followedLibrary.mockRejectedValue(new Error("offline"));
    await signedIn("/library");

    expect(await screen.findByText("You seem to be offline. Check your connection and try again.")).toBeOnTheScreen();
  });

  test("a lookup that ends after leaving the scanner does not open manual add", async () => {
    let answer: (value: unknown) => void = () => undefined;
    api.lookupIsbn.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const app = await signedIn("/library");

    await fireEvent.press((await screen.findAllByRole("button", { name: "Scan a book" }))[0]);
    await scan("9780140328721");
    await screen.findByText("Looking up the book by ISBN");
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(app.getPathname()).toBe("/library"));

    await act(async () => answer({ status: "not_found" }));
    expect(app.getPathname()).toBe("/library");
  });

  test("on wide screens the library is the S-60 web layout: bookcase, Read count and manual add", async () => {
    mockWide = true;
    const year = new Date().getFullYear();
    api.myLibrary.mockResolvedValue([
      entry(),
      entry({ workId: "r1", title: "Ion", shelf: "read", updatedAt: `${year}-02-01T10:00:00Z` }),
    ]);
    const app = await signedIn("/library");

    expect(await screen.findByText(`Read in ${year}: 1 book`)).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Library" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Scan a book" })).toBeNull();

    // Each spine opens the entry's controls.
    await fireEvent.press(await screen.findByRole("button", { name: "Amintiri din copilărie" }));
    expect(screen.getByRole("switch", { name: "Show on my profile" })).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole("button", { name: "Close" }).at(-1)!);

    await fireEvent.press(screen.getByRole("button", { name: "Add the book by hand" }));
    await waitFor(() => expect(app.getPathname()).toBe("/book/add"));
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
    await waitFor(() => expect(api.createCatalogueWork).toHaveBeenCalledWith("Anotimpul cenușiu", ["Elena Dobre"]));
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

    await waitFor(() => expect(api.createCatalogueWork).toHaveBeenCalledWith("Anotimpul cenușiu", ["Elena Dobre"]));
    await waitFor(() => expect(api.saveBook).toHaveBeenCalledWith("w-new", "to_read"));
    expect(api.saveBook).not.toHaveBeenCalledWith("w-old", expect.anything());
  });

  test("a typed ISBN is looked up first, and the book found is offered with the similar ones", async () => {
    api.lookupIsbn.mockResolvedValue({ status: "found", work: FOX });
    api.findSimilarWorks.mockResolvedValue([SIMILAR]);
    await fillManualAdd("Mr Fox", "Dahl", "0-14-032872-6");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.lookupIsbn).toHaveBeenCalledWith("9780140328721"));
    expect(await screen.findByRole("button", { name: "Fantastic Mr Fox, Roald Dahl" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Anotimpul cenușiu, Elena Dobre" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Fantastic Mr Fox, Roald Dahl" }));
    await waitFor(() => expect(api.saveBook).toHaveBeenCalledWith("w-fox", "to_read"));
    expect(api.createCatalogueWork).not.toHaveBeenCalled();
  });

  test("an ISBN Open Library does not know stays on the new book", async () => {
    api.lookupIsbn.mockResolvedValue({ status: "not_found" });
    await fillManualAdd("Iarna lungă", "Dan Ilie", "978-0-306-40615-7");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    // The server checks the ISBN again and attaches it; the app never sends it with the book.
    await waitFor(() => expect(api.createWithIsbn).toHaveBeenCalledWith("9780306406157", "Iarna lungă", ["Dan Ilie"]));
    await waitFor(() => expect(api.saveBook).toHaveBeenCalledWith("w-new", "to_read"));
    expect(api.createCatalogueWork).not.toHaveBeenCalled();
  });

  test("a book found by the server at the last moment is offered instead of created", async () => {
    api.lookupIsbn.mockResolvedValue({ status: "not_found" });
    api.createWithIsbn.mockResolvedValue({ status: "found", work: FOX });
    await fillManualAdd("Mr Fox", "Dahl", "9780140328721");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("button", { name: "Fantastic Mr Fox, Roald Dahl" })).toBeOnTheScreen();
    expect(api.saveBook).not.toHaveBeenCalled();
  });

  test("choosing a new book over the one found by its ISBN saves it without the ISBN, and says why", async () => {
    api.lookupIsbn.mockResolvedValue({ status: "found", work: FOX });
    const app = await fillManualAdd("Mr Fox", "Dahl", "9780140328721");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    await fireEvent.press(await screen.findByRole("button", { name: "No, it's a new book" }));

    await waitFor(() => expect(api.createCatalogueWork).toHaveBeenCalledWith("Mr Fox", ["Dahl"]));
    expect(api.createWithIsbn).not.toHaveBeenCalled();
    await waitFor(() => expect(app.getPathname()).toBe("/library"));
    expect(
      await screen.findByText("Book saved without the ISBN: it already belongs to the book we showed you."),
    ).toBeOnTheScreen();
  });

  test("when the ISBN cannot be checked, the book is saved without it and the person is told", async () => {
    api.lookupIsbn.mockResolvedValue({ status: "unavailable" });
    api.createWithIsbn.mockResolvedValue({ status: "created", workId: "w-new", isbnKept: false });
    const app = await fillManualAdd("Iarna lungă", "Dan Ilie", "9780306406157");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.createWithIsbn).toHaveBeenCalledWith("9780306406157", "Iarna lungă", ["Dan Ilie"]));
    await waitFor(() => expect(api.saveBook).toHaveBeenCalledWith("w-new", "to_read"));
    await waitFor(() => expect(app.getPathname()).toBe("/library"));
    expect(
      await screen.findByText("Book saved without its ISBN, because we couldn't check it right now."),
    ).toBeOnTheScreen();
  });

  test("a prefilled ISBN from a failed lookup is looked up again on Save", async () => {
    api.lookupIsbn.mockResolvedValue({ status: "not_found" });
    const app = await signedIn("/book/add?isbn=9780306406157&reason=unavailable");
    await fireEvent.changeText(await screen.findByLabelText("Title"), "Iarna lungă");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.lookupIsbn).toHaveBeenCalledWith("9780306406157"));
    await waitFor(() => expect(api.createWithIsbn).toHaveBeenCalledWith("9780306406157", "Iarna lungă", []));
    await waitFor(() => expect(app.getPathname()).toBe("/library"));
  });

  test("without an ISBN, nothing is looked up", async () => {
    await fillManualAdd("Carte", "Autor");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.createCatalogueWork).toHaveBeenCalled());
    expect(api.lookupIsbn).not.toHaveBeenCalled();
  });

  test("an ISBN that is not valid is refused before anything is saved", async () => {
    await fillManualAdd("Carte", "Autor", "978-0-14-032872-2");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("This ISBN doesn't look right. Check the digits or leave it empty.")).toBeOnTheScreen();
    expect(api.findSimilarWorks).not.toHaveBeenCalled();
    expect(api.createCatalogueWork).not.toHaveBeenCalled();
  });

  test("with only a valid ISBN, the book found is offered", async () => {
    api.lookupIsbn.mockResolvedValue({ status: "found", work: FOX });
    await fillManualAdd("", "", "9780140328721");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    await fireEvent.press(await screen.findByRole("button", { name: "Fantastic Mr Fox, Roald Dahl" }));
    await waitFor(() => expect(api.saveBook).toHaveBeenCalledWith("w-fox", "to_read"));
    expect(api.createCatalogueWork).not.toHaveBeenCalled();
    expect(api.findSimilarWorks).not.toHaveBeenCalled();
  });

  test("with only an ISBN Open Library does not know, the title is asked for", async () => {
    api.lookupIsbn.mockResolvedValue({ status: "not_found" });
    const app = await fillManualAdd("", "", "9780306406157");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("We couldn't find this book by its ISBN. Add the title and author."),
    ).toBeOnTheScreen();
    expect(api.createCatalogueWork).not.toHaveBeenCalled();
    expect(app.getPathname()).toBe("/book/add");
  });

  test("with only an ISBN that cannot be checked now, the title is asked for", async () => {
    api.lookupIsbn.mockResolvedValue({ status: "unavailable" });
    await fillManualAdd("", "", "9780306406157");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("We couldn't check the ISBN right now. Write the title to add the book.")).toBeOnTheScreen();
    expect(api.createCatalogueWork).not.toHaveBeenCalled();
  });

  test("the ISBN field says at once whether the digits form an ISBN", async () => {
    await fillManualAdd("", "", "978-0-14-032872-2");
    expect(screen.getByText("These digits don't form a valid ISBN. Check them.")).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText("ISBN (optional)"), "978-0-14-032872-1");
    expect(screen.getByText("Valid ISBN. You can leave the title empty: we'll look it up.")).toBeOnTheScreen();
  });

  test("a title is required", async () => {
    await fillManualAdd("  ", "Autor");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Write the book's title.")).toBeOnTheScreen();
    expect(api.createCatalogueWork).not.toHaveBeenCalled();
  });
});
