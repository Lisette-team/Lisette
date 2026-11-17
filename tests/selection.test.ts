import type { OpenCall } from "@/features/submissions/catalogue-api";
import { toggleCall } from "@/features/submissions/selection";

const call = (id: string, publisherId: string) => ({ id, publisher_id: publisherId }) as OpenCall;

describe("toggleCall", () => {
  test("toggleCall keeps one call per publication", () => {
    const first = toggleCall(new Map(), call("a1", "pub-a"));
    const replaced = toggleCall(toggleCall(first, call("b1", "pub-b")), call("a2", "pub-a"));

    expect([...replaced.keys()].sort()).toEqual(["a2", "b1"]);
  });

  test("toggling the same call twice removes it", () => {
    const once = toggleCall(new Map(), call("a1", "pub-a"));

    expect(toggleCall(once, call("a1", "pub-a")).size).toBe(0);
    expect(once.size).toBe(1);
  });
});
