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

  // The website deliberately gates play behind its connection screen and demo notice.
  // Enter through those real controls so the menu underneath is actually usable.
  const homeOverlay = page.locator("#oh-home-root");
  if (await homeOverlay.count()) {
    await page.waitForFunction(() => {
      const button = document.querySelector("#oh-home-root button.oh-btn.primary");
      return Boolean(button && !button.disabled);
    }, null, { timeout: 60_000 });
    await homeOverlay.getByRole("button", { name: /Enter Open Historia/ }).click({ timeout: 15_000 });
    const demoButton = page.getByRole("button", { name: "Play the demo anyway", exact: true });
    if (await demoButton.count()) await demoButton.click({ timeout: 15_000 });
    await homeOverlay.waitFor({ state: "detached", timeout: 15_000 });
  }

  // The startup artwork alone is not enough: wait until the actual library menu renders.
  await page.waitForFunction(() => {
    const text = document.querySelector("#root")?.innerText || "";
    return text.includes("No games yet") || text.includes("Start from a scenario") || text.includes("Last Played");
  }, null, { timeout: 90_000 });
  await page.screenshot({ path: artifactsDir + "/browser-smoke-menu.png", fullPage: true });

  // Exercise the real new-game flow using a fresh, disposable browser profile.
  await page.getByRole("button", { name: "Start from a scenario", exact: true }).click({ timeout: 15_000 });
  await page.getByRole("button", { name: "New Game", exact: true }).first().click({ timeout: 30_000 });
  await page.getByText("Choose your country", { exact: true }).waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "Scenario default", exact: true }).click({ timeout: 15_000 });
  await page.getByRole("button", { name: /Medium/ }).click({ timeout: 15_000 });

  const readActiveGameId = async () => page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("open-historia-web");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("kv", "readonly");
      const get = tx.objectStore("kv").get("game-manifest");
      get.onerror = () => { db.close(); reject(get.error); };
      get.onsuccess = () => {
        const id = get.result?.value?.activeGameId || null;
        db.close();
        resolve(id);
      };
    };
  }));
  let activeGameId = null;
  const gameDeadline = Date.now() + 90_000;
  while (!activeGameId && Date.now() < gameDeadline) {
    activeGameId = await readActiveGameId();
    if (!activeGameId) await delay(500);
  }
  assert.ok(activeGameId, "Creating a game must persist a non-empty activeGameId.");
  await page.screenshot({ path: artifactsDir + "/browser-smoke-active-game.png", fullPage: true });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  await delay(2_000);
  assert.equal(await readActiveGameId(), activeGameId, "The active game must survive a browser reload.");

  // Let asynchronous startup, map chunks and initial effects surface errors.
  await delay(5_000);
  await page.screenshot({ path: artifactsDir + "/browser-smoke.png", fullPage: true });
  assert.deepEqual(pageErrors, [], `Uncaught browser errors:\n${pageErrors.join("\n\n")}`);

  console.log("Browser E2E passed: web app reached the library, created a game, persisted it across reload, and reported no uncaught page errors.");
} catch (error) {
  if (browser) {
    try {
      const pages = browser.contexts().flatMap((context) => context.pages());
      if (pages[0]) await pages[0].screenshot({ path: `${artifactsDir}/browser-smoke-failure.png`, fullPage: true });
    } catch {
      // Screenshot is best-effort when Chromium is already shutting down.
    }
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
