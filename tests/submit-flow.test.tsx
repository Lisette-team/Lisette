import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";

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
jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ name: "sinopsis.pdf", uri: "file:///sinopsis.pdf", mimeType: "application/pdf" }],
  })),
}));
jest.mock("@/features/manuscripts/device-auth", () => ({ confirmPrivateAction: jest.fn(async () => "confirmed") }));

const openCall = (id: string, title: string, publisherId: string, publisherName: string, reqSynopsis: boolean) => ({
  id,
  publisher_id: publisherId,
  publisher_name: publisherName,
  publisher_kind: "publishing_house",
  sharing_policy: "author_controlled",
  title,
  description: null,
  opens_at: "2026-11-01T00:00:00.000Z",
  closes_at: null,
  accepted_languages: ["ro"],
  req_full_manuscript: true,
  req_synopsis: reqSynopsis,
  req_sample: false,
  req_genre: false,
  req_author_intro: false,
  genre_ids: [],
});

jest.mock("@/features/submissions/catalogue-api", () => ({
  ...jest.requireActual("@/features/submissions/catalogue-api"),
  listOpenCalls: jest.fn(async () => [
    openCall("call-a", "Apel A", "pub-a", "Editura A", true),
    openCall("call-b", "Apel B", "pub-b", "Revista B", false),
  ]),
  listPublications: jest.fn(async () => []),
  getOpenCall: jest.fn(async () => openCall("call-b", "Apel B", "pub-b", "Revista B", false)),
}));
jest.mock("@/features/manuscripts/api", () => ({
  ...jest.requireActual("@/features/manuscripts/api"),
  setMainVersion: jest.fn(),
  listWorks: jest.fn(async () => [
    {
      id: "work-1",
      title: "Malul",
      main_version_id: "version-2",
      versions: [{ id: "version-3", label: "final", page_count: 218, uploaded_at: "2026-10-14T10:00:00.000Z" },
        { id: "version-2", label: "earlier", page_count: 200, uploaded_at: "2026-09-14T10:00:00.000Z" }],
    },
  ]),
}));
jest.mock("@/features/calls/api", () => ({
  ...jest.requireActual("@/features/calls/api"),
  listGenres: jest.fn(async () => []),
}));
jest.mock("@/features/submissions/api", () => ({
  uploadMaterial: jest.fn(async () => "user-1/materials/s.pdf"),
  checkEligibility: jest.fn(async (_versionId: string, callIds: string[]) =>
    callIds.map((id) => ({ call_id: id, reason: null, submission_id: null })),
  ),
  getContact: jest.fn(async () => ({ contact_email: "ana@example.test", phone: "+40712345678" })),
}));
jest.mock("@/features/submissions/batch", () => ({
  ...jest.requireActual("@/features/submissions/batch"),
  submitBatch: jest.fn(),
}));

const api = jest.requireMock("@/features/submissions/api");
const batch = jest.requireMock("@/features/submissions/batch");
const deviceAuth = jest.requireMock("@/features/manuscripts/device-auth");
const manuscripts = jest.requireMock("@/features/manuscripts/api");
const catalogueApi = jest.requireMock("@/features/submissions/catalogue-api");

beforeEach(async () => {
  jest.clearAllMocks();
  mockDeviceStorage.clear();
  mockDeviceStorage.set("lisette.locale", "en");
  mockSupabase = createFakeSupabase();
  const user = mockSupabase.addVerifiedUser("ana@example.test", "correct-horse-1", "en");
  user.authorEnabled = true;
  mockSupabase.signInAs(user.email);
});

// Ticks both calls, adds the synopsis call A needs, and arrives at the review step.
async function toReview() {
  await fireEvent.press(await screen.findByRole("checkbox", { name: /^Apel A/ }));
  await fireEvent.press(screen.getByRole("checkbox", { name: /^Apel B/ }));
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  await fireEvent.press(await screen.findByRole("button", { name: "Choose the synopsis PDF" }));
  await screen.findByText("sinopsis.pdf");
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  await screen.findByText(/ana@example.test/);
}

async function tickEverything() {
  for (const name of [/^I confirm that I wrote this manuscript/, "I agree to share my contact details", "I accept these sharing rules"]) {
    await fireEvent.press(screen.getByRole("checkbox", { name }));
  }
}

