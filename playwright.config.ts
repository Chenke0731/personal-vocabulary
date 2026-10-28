import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:5174",
    viewport: { width: 390, height: 844 },
    browserName: "chromium",
    channel: process.env.CI ? undefined : "chrome",
  },
  webServer: [
    { command: "npm run preview -- --port 5174", url: "http://localhost:5174", reuseExistingServer: !process.env.CI },
    { command: "npm run dev -- --port 5189 --strictPort", url: "http://localhost:5189", reuseExistingServer: false },
  ],
  reporter: "list",
});
