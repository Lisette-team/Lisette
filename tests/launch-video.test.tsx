import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { LaunchVideo } from "@/ui/launch-video";

type Listener = () => void;

const mockPlayer = {
  status: "loading" as string,
  muted: false,
  loop: true,
  play: jest.fn(),
  listeners: new Map<string, Listener>(),
  addListener(event: string, listener: Listener) {
    this.listeners.set(event, listener);
    return { remove: () => this.listeners.delete(event) };
  },
};
let mockSetStatus: (status: string) => void = () => {};

jest.mock("expo-video", () => {
  const { View } = jest.requireActual("react-native");
  return {
    useVideoPlayer: (_source: unknown, setup: (p: typeof mockPlayer) => void) => {
      setup(mockPlayer);
      return mockPlayer;
    },
    VideoView: () => <View testID="video-view" />,
  };
});
jest.mock("expo", () => {
  const { useState } = jest.requireActual("react");
  return {
    useEvent: (_player: unknown, _event: string, initial: { status: string }) => {
      const [status, setStatus] = useState(initial.status);
      mockSetStatus = setStatus;
      return { status };
    },
  };
});
jest.mock("expo-splash-screen", () => ({ hide: jest.fn(), preventAutoHideAsync: jest.fn() }));

let reduceMotion = false;

beforeEach(() => {
  jest.useFakeTimers();
  mockPlayer.status = "loading";
  mockPlayer.play.mockClear();
  mockPlayer.listeners.clear();
  reduceMotion = false;
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockImplementation(async () => reduceMotion);
});

afterEach(() => {
  jest.useRealTimers();
});

async function settle(ms = 0) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe("launch_video", () => {
  test("plays the clip once, muted, when it is ready", async () => {
    await render(<LaunchVideo onFinish={jest.fn()} />);
    await settle();

    expect(mockPlayer.muted).toBe(true);
    expect(mockPlayer.loop).toBe(false);
    expect(mockPlayer.play).not.toHaveBeenCalled();

    await act(async () => mockSetStatus("readyToPlay"));
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("video-view")).toBeOnTheScreen();
  });

  test("closes after the clip ends", async () => {
    const onFinish = jest.fn();
    await render(<LaunchVideo onFinish={onFinish} />);
    await settle();

    await act(async () => mockPlayer.listeners.get("playToEnd")?.());
    await settle(500);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  test("closes if the clip cannot play", async () => {
    const onFinish = jest.fn();
    await render(<LaunchVideo onFinish={onFinish} />);
    await settle();

    await act(async () => mockSetStatus("error"));
    await settle(500);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  test("closes on its own if playback stalls", async () => {
    const onFinish = jest.fn();
    await render(<LaunchVideo onFinish={onFinish} />);
    await settle();

    await settle(5000);
    expect(onFinish).not.toHaveBeenCalled();
    await settle(1500);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  test("skips the clip when the device asks for reduced motion", async () => {
    reduceMotion = true;
    const onFinish = jest.fn();
    await render(<LaunchVideo onFinish={onFinish} />);
    await settle();

    await act(async () => mockSetStatus("readyToPlay"));
    await settle(500);
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
