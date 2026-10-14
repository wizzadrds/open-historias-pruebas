import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const baseURL = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4173";
const artifactsDir = "artifacts";
let server;
let browser;

const waitForServer = async (url, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`Preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Preview did not become ready at ${url}: ${lastError?.message || "timeout"}`);
};

try {
  await mkdir(artifactsDir, { recursive: true });
  server = spawn("npm", [
    "run", "preview:web", "--",
    "--host", "127.0.0.1",
    "--port", new URL(baseURL).port || "4173",
    "--strictPort",
  ], { stdio: ["ignore", "inherit", "inherit"], env: process.env });

  await waitForServer(baseURL);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));

  const response = await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  assert.ok(response && response.ok(), `App entry returned HTTP ${response?.status() ?? "no response"}`);

  await page.waitForFunction(() => {
    const root = document.querySelector("#root");
    if (!root || root.children.length === 0) return false;
    const visible = [...root.querySelectorAll("*")].some((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" &&
        Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    });
    return visible;
  }, null, { timeout: 90_000 });

  // Let asynchronous startup, map chunks and initial effects surface errors.
  await delay(5_000);
  await page.screenshot({ path: `${artifactsDir}/browser-smoke.png`, fullPage: true });
  assert.deepEqual(pageErrors, [], `Uncaught browser errors:\n${pageErrors.join("\n\n")}`);

  console.log("Browser smoke passed: web build served, React mounted visible UI, no uncaught page errors.");
} catch (error) {
  if (browser) {
    try {
      const pages = browser.contexts().flatMap((context) => context.pages());
      if (pages[0]) await pages[0].screenshot({ path: `${artifactsDir}/browser-smoke-failure.png`, fullPage: true });
    } catch {}
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      delay(3_000),
    ]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
}
