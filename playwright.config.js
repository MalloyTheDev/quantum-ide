export default {
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    launchOptions: process.env.PLAYWRIGHT_SYSTEM_CHROME
      ? { executablePath: process.env.PLAYWRIGHT_SYSTEM_CHROME }
      : undefined,
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
};
