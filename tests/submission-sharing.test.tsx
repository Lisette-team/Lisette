import { SafeArea } from "./helpers/safe-area";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SharingRequests } from "@/features/sharing/requests";
import i18n from "@/i18n";
const mockRpc = jest.fn();
jest.mock("expo-router", () => ({ useFocusEffect: (fn: () => void) => require("react").useEffect(fn, [fn]) }));
jest.mock("@/features/account/session", () => ({ useSession: () => ({ userId: "p" }) }));
jest.mock("@/features/manuscripts/pdf-reader", () => ({ PdfReader: () => null }));
jest.mock("@/lib/supabase", () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));
beforeAll(() => i18n.changeLanguage("en"));
beforeEach(() => { mockRpc.mockReset(); mockRpc.mockImplementation(async (name: string) => ({ data: name === "sharing_workspace" ? { requests: [{ id: "r", workId: "w", versionId: "v", body: "Exact words", kind: "excerpt", source: "own_work", isAuthor: true, requestedBy: "a", decisions: [{ submissionId: "s", publisherId: "p", publisher: "Press", decision: "pending", status: "submitted" }, { submissionId: "s2", publisherId: "p2", publisher: "Other", decision: "approved", status: "selected" }, { submissionId: "s3", publisherId: "p3", publisher: "Third", decision: "refused", status: "in_review" }] }] } : null, error: null })); });
test("author sees each publication's approval state", async () => { await render(<SharingRequests workId="w" submissionId="s" publisher={false} />, { wrapper: SafeArea }); expect(await screen.findByText(/Press.*Pending/)).toBeOnTheScreen(); expect(screen.getByText(/Other.*Approved/)).toBeOnTheScreen(); expect(screen.getByText(/Third.*Refused/)).toBeOnTheScreen(); });
test.each([["Approve", true], ["Refuse", false]])("publisher can %s the exact text", async (label, approved) => { await render(<SharingRequests workId="w" submissionId="s" publisher />, { wrapper: SafeArea }); expect(await screen.findByText("Exact words")).toBeOnTheScreen(); await fireEvent.press(screen.getByRole("button", { name: label })); expect(mockRpc).toHaveBeenCalledWith("decide_sharing", { request_id: "r", submission_id: "s", approved }); });
test("author can approve a publication's quote", async () => {
 mockRpc.mockImplementation(async (name: string) => ({ data: name === "sharing_workspace" ? { requests: [{ id: "quote", workId: "w", versionId: "v", body: "Quoted words", kind: "excerpt", source: "received_manuscript", isAuthor: true, requestedBy: "p", authorDecision: "pending", decisions: [] }] } : null, error: null }));
 await render(<SharingRequests workId="w" submissionId="s" publisher={false} />, { wrapper: SafeArea }); expect(await screen.findByText("Quoted words")).toBeOnTheScreen(); await fireEvent.press(screen.getByRole("button", { name: "Approve" })); expect(mockRpc).toHaveBeenCalledWith("author_decide_quote", { request_id: "quote", approved: true });
});
test("author can revise a share and request fresh decisions", async () => {
 mockRpc.mockImplementation(async (name: string) => ({ data: name === "sharing_workspace" ? { requests: [{ id: "r", workId: "w", excerptId: "e", versionId: "v", body: "Original words", kind: "excerpt", source: "own_work", isAuthor: true, requestedBy: "p", authorDecision: null, decisions: [] }] } : name === "revise_excerpt" ? "new-v" : null, error: null }));
 await render(<SharingRequests workId="w" submissionId="s" publisher={false} />, { wrapper: SafeArea }); await fireEvent.press(await screen.findByRole("button", { name: "Revise" })); await fireEvent.changeText(screen.getByLabelText("Exact text"), "Changed words"); await fireEvent.press(screen.getByRole("button", { name: "Request approval" }));
 expect(mockRpc).toHaveBeenCalledWith("revise_excerpt", { excerpt_id: "e", body: "Changed words" }); expect(mockRpc).toHaveBeenCalledWith("request_sharing", { text_version_id: "new-v" });
});
