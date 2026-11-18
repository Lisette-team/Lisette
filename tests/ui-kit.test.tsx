import { fireEvent, render } from "@testing-library/react-native";

import { Banner } from "@/ui/banner";
import { FilterPill } from "@/ui/filter-pill";
import { ListRow } from "@/ui/list-row";
import { Screen } from "@/ui/screen";
import { Segmented } from "@/ui/segmented";
import { Steps } from "@/ui/steps";

import { SafeArea } from "./helpers/safe-area";

describe("ui kit", () => {
  test("Segmented marks the chosen side and reports a change", async () => {
    const onChange = jest.fn();
    const view = await render(
      <Segmented
        options={[
          { value: "calls", label: "Apeluri deschise" },
          { value: "publications", label: "Publicații" },
        ]}
        value="calls"
        onChange={onChange}
      />,
    );

    expect(view.getByRole("tab", { name: "Apeluri deschise" }).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(view.getByRole("tab", { name: "Publicații" }));
    expect(onChange).toHaveBeenCalledWith("publications");
  });

  test("FilterPill shows its value and opens a sheet to pick another", async () => {
    const onChange = jest.fn();
    const view = await render(
      <FilterPill
        label="Gen"
        allLabel="Toate"
        closeLabel="Închide"
        value="novel"
        options={[
          { value: "novel", label: "Roman" },
          { value: "poetry", label: "Poezie" },
        ]}
        onChange={onChange}
      />,
      { wrapper: SafeArea },
    );

    await fireEvent.press(view.getByRole("button", { name: "Gen: Roman" }));
    expect(view.getByRole("radio", { name: "Roman" }).props.accessibilityState.checked).toBe(true);
    await fireEvent.press(view.getByRole("radio", { name: "Poezie" }));
    expect(onChange).toHaveBeenCalledWith("poetry");
    expect(view.queryByRole("radio", { name: "Poezie" })).toBeNull();
  });

  test("FilterPill can clear back to All", async () => {
    const onChange = jest.fn();
    const view = await render(
      <FilterPill label="Gen" allLabel="Toate"
        closeLabel="Închide" value="novel" options={[{ value: "novel", label: "Roman" }]} onChange={onChange} />,
      { wrapper: SafeArea },
    );

    await fireEvent.press(view.getByRole("button", { name: "Gen: Roman" }));
    await fireEvent.press(view.getByRole("radio", { name: "Toate" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  test("ListRow is a button with its text when pressable, and plain text otherwise", async () => {
    const onPress = jest.fn();
    const view = await render(
      <>
        <ListRow title="Concurs de debut" subtitle="Editura A · Editură" meta="Până pe 30 nov." onPress={onPress} />
        <ListRow title="Doar text" />
      </>,
    );

    await fireEvent.press(view.getByRole("button", { name: /Concurs de debut/ }));
    expect(onPress).toHaveBeenCalled();
    expect(view.queryByRole("button", { name: /Doar text/ })).toBeNull();
    expect(view.getByText("Până pe 30 nov.")).toBeOnTheScreen();
  });

  test("Banner and Steps render their text", async () => {
    const view = await render(
      <>
        <Banner text="Primește manuscrise acum." />
        <Steps current={2} total={4} label="Pasul 2 din 4" />
      </>,
    );

    expect(view.getByText("Primește manuscrise acum.")).toBeOnTheScreen();
    expect(view.getByText("Pasul 2 din 4")).toBeOnTheScreen();
  });

  test("a title header stays outside the scrolling content", async () => {
    const view = await render(<Screen title="Titlu"><></></Screen>, { wrapper: SafeArea });

    const header = view.getByTestId("screen-header");
    expect(view.getByRole("header", { name: "Titlu" })).toBeOnTheScreen();
    let node = header.parent;
    while (node && node.type !== "RCTScrollView") node = node.parent;
    expect(node).toBeNull();
  });

  test("a pinned footer stays outside the scrolling content", async () => {
    const view = await render(
      <Screen title="Pasul 2" pinFooter footer={<></>}>
        <></>
      </Screen>,
      { wrapper: SafeArea },
    );

    const footer = view.getByTestId("screen-footer");
    let node = footer.parent;
    while (node && node.type !== "RCTScrollView") node = node.parent;
    expect(node).toBeNull();
  });
});
