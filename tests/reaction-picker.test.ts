import { optionAt, panelGeometry } from "@/features/community/reaction-picker";

// The panel sits above the React button; sliding a finger over it picks the reaction under the finger.
describe("reaction picker geometry", () => {
  const button = { x: 20, y: 500, width: 140, height: 40 };
  const panel = panelGeometry(button, 360);

  test("opens right above the button, inside the screen", () => {
    expect(panel.top + panel.height).toBeLessThanOrEqual(button.y);
    expect(panel.left).toBeGreaterThanOrEqual(8);
    expect(panel.left + panel.width).toBeLessThanOrEqual(352);
  });

  test("opens below the button when there is no room above", () => {
    const low = panelGeometry({ ...button, y: 40 }, 360);
    expect(low.top).toBeGreaterThanOrEqual(40 + button.height);
  });

  test("the reaction under the finger is the one picked", () => {
    const middle = panel.top + panel.height / 2;
    const first = panel.left + panel.padding + panel.option / 2;
    expect(optionAt(first, middle, panel)).toBe(0);
    expect(optionAt(first + panel.option, middle, panel)).toBe(1);
    expect(optionAt(first + 2 * panel.option, middle, panel)).toBe(2);
  });

  test("a finger far from the panel picks nothing", () => {
    expect(optionAt(panel.left + 10, panel.top + panel.height + 200, panel)).toBeNull();
    expect(optionAt(panel.left + panel.width + 50, panel.top + 10, panel)).toBeNull();
  });
});
