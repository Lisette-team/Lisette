import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import type { PostCard } from "@/features/community/api";

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
// The permission rules live in the database and are covered by community_permissions.test.sql;
// these tests check what the screens send and show.
jest.mock("@/features/community/api", () => ({
  ...jest.requireActual("@/features/community/api"),
  feedPage: jest.fn(),
  getPost: jest.fn(),
  getComments: jest.fn(),
  createPost: jest.fn(),
  editPost: jest.fn(),
  deletePost: jest.fn(),
  deleteComment: jest.fn(),
  setReaction: jest.fn(),
  addComment: jest.fn(),
  isFollowing: jest.fn(),
  setFollow: jest.fn(),
  searchPublicWorks: jest.fn(),
  accountName: jest.fn(),
  imageUrl: (path: string) => `https://media.test/${path}`,
}));

const api = jest.requireMock("@/features/community/api") as Record<string, jest.Mock>;

// The fake signs its first user in as "user-1".
const ME = "user-1";

function post(overrides: Partial<PostCard> = {}): PostCard {
  return {
    id: "p1",
    accountId: "ana",
    authorName: "Ana",
    authorKind: null,
    createdAt: "2026-11-10T10:00:00Z",
    updatedAt: "2026-11-10T10:00:00Z",
    body: "Primul meu text",
    workId: null,
    workTitle: null,
    images: [],
    reactions: {},
    myReaction: null,
    commentCount: 0,
    reshareOf: null,
    source: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDeviceStorage.clear();
  mockDeviceStorage.set("lisette.locale", "en");
  mockSupabase = createFakeSupabase();
  api.feedPage.mockResolvedValue([]);
  api.getComments.mockResolvedValue([]);
  api.isFollowing.mockResolvedValue(false);
  api.setReaction.mockResolvedValue(undefined);
  api.setFollow.mockResolvedValue(undefined);
  api.searchPublicWorks.mockResolvedValue([]);
  api.accountName.mockResolvedValue("Me");
});

function signedIn(initialUrl: string) {
  const user = mockSupabase.addVerifiedUser("reader@example.test", "correct-horse-1", "en");
  mockSupabase.signInAs(user.email);
  return renderRouter("./src/app", { initialUrl });
}

