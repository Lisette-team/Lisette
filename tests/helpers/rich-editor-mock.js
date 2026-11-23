/* global jest */
// The TenTap editor runs in a WebView, which Jest cannot render: tests type into a plain field instead.
jest.mock("@/features/sharing/rich-editor", () => ({
  RichEditor: ({ label, value, onChange }) => {
    const React = require("react");
    const { TextInput } = require("react-native");
    return React.createElement(TextInput, { accessibilityLabel: label, value, onChangeText: onChange, multiline: true });
  },
}));