describe("submit_flow", () => {
  beforeEach(async () => {
    await renderRouter("./src/app", { initialUrl: "/submit/version-1" });
  });

  test("a call requiring a synopsis blocks the review step until a PDF is picked", async () => {
    expect(await screen.findByText("Step 1 of 4")).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole("checkbox", { name: /^Apel A/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Fill in all the fields.")).toBeOnTheScreen();
    expect(screen.queryByText(/ana@example.test/)).toBeNull();
  });

  test("Send stays unavailable until the rights declaration is ticked, and names what is missing", async () => {
    await toReview();
    await fireEvent.press(screen.getByRole("checkbox", { name: "I agree to share my contact details" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "I accept these sharing rules" }));

    expect(screen.queryByRole("button", { name: /^Send to/ })).toBeNull();
    expect(screen.getByText("To send, tick the rights declaration.")).toBeOnTheScreen();
  });

  test("without a phone number there is nothing to send", async () => {
    api.getContact.mockResolvedValueOnce({ contact_email: "ana@example.test", phone: null });
    await toReview();
    await tickEverything();

    expect(screen.getByText("Add a phone number to your contact details before sending.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^Send to/ })).toBeNull();
  });

  test("cancelling the fingerprint sends nothing", async () => {
    deviceAuth.confirmPrivateAction.mockResolvedValueOnce("cancelled");
    await toReview();
    await tickEverything();
    await fireEvent.press(screen.getByRole("button", { name: "Send to 2 publications" }));

    await waitFor(() => expect(deviceAuth.confirmPrivateAction).toHaveBeenCalled());
    expect(batch.submitBatch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send to 2 publications" })).toBeOnTheScreen();
  });

  test("the review shows what each publication will receive", async () => {
    await toReview();

    expect(screen.getAllByText("Synopsis: sinopsis.pdf")).toHaveLength(1);
    expect(screen.getAllByText("Full manuscript")).toHaveLength(2);
  });

  test("each publication's own sharing rule is shown before accepting it", async () => {
    const catalogue = jest.requireMock("@/features/submissions/catalogue-api");
    catalogue.listOpenCalls.mockResolvedValueOnce([
      { ...(await catalogue.listOpenCalls())[1], sharing_policy: "synopsis_approval" },
    ]);
    // The mount already asked once; open the calls again so the next answer is the one above.
    await fireEvent.changeText(await screen.findByLabelText("Search"), "B");
    await fireEvent.press(await screen.findByRole("checkbox", { name: /^Apel B/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    expect(
      await screen.findByText(
        "Sharing: synopsis approval. Before readers see a synopsis from this work, Revista B approves the exact text.",
      ),
    ).toBeOnTheScreen();
  });

  test("a failure that a retry cannot fix offers no Try again", async () => {
    batch.submitBatch.mockImplementationOnce(async (_client: unknown, items: { callId: string }[]) =>
      items.map(({ callId }) => ({ callId, status: "failed", reason: "duplicate_active" })),
    );
    await fireEvent.press(await screen.findByRole("checkbox", { name: /^Apel B/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText(/ana@example.test/);
    await tickEverything();
    await fireEvent.press(screen.getByRole("button", { name: "Send to 1 publication" }));

    expect(await screen.findByText(/Already in review with this work/)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^Try again/ })).toBeNull();
  });

  test("a call that cannot take this work says why next to Continue and keeps the writer on the calls step", async () => {
    api.checkEligibility.mockResolvedValueOnce([{ call_id: "call-b", reason: "duplicate_active", submission_id: "s-1" }]);
    await fireEvent.press(await screen.findByRole("checkbox", { name: /^Apel B/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(within(screen.getByTestId("screen-footer")).getByText(/Apel B: Already in review with this work/)).toBeOnTheScreen(),
    );
    expect(screen.queryByText(/ana@example.test/)).toBeNull();
  });

  test("calls that ask for nothing extra skip the materials step", async () => {
    await fireEvent.press(await screen.findByRole("checkbox", { name: /^Apel B/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText(/ana@example.test/)).toBeOnTheScreen();
    expect(screen.getByText("Step 3 of 4")).toBeOnTheScreen();
  });

  test("a manuscript that isn't the writer's says so, not that the phone is offline", async () => {
    api.checkEligibility.mockRejectedValueOnce({ message: "not_owner" });
    await fireEvent.press(await screen.findByRole("checkbox", { name: /^Apel B/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("This manuscript isn't yours to send.")).toBeOnTheScreen();
  });

  test("with A sent and B failed, Try again sends only B with the same key", async () => {
    batch.submitBatch.mockImplementationOnce(async (_client: unknown, items: { callId: string }[]) =>
      items.map(({ callId }) =>
        callId === "call-a"
          ? { callId, status: "sent", submissionId: "s-a" }
          : { callId, status: "failed", reason: "call_not_open" },
      ),
    );
    batch.submitBatch.mockImplementationOnce(async (_client: unknown, items: { callId: string }[]) =>
      items.map(({ callId }) => ({ callId, status: "sent", submissionId: `s-${callId}` })),
    );
    await toReview();
    await tickEverything();
    await fireEvent.press(screen.getByRole("button", { name: "Send to 2 publications" }));

    await fireEvent.press(await screen.findByRole("button", { name: "Try again for Revista B" }));

    await waitFor(() => expect(batch.submitBatch).toHaveBeenCalledTimes(2));
    const [first, retry] = batch.submitBatch.mock.calls.map((call: unknown[]) => call[1]);
    expect(retry).toEqual([first.find((item: { callId: string }) => item.callId === "call-b")]);
    expect(first.find((item: { callId: string }) => item.callId === "call-a").materials).toEqual({
      synopsis: "user-1/materials/s.pdf",
    });
    expect(first.find((item: { callId: string }) => item.callId === "call-b").materials).toEqual({});
    expect(await screen.findAllByText("Sent")).toHaveLength(2);
  });
});

describe("submit_flow started from a call", () => {
  test("starts on the version step; choosing a version shows the calls step with that call selected", async () => {
    await renderRouter("./src/app", { initialUrl: "/submit/choose?callId=call-b" });

    expect(await screen.findByText("Step 1 of 5")).toBeOnTheScreen();
    await screen.findByText("Malul");
    await fireEvent.press(screen.getByRole("radio", { name: /Version 2/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Step 2 of 5")).toBeOnTheScreen();
    expect(await screen.findByRole("checkbox", { name: /^Apel B/ })).toBeChecked();
    expect(screen.getByText("1 selected")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(api.checkEligibility).toHaveBeenCalledWith("version-3", ["call-b"]));
  });

  test("a call that is no longer open says so, and other calls can still be chosen", async () => {
    catalogueApi.getOpenCall.mockResolvedValueOnce(null);
    await renderRouter("./src/app", { initialUrl: "/submit/choose?callId=call-gone" });
    await screen.findByText("Malul");
    await fireEvent.press(screen.getByRole("radio", { name: /Version 2/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText(/isn't open anymore/)).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole("checkbox", { name: /^Apel A/ }));
    expect(screen.getByText("1 selected")).toBeOnTheScreen();
  });

  test("a writer with no manuscripts is pointed to Manuscripts", async () => {
    manuscripts.listWorks.mockResolvedValueOnce([{ id: "work-1", title: "Gol", versions: [] }]);
    await renderRouter("./src/app", { initialUrl: "/submit/choose?callId=call-b" });

    expect(await screen.findByText(/no manuscript to send yet/)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Go to Manuscripts" })).toBeOnTheScreen();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});

describe("submission version choice", () => {
  test("workId limits choices without changing the main version", async () => {
    manuscripts.listWorks.mockResolvedValueOnce([
      { id: "work-1", title: "Malul", main_version_id: "version-2", versions: [{ id: "version-3", label: "final", page_count: 218, uploaded_at: "2026-10-14T10:00:00Z" }, { id: "version-2", label: "earlier", page_count: 200, uploaded_at: "2026-09-14T10:00:00Z" }] },
      { id: "work-2", title: "Altă carte", versions: [{ id: "version-4", label: null, page_count: 10, uploaded_at: "2026-10-15T10:00:00Z" }] },
    ]);
    await renderRouter("./src/app", { initialUrl: "/submit/choose?workId=work-1" });
    await screen.findByText("Malul");
    expect(screen.queryByText("Altă carte")).toBeNull();
    expect(screen.getByRole("radio", { name: /Version 1/ })).toBeChecked();
    await fireEvent.press(screen.getByRole("radio", { name: /Version 2/ }));
    expect(screen.getByText("What version are you sending?")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Step 2 of 5")).toBeOnTheScreen();
    expect(manuscripts.setMainVersion).not.toHaveBeenCalled();
  });
  test("a direct version shows a change link and returns to its work's versions", async () => {
    await renderRouter("./src/app", { initialUrl: "/submit/version-3" });
    expect(await screen.findByText(/Sending v2/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Change" }));
    expect(await screen.findByText("Malul")).toBeOnTheScreen();
  });
});

describe("single-version shortcut", () => {
  test("one available version skips the chooser and hides Change", async () => {
    manuscripts.listWorks.mockResolvedValueOnce([{ id: "single", title: "Only", main_version_id: null, versions: [{ id: "only-version", label: null, page_count: 12, uploaded_at: "2026-10-14T10:00:00Z" }] }]);
    await renderRouter("./src/app", { initialUrl: "/submit/choose?workId=single" });
    expect(await screen.findByText(/Sending v1/)).toBeOnTheScreen();
    expect(screen.getByText("Step 1 of 4")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
  });
  test("without a main version the newest is preselected", async () => {
    manuscripts.listWorks.mockResolvedValueOnce([{ id: "work-1", title: "Malul", main_version_id: null, versions: [{ id: "v2", label: null, page_count: 20, uploaded_at: "2026-10-14" }, { id: "v1", label: null, page_count: 10, uploaded_at: "2026-09-14" }] }]);
    await renderRouter("./src/app", { initialUrl: "/submit/choose?workId=work-1" });
    expect(await screen.findByRole("radio", { name: /Version 2/ })).toBeChecked();
    expect(screen.getAllByText("Malul")).toHaveLength(1);
  });
});
