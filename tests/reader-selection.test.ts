import { readerHtml } from "@/features/manuscripts/reader-html";

test.each(["native", "web"])("%s reader sends the selection after it collapses on button tap", (platform) => {
 const html = readerHtml({ url: "", token: "", apikey: "", body: {} }, "white", true);
 const script = html.split('<script type="module">')[1].split('// fetch()')[0];
 const listeners: Record<string, () => void> = {};
 const buttonListeners: Record<string, () => void> = {};
 const send = jest.fn();
 const page = { dataset: { page: "3" } };
 let selected = { isCollapsed: false, rangeCount: 1, getRangeAt: () => ({ startContainer: { parentElement: { closest: () => page } }, endContainer: { parentElement: { closest: () => page } } }), toString: () => "Selected words" };
 const document = { createElement: () => ({ addEventListener: (name: string, fn: () => void) => { buttonListeners[name] = fn; } }), addEventListener: (name: string, fn: () => void) => { listeners[name] = fn; }, body: { append: () => {} } };
 const window = { getSelection: () => selected, ReactNativeWebView: platform === "native" ? { postMessage: send } : undefined, parent: { postMessage: send } };
 new Function("window", "document", script)(window, document);
 listeners.selectionchange();
 selected = { ...selected, isCollapsed: true, rangeCount: 0, toString: () => "" };
 listeners.selectionchange();
 buttonListeners.click();
 expect(JSON.parse(send.mock.calls[0][0])).toEqual({ type: "selection", text: "Selected words", page: 3 });
});
