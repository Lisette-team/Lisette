import { blurEditorsOutside, registerEditor } from "@/ui/editor-focus";

const box = { measureInWindow: (done: (x: number, y: number, w: number, h: number) => void) => done(10, 100, 300, 200) };

test("a tap outside an editor closes it, a tap inside does not", () => {
  const blur = jest.fn();
  const unregister = registerEditor({ box: () => box, blur });
  blurEditorsOutside(50, 150);
  expect(blur).not.toHaveBeenCalled();
  blurEditorsOutside(50, 400);
  expect(blur).toHaveBeenCalledTimes(1);
  unregister();
  blurEditorsOutside(50, 400);
  expect(blur).toHaveBeenCalledTimes(1);
});
