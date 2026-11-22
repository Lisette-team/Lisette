import { SafeArea } from "./helpers/safe-area";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import SubmissionDetail from "@/app/(app)/submission/[id]";
import i18n from "@/i18n";
let mockPublisher = false;
let mockStatus = "submitted";
const mockRpc = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { canGoBack: () => false, push: (...args: unknown[]) => mockPush(...args) }, useLocalSearchParams: () => ({ id: "s" }), useFocusEffect: (fn: () => void) => require("react").useEffect(fn, [fn]) }));
jest.mock("@/features/account/session", () => ({ useSession: () => ({ kind: mockPublisher ? "publisher" : "person" }) }));
jest.mock("@/features/manuscripts/pdf-reader", () => ({ PdfReader: () => null }));
jest.mock("@/lib/supabase", () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));
beforeAll(() => i18n.changeLanguage("en"));
beforeEach(() => { mockPublisher = false; mockStatus = "submitted"; mockRpc.mockReset(); mockRpc.mockImplementation(async (name: string) => name === "submission_detail" ? { data: { id: "s", work_id: "w", status: mockStatus, version_id: "v", work_title: "Work", author_name: "Ana", contact_email: "ana@example.test", contact_phone: "+40712345678", publisher_name: "Press", call_title: "Call", opened: true, history: [{ status: "submitted", changed_at: "2026-01-01" }], evaluation: { stood_out: "Moving", could_improve: null, observations: null }, materials: [], accepted_policy: { sharing_policy: "author_controlled" } }, error: null } : { data: null, error: null }); });
test("author sees opened and timeline, then confirms withdrawal with the copies limitation", async () => {
 await render(<SubmissionDetail />, { wrapper: SafeArea }); expect(await screen.findByText("Opened by the publisher")).toBeOnTheScreen(); expect(screen.getByText("Moving")).toBeOnTheScreen(); expect(screen.getByText("Sharing: author-controlled. You decide what readers see.")).toBeOnTheScreen();
 await fireEvent.press(screen.getByRole("button", { name: "Withdraw submission" })); expect(screen.getByText(/Copies already downloaded outside Lisette cannot be recalled/)).toBeOnTheScreen();
 await fireEvent.press(screen.getAllByRole("button", { name: "Withdraw submission" }).at(-1)!); await waitFor(() => expect(mockRpc).toHaveBeenCalledWith("withdraw_submission", { submission_id: "s" }));
});
test("publisher cannot select without an evaluation and on hold disables download", async () => {
 mockPublisher = true; mockStatus = "on_hold"; await render(<SubmissionDetail />, { wrapper: SafeArea }); expect(await screen.findByText("Download is off while this submission is on hold. Reading in Lisette stays on.")).toBeOnTheScreen();
 await fireEvent.changeText(screen.getByLabelText("What stood out"), ""); expect(screen.getByRole("button", { name: "Select" })).toBeDisabled();
});
test("publisher sees an ended-access message after withdrawal", async () => {
 mockPublisher = true; mockStatus = "withdrawn"; await render(<SubmissionDetail />, { wrapper: SafeArea }); expect(await screen.findByText("Access to this submission has ended.")).toBeOnTheScreen();
});
test("publisher can download while submitted", async () => {
 mockPublisher = true; await render(<SubmissionDetail />, { wrapper: SafeArea }); expect(await screen.findByRole("button", { name: "Download manuscript" })).toBeOnTheScreen();
});
test("publisher edits an evaluation after rejection", async () => {
 mockPublisher = true; mockStatus = "rejected"; await render(<SubmissionDetail />, { wrapper: SafeArea }); await screen.findByText("Access to this submission has ended.");
 await fireEvent.changeText(screen.getByLabelText("What stood out"), "Revised"); await fireEvent.press(screen.getByRole("button", { name: "Save evaluation" }));
 await waitFor(() => expect(mockRpc).toHaveBeenCalledWith("save_submission_evaluation", { submission_id: "s", evaluation: { stood_out: "Revised", could_improve: "", observations: "" } }));
});

test("publisher sees the contact details sent with an active submission", async () => {
 mockPublisher = true; await render(<SubmissionDetail />, { wrapper: SafeArea }); expect(await screen.findByText("ana@example.test")).toBeOnTheScreen(); expect(screen.getByText("+40712345678")).toBeOnTheScreen();
});

test("author opens the composer with this work preselected", async () => {
 await render(<SubmissionDetail />, { wrapper: SafeArea }); await fireEvent.press(await screen.findByRole("button", { name: "Share an excerpt" }));
 expect(mockPush).toHaveBeenCalledWith({ pathname: "/create", params: { mode: "fragment", workId: "w" } });
});
test("publisher opens a quote for this submission", async () => {
 mockPublisher = true; await render(<SubmissionDetail />, { wrapper: SafeArea }); await fireEvent.press(await screen.findByRole("button", { name: "Quote from manuscript" }));
 expect(mockPush).toHaveBeenCalledWith({ pathname: "/create", params: { mode: "fragment", workId: "w", submissionId: "s" } });
});