describe("home feed", () => {
  test("shows posts of followed accounts", async () => {
    api.feedPage.mockResolvedValue([post()]);
    await signedIn("/home");

    expect(await screen.findByText("Primul meu text")).toBeOnTheScreen();
    expect(screen.getByText("Ana")).toBeOnTheScreen();
  });

  test("suggests following people when the feed is empty", async () => {
    await signedIn("/home");

    expect(await screen.findByText("All quiet on the shelf for now")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Discover accounts" })).toBeOnTheScreen();
  });
});

describe("feed reactions", () => {
  test("reacts from the feed card without opening the post", async () => {
    api.feedPage.mockResolvedValue([post()]);
    api.setReaction.mockResolvedValue(undefined);
    const app = await signedIn("/home");

    await fireEvent.press(await screen.findByRole("button", { name: "React" }));
    await fireEvent.press(screen.getByRole("button", { name: "Love it" }));

    await waitFor(() => expect(api.setReaction).toHaveBeenCalledWith("p1", "love"));
    expect(screen.getByRole("button", { name: "Love it" })).toBeSelected();
    expect(app.getPathname()).toBe("/home");
  });
});

describe("feed menu", () => {
  test("the creator deletes their own post from the feed, after confirming", async () => {
    api.feedPage.mockResolvedValue([post({ accountId: ME })]);
    api.deletePost.mockResolvedValue(undefined);
    await signedIn("/home");

    await fireEvent.press(await screen.findByRole("button", { name: "More options" }));
    await fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    expect(api.deletePost).not.toHaveBeenCalled();
    expect(screen.getByText("Delete this post?")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() => expect(api.deletePost).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(screen.queryByText("Primul meu text")).toBeNull());
  });

  test("a comment is deleted only after confirming in the dialog", async () => {
    api.getPost.mockResolvedValue(post());
    api.getComments.mockResolvedValue([
      { id: "c1", parentId: null, accountId: ME, authorName: "Me", body: "Al meu", createdAt: "2026-11-10T10:00:00Z", updatedAt: "2026-11-10T10:00:00Z" },
    ]);
    api.deleteComment.mockResolvedValue(undefined);
    await signedIn("/post/p1");

    await fireEvent.press(await screen.findByRole("button", { name: "Delete" }));
    expect(api.deleteComment).not.toHaveBeenCalled();
    expect(screen.getByText("Delete this comment?")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() => expect(api.deleteComment).toHaveBeenCalledWith("c1"));
  });

  test("someone else's post offers Report, not Delete", async () => {
    api.feedPage.mockResolvedValue([post()]);
    await signedIn("/home");

    await fireEvent.press(await screen.findByRole("button", { name: "More options" }));

    expect(screen.getByRole("button", { name: "Report" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });
});

describe("post composer", () => {
  test("publishes text with no work link unless one is chosen", async () => {
    api.createPost.mockResolvedValue("new-post");
    api.getPost.mockResolvedValue(post({ id: "new-post", accountId: ME, body: "Salut" }));
    const app = await signedIn("/create");

    await fireEvent.changeText(await screen.findByLabelText("What do you want to say?"), "Salut");
    await fireEvent.press(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(app.getPathname()).toBe("/post/new-post"));
    expect(api.createPost).toHaveBeenCalledWith(ME, { body: "Salut", images: [], workId: null });
  });

  test("links the work the poster picks", async () => {
    api.createPost.mockResolvedValue("new-post");
    api.getPost.mockResolvedValue(post({ id: "new-post", accountId: ME }));
    api.searchPublicWorks.mockResolvedValue([{ id: "w1", title: "Carte publică" }]);
    await signedIn("/create");

    await fireEvent.changeText(await screen.findByLabelText("What do you want to say?"), "Despre carte");
    await fireEvent.press(screen.getByRole("button", { name: "Linked book" }));
    await fireEvent.changeText(screen.getByLabelText("Search by title"), "Carte");
    await fireEvent.press(await screen.findByRole("button", { name: "Carte publică" }));
    await fireEvent.press(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() =>
      expect(api.createPost).toHaveBeenCalledWith(ME, { body: "Despre carte", images: [], workId: "w1" }),
    );
  });

  test("says when an image could not be uploaded, so nothing was posted", async () => {
    const { ImageUploadError } = jest.requireActual("@/features/community/api");
    api.createPost.mockRejectedValue(new ImageUploadError("network"));
    await signedIn("/create");

    await fireEvent.changeText(await screen.findByLabelText("What do you want to say?"), "Cu poză");
    await fireEvent.press(screen.getByRole("button", { name: "Publish" }));

    expect(
      await screen.findByText("An image couldn't be uploaded, so the post wasn't published. Try again."),
    ).toBeOnTheScreen();
  });

  test("an empty post is not sent", async () => {
    await signedIn("/create");

    await fireEvent.press(await screen.findByRole("button", { name: "Publish" }));

    expect(await screen.findByText("Write something or add an image.")).toBeOnTheScreen();
    expect(api.createPost).not.toHaveBeenCalled();
  });
});

describe("post detail", () => {
  test("a tap on React opens the three reactions; picking one gives it", async () => {
    api.getPost.mockResolvedValueOnce(post()).mockResolvedValue(post({ myReaction: "love", reactions: { love: 1 } }));
    await signedIn("/post/p1");

    await fireEvent.press(await screen.findByRole("button", { name: "React" }));
    expect(screen.getByRole("button", { name: "It was OK" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Didn't like it" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Love it" }));

    await waitFor(() => expect(api.setReaction).toHaveBeenCalledWith("p1", "love"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Love it" })).toBeSelected());
    expect(screen.queryByRole("button", { name: "It was OK" })).toBeNull();
  });

  test("picking your current reaction again takes it back", async () => {
    api.getPost.mockResolvedValue(post({ myReaction: "love", reactions: { love: 1 } }));
    await signedIn("/post/p1");

    await fireEvent.press(await screen.findByRole("button", { name: "Love it" }));
    const options = screen.getAllByRole("button", { name: "Love it" });
    await fireEvent.press(options[options.length - 1]);

    await waitFor(() => expect(api.setReaction).toHaveBeenCalledWith("p1", null));
  });

  test("picking another reaction replaces the current one", async () => {
    api.getPost.mockResolvedValue(post({ myReaction: "love", reactions: { love: 2 } }));
    await signedIn("/post/p1");

    await fireEvent.press(await screen.findByRole("button", { name: "Love it" }));
    await fireEvent.press(screen.getByRole("button", { name: "It was OK" }));

    await waitFor(() => expect(api.setReaction).toHaveBeenCalledWith("p1", "okay"));
  });

  test("a comment is written in the field and sent with the send button", async () => {
    api.getPost.mockResolvedValue(post());
    api.addComment.mockResolvedValue("c9");
    await signedIn("/post/p1");

    await fireEvent.changeText(await screen.findByLabelText("Write a comment"), "Frumos");
    await fireEvent.press(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(api.addComment).toHaveBeenCalledWith("p1", "Frumos", null));
  });

  test("follows the author of someone else's post, with no edit or delete", async () => {
    api.getPost.mockResolvedValue(post());
    await signedIn("/post/p1");

    await fireEvent.press(await screen.findByRole("button", { name: "Follow" }));

    await waitFor(() => expect(api.setFollow).toHaveBeenCalledWith("ana", true));
    await fireEvent.press(screen.getByRole("button", { name: "More options" }));
    expect(screen.getByRole("button", { name: "Report" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  test("the creator can edit and delete their own post", async () => {
    api.getPost.mockResolvedValue(post({ accountId: ME }));
    await signedIn("/post/p1");

    await fireEvent.press(await screen.findByRole("button", { name: "More options" }));
    expect(screen.getByRole("button", { name: "Edit" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Delete" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Follow" })).toBeNull();
  });

  test("a reshare whose source is gone says so instead of showing it", async () => {
    api.getPost.mockResolvedValue(post({ body: "Citiți asta", reshareOf: "gone", source: null }));
    await signedIn("/post/p1");

    expect(await screen.findByText("The original post is no longer available.")).toBeOnTheScreen();
  });

  test("a reshare shows its source with a link to the original post", async () => {
    const source = post({ id: "src", authorName: "Ioana", body: "Primele pagini", authorKind: "literary_magazine" });
    api.getPost.mockResolvedValue(post({ body: "Citiți asta", reshareOf: "src", source }));
    const app = await signedIn("/post/p1");

    expect(await screen.findByText("Primele pagini")).toBeOnTheScreen();
    expect(screen.getByText(/Literary magazine/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("link", { name: "Open the original post" }));
    await waitFor(() => expect(app.getPathname()).toBe("/post/src"));
  });

  test("reshares with an optional comment", async () => {
    api.getPost.mockResolvedValue(post());
    api.createPost.mockResolvedValue("reshare-1");
    await signedIn("/post/p1");

    await fireEvent.press(await screen.findByRole("button", { name: "Reshare" }));
    await fireEvent.changeText(screen.getByLabelText("Add a comment (optional)"), "Citiți");
    await fireEvent.press(screen.getByRole("button", { name: "Reshare now" }));

    await waitFor(() => expect(api.createPost).toHaveBeenCalledWith(ME, { body: "Citiți", reshareOf: "p1" }));
  });
});
