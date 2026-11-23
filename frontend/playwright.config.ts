import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * End-to-end tests: the real backend (throwaway database, one seeded song, no
 * AI key) and the production build of the website, driven in Chromium.
 *
 *   NEXT_PUBLIC_API_URL=http://localhost:8100 npm run build
 *   npm run e2e
 *
 * The microphone is a reference recording of a G major chord, so recording
 * and grading run for real.
 */
const G_MAJOR = path.resolve(__dirname, "../data/lessons/G_major/reference.wav");

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "off",
    // the app is played in landscape, like holding a guitar
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
    permissions: ["microphone"],
    launchOptions: {
      // preinstalled browsers (e.g. in a sandbox) can be pointed to explicitly
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${G_MAJOR}`,
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  },
  webServer: [
    {
      command: "bash e2e/start-backend.sh",
      url: "http://localhost:8100/",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npx next start -p 3100",
      url: "http://localhost:3100/",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
