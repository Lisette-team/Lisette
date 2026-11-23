import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { FragmentComposer } from "@/features/sharing/composer";
import i18n from "@/i18n";
import { SafeArea } from "./helpers/safe-area";
const mockInvoke = jest.fn();
let mockReaderPage = 1;
let mockRestrictions: { publisher: string; policy: string }[] = [];
let mockNoWorks = false;
jest.mock("@/features/manuscripts/pdf-reader", () => ({ PdfReader: ({ onMessage, pageSelection }: { onMessage: (value: object) => void; pageSelection?: boolean }) => {
 const React = require("react"); const { Pressable, Text } = require("react-native");
 if (pageSelection) return React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: "Use pages", onPress: () => onMessage({ type: "pageSelection", start: 2, end: 4 }) }, React.createElement(Text, null, "Use pages"));
 return React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: "Use selection", onPress: () => onMessage({ type: "selection", text: `page ${mockReaderPage} text`, page: mockReaderPage }) }, React.createElement(Text, null, "Use selection"));
} }));
jest.mock("@/features/account/session", () => ({ useSession: () => ({ userId: "u" }) }));
jest.mock("expo-router", () => ({ router: { canGoBack: () => false, push: jest.fn(), back: jest.fn(), replace: jest.fn() }, useFocusEffect: (fn: () => void) => require("react").useEffect(fn, [fn]) }));
jest.mock("@/lib/supabase", () => ({ supabase: { rpc: async () => ({ data: { works: mockNoWorks ? [] : [{ id: "w", title: "My manuscript", source: "own_work", submissionId: null, versions: [{ id: "v", label: "First", pages: 5 }], restrictions: mockRestrictions }], requests: [] }, error: null }), functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));
beforeAll(() => i18n.changeLanguage("en"));
beforeEach(() => { mockReaderPage = 1; mockRestrictions = []; mockNoWorks = false; mockInvoke.mockReset().mockResolvedValue({ data: { id: "e" }, error: null }); });
test.each([['Excerpt', 'excerpt'], ['Synopsis', 'synopsis'], ['Pages', 'beta_pages']])('creates %s', async (label, kind) => {
 await render(<FragmentComposer switcher={null} />, { wrapper: SafeArea });
 await fireEvent.press(await screen.findByRole("button", { name: "My manuscript" }));
 await fireEvent.press(screen.getByRole("radio", { name: label }));
 if (kind === "beta_pages") { await fireEvent.changeText(screen.getByLabelText("From page"), "2"); await fireEvent.changeText(screen.getByLabelText("To page"), "3"); }
 else await fireEvent.changeText(screen.getByLabelText("Text"), "A passage");
 await fireEvent.press(screen.getByRole("button", { name: "Publish" }));
 expect(mockInvoke).toHaveBeenCalledWith("manuscript-file", expect.objectContaining({ body: expect.objectContaining({ kind, workId: "w" }) }));
});

test("selection stays editable and the next page appends", async () => {
 await render(<FragmentComposer switcher={null} />, { wrapper: SafeArea }); await fireEvent.press(await screen.findByRole("button", { name: "My manuscript" }));
 await fireEvent.press(screen.getByRole("button", { name: "Select from PDF" })); await fireEvent.press(screen.getByRole("button", { name: "Use selection" }));
 expect(screen.getByLabelText("Text").props.value).toBe("<p>page 1 text</p>"); await fireEvent.changeText(screen.getByLabelText("Text"), "<p>Edited page one</p>"); mockReaderPage = 2;
 await fireEvent.press(screen.getByRole("button", { name: "Add from the next page" })); await fireEvent.press(screen.getByRole("button", { name: "Use selection" }));
 expect(screen.getByLabelText("Text").props.value).toBe("<p>Edited page one</p><p>page 2 text</p>");
 await fireEvent.press(screen.getByRole("button", { name: "Publish" }));
 expect(mockInvoke).toHaveBeenCalledWith("manuscript-file", expect.objectContaining({ body: expect.objectContaining({ pageStart: 1, pageEnd: 2, body: "<blockquote><p>Edited page one</p><p>page 2 text</p></blockquote>" }) }));
});
test("names applicable publications before requesting approval", async () => {
 mockRestrictions = [{ publisher: "Press", policy: "synopsis_and_excerpt_approval" }];
 await render(<FragmentComposer switcher={null} />, { wrapper: SafeArea }); await fireEvent.press(await screen.findByRole("button", { name: "My manuscript" }));
 expect(screen.getByText("Approval required from: Press")).toBeOnTheScreen(); expect(screen.getByRole("button", { name: "Send for approval" })).toBeOnTheScreen();
});
test("a page share cannot include every page of the manuscript", async () => {
 await render(<FragmentComposer switcher={null} />, { wrapper: SafeArea }); await fireEvent.press(await screen.findByRole("button", { name: "My manuscript" })); await fireEvent.press(screen.getByRole("radio", { name: "Pages" }));
 await fireEvent.changeText(screen.getByLabelText("From page"), "1"); await fireEvent.changeText(screen.getByLabelText("To page"), "5"); expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
});

test("page range accepts digits and reports invalid bounds", async () => {
 await render(<FragmentComposer switcher={null} />, { wrapper: SafeArea }); await fireEvent.press(await screen.findByRole("button", { name: "My manuscript" })); await fireEvent.press(screen.getByRole("radio", { name: "Pages" }));
 await fireEvent.changeText(screen.getByLabelText("From page"), "2a"); await fireEvent.changeText(screen.getByLabelText("To page"), "6");
 expect(screen.getByDisplayValue("2")).toBeOnTheScreen(); expect(screen.getByRole("alert")).toBeOnTheScreen(); expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
 await fireEvent.changeText(screen.getByLabelText("To page"), "3"); await fireEvent.press(screen.getByRole("button", { name: "Publish" }));
 expect(mockInvoke).toHaveBeenCalledWith("manuscript-file", expect.objectContaining({ body: expect.objectContaining({ pageStart: 2, pageEnd: 3 }) }));
});
test("picker back button closes the reader without changing the range", async () => {
 await render(<FragmentComposer switcher={null} />, { wrapper: SafeArea }); await fireEvent.press(await screen.findByRole("button", { name: "My manuscript" })); await fireEvent.press(screen.getByRole("radio", { name: "Pages" }));
 await fireEvent.changeText(screen.getByLabelText("From page"), "2"); await fireEvent.changeText(screen.getByLabelText("To page"), "3");
 await fireEvent.press(screen.getByRole("button", { name: "Select from PDF" }));
 await fireEvent.press(screen.getByRole("button", { name: "Back" }));
 expect(screen.queryByRole("button", { name: "Use pages" })).toBeNull();
 expect(screen.getByLabelText("From page").props.value).toBe("2"); expect(screen.getByLabelText("To page").props.value).toBe("3");
});

test("page picker fills editable range", async () => {
 await render(<FragmentComposer switcher={null} />, { wrapper: SafeArea }); await fireEvent.press(await screen.findByRole("button", { name: "My manuscript" })); await fireEvent.press(screen.getByRole("radio", { name: "Pages" }));
 await fireEvent.press(screen.getByRole("button", { name: "Select from PDF" })); await fireEvent.press(screen.getByRole("button", { name: "Use pages" }));
 expect(screen.getByLabelText("From page").props.value).toBe("2"); expect(screen.getByLabelText("To page").props.value).toBe("4");
 await fireEvent.changeText(screen.getByLabelText("To page"), "3"); await fireEvent.press(screen.getByRole("button", { name: "Publish" }));
 expect(mockInvoke).toHaveBeenCalledWith("manuscript-file", expect.objectContaining({ body: expect.objectContaining({ pageStart: 2, pageEnd: 3 }) }));
});

test("synopsis omits PDF selection and page provenance after selecting an excerpt", async () => {
 await render(<FragmentComposer switcher={null} />, { wrapper: SafeArea }); await fireEvent.press(await screen.findByRole("button", { name: "My manuscript" }));
 await fireEvent.press(screen.getByRole("button", { name: "Select from PDF" })); await fireEvent.press(screen.getByRole("button", { name: "Use selection" }));
 await await fireEvent.press(screen.getByRole("radio", { name: "Synopsis" }));
 expect(screen.queryByRole("button", { name: "Select from PDF" })).toBeNull(); expect(screen.queryByRole("button", { name: "Add from the next page" })).toBeNull();
 await fireEvent.changeText(screen.getByLabelText("Text"), "Synopsis"); await fireEvent.press(screen.getByRole("button", { name: "Publish" }));
 expect(mockInvoke.mock.calls[0][1].body).toEqual(expect.objectContaining({ kind: "synopsis", versionId: null, pageStart: null, pageEnd: null }));
});

test.each([false, true])("selected work collapses and can be changed (prefilled: %s)", async (prefilled) => {
 await render(<FragmentComposer switcher={null} workId={prefilled ? "w" : undefined} />, { wrapper: SafeArea });
 if (!prefilled) await fireEvent.press(await screen.findByRole("button", { name: "My manuscript" }));
 expect(await screen.findByRole("button", { name: "Change" })).toBeOnTheScreen();
 expect(screen.queryByRole("button", { name: "My manuscript" })).toBeNull();
 await fireEvent.press(screen.getByRole("button", { name: "Change" }));
 expect(screen.getByRole("button", { name: "My manuscript" })).toBeOnTheScreen();
});

test("type cards expose their selected radio state", async () => {
 await render(<FragmentComposer switcher={null} />, { wrapper: SafeArea });
 await fireEvent.press(await screen.findByRole("button", { name: "My manuscript" }));
 expect(screen.getByRole("radio", { name: "Excerpt" }).props.accessibilityState).toEqual({ checked: true });
 await fireEvent.press(screen.getByRole("radio", { name: "Synopsis" }));
 expect(screen.getByRole("radio", { name: "Synopsis" }).props.accessibilityState).toEqual({ checked: true });
 expect(screen.getByRole("radio", { name: "Excerpt" }).props.accessibilityState).toEqual({ checked: false });
});

test("audience toggle describes and saves the selected visibility", async () => {
 await render(<FragmentComposer switcher={null} />, { wrapper: SafeArea });
 await fireEvent.press(await screen.findByRole("button", { name: "My manuscript" }));
 expect(screen.getByText("Everyone on Lisette")).toBeOnTheScreen();
 expect(screen.getByRole("switch", { name: "Who sees it" }).props.value).toBe(false);
 await fireEvent.press(screen.getByRole("button", { name: "Followers" }));
 expect(screen.getByRole("switch", { name: "Who sees it" }).props.value).toBe(true);
 expect(screen.getByText("Only your followers")).toBeOnTheScreen();
 await fireEvent.press(screen.getByRole("button", { name: "Everyone" }));
 expect(screen.getByRole("switch", { name: "Who sees it" }).props.value).toBe(false);
 await fireEvent(screen.getByRole("switch", { name: "Who sees it" }), "valueChange", true);
 expect(screen.getByText("Only your followers")).toBeOnTheScreen();
 await fireEvent.changeText(screen.getByLabelText("Text"), "A passage");
 await fireEvent.press(screen.getByRole("button", { name: "Publish" }));
 expect(mockInvoke).toHaveBeenCalledWith("manuscript-file", expect.objectContaining({ body: expect.objectContaining({ audience: "followers" }) }));
});
test("the comment and the excerpt are two separate boxes, saved together", async () => {
 await render(<FragmentComposer switcher={null} />, { wrapper: SafeArea }); await fireEvent.press(await screen.findByRole("button", { name: "My manuscript" }));
 await fireEvent.changeText(screen.getByLabelText("Say something about it"), "<p>My thought</p>");
 await fireEvent.changeText(screen.getByLabelText("Text"), "<p>From the book</p>");
 expect(screen.getByLabelText("Say something about it").props.value).toBe("<p>My thought</p>");
 await fireEvent.press(screen.getByRole("button", { name: "Publish" }));
 expect(mockInvoke).toHaveBeenCalledWith("manuscript-file", expect.objectContaining({ body: expect.objectContaining({ body: "<p>My thought</p><blockquote><p>From the book</p></blockquote>" }) }));
});
test("Change goes back to the sources and keeps what was written", async () => {
 await render(<FragmentComposer switcher={null} />, { wrapper: SafeArea }); await fireEvent.press(await screen.findByRole("button", { name: "My manuscript" }));
 await fireEvent.changeText(screen.getByLabelText("Say something about it"), "<p>My thought</p>");
 await fireEvent.press(screen.getByRole("button", { name: "Change" }));
 expect(screen.queryByLabelText("Say something about it")).toBeNull();
 expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
 await fireEvent.press(screen.getByRole("button", { name: "My manuscript" }));
 expect(screen.getByLabelText("Say something about it").props.value).toBe("<p>My thought</p>");
});

test("with nothing to share from, it offers to upload a manuscript", async () => {
 mockNoWorks = true;
 await render(<FragmentComposer switcher={null} />, { wrapper: SafeArea });
 await fireEvent.press(await screen.findByRole("button", { name: "Upload a manuscript" }));
 expect(router.push).toHaveBeenCalledWith("/upload");
});

test("a synopsis is its own card under the author's comment", async () => {
 await render(<FragmentComposer switcher={null} />, { wrapper: SafeArea });
 await fireEvent.press(await screen.findByRole("button", { name: "My manuscript" }));
 await fireEvent.press(screen.getByRole("radio", { name: "Synopsis" }));
 expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
 await fireEvent.changeText(screen.getByLabelText("Write something about the synopsis"), "My note");
 expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
 await fireEvent.changeText(screen.getByLabelText("Text"), "The whole story");
 await fireEvent.press(screen.getByRole("button", { name: "Publish" }));
 expect(mockInvoke.mock.calls[0][1].body.body).toMatch(/My note.*<blockquote>.*The whole story.*<\/blockquote>/);
});
