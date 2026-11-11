// HTTP tests against the local stack. They need Node's real fetch, which the jest-expo preset replaces.
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/gateway/**/*.test.ts"],
  transform: { "\\.ts$": ["babel-jest", { presets: ["babel-preset-expo"] }] },
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
};
