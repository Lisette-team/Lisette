import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as LocalAuthentication from "expo-local-authentication";

import Manuscripts from "@/app/(app)/(tabs)/manuscripts";
import Reader from "@/app/(app)/reader/[versionId]";
import * as api from "@/features/manuscripts/api";
import i18n from "@/i18n";

const mockConfirm = jest.fn();

jest.mock("expo-local-authentication", () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  getEnrolledLevelAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));
jest.mock("expo-document-picker", () => ({
  getDocumentAsync: async () => ({
    canceled: false,
    assets: [{ uri: "file:///cache/roman.pdf", name: "roman.pdf", mimeType: "application/pdf", size: 10 }],
  }),
}));
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), canGoBack: () => false },
  Redirect: () => null,
  useLocalSearchParams: () => ({ versionId: "v-1" }),
}));
jest.mock("@/features/account/session", () => ({ useSession: () => ({ userId: "user-1", locale: "en", authorEnabled: true }) }));
jest.mock("@/features/manuscripts/api");
jest.mock("@/features/manuscripts/device-auth", () => ({ confirmPrivateAction: () => mockConfirm() }));
jest.mock("@/features/manuscripts/pdf-reader", () => {
  const { Text } = jest.requireActual("react-native");
  return { PdfReader: () => <Text>pdf-reader-open</Text> };
});

const auth = jest.mocked(LocalAuthentication);
const mockApi = jest.mocked(api);

beforeAll(() => i18n.changeLanguage("en"));

describe("device_auth_cancellation", () => {
  describe("confirmPrivateAction", () => {
    const actual = jest.requireActual<typeof import("@/features/manuscripts/device-auth")>(
      "@/features/manuscripts/device-auth",
    );

    test("a successful fingerprint or PIN check confirms", async () => {
      auth.getEnrolledLevelAsync.mockResolvedValue(LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG);
      auth.authenticateAsync.mockResolvedValue({ success: true, authenticationType: 1 } as never);
      expect(await actual.confirmPrivateAction()).toBe("confirmed");
    });

    test("cancelling the system prompt is reported as cancelled", async () => {
      auth.getEnrolledLevelAsync.mockResolvedValue(LocalAuthentication.SecurityLevel.SECRET);
      auth.authenticateAsync.mockResolvedValue({ success: false, error: "user_cancel" } as never);
      expect(await actual.confirmPrivateAction()).toBe("cancelled");
    });

    test("a phone without any screen lock is unavailable, without a prompt", async () => {
      auth.authenticateAsync.mockClear();
      auth.getEnrolledLevelAsync.mockResolvedValue(LocalAuthentication.SecurityLevel.NONE);
      expect(await actual.confirmPrivateAction()).toBe("unavailable");
      expect(auth.authenticateAsync).not.toHaveBeenCalled();
    });
  });

  describe("screens", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockApi.listWorks.mockResolvedValue([{ id: "work-1", title: "Roman", versions: [] }]);
    });

    test("cancelling does not upload", async () => {
      mockConfirm.mockResolvedValue("cancelled");
      await render(<Manuscripts />);
      await fireEvent.press(await screen.findByRole("button", { name: "New version" }));

      await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
      expect(mockApi.uploadVersion).not.toHaveBeenCalled();
      expect(mockApi.createWork).not.toHaveBeenCalled();
    });

    test("confirming uploads the picked file", async () => {
      mockConfirm.mockResolvedValue("confirmed");
      mockApi.uploadVersion.mockResolvedValue({ id: "v-2" } as api.ManuscriptVersion);
      await render(<Manuscripts />);
      await fireEvent.press(await screen.findByRole("button", { name: "New version" }));

      await waitFor(() => expect(mockApi.uploadVersion).toHaveBeenCalledWith("work-1", expect.objectContaining({ name: "roman.pdf" }), ""));
    });

    test("cancelling does not open the manuscript", async () => {
      mockConfirm.mockResolvedValue("cancelled");
      await render(<Reader />);

      await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
      expect(screen.queryByText("pdf-reader-open")).toBeNull();
      expect(screen.getByRole("button", { name: "Unlock" })).toBeOnTheScreen();
    });

    test("confirming opens the manuscript", async () => {
      mockConfirm.mockResolvedValue("confirmed");
      await render(<Reader />);

      expect(await screen.findByText("pdf-reader-open")).toBeOnTheScreen();
    });
  });
});

