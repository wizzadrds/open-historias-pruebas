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

const dismissProviderSetup = async (page) => {
  // Fresh browser profiles have no provider key. The optional setup dialog can
  // cover gameplay controls even though the active game has already persisted.
  const notNow = page.getByRole("button", { name: "Not now", exact: true });
  if (await notNow.isVisible().catch(() => false)) {
    await notNow.evaluate((button) => button.click());
    await notNow.waitFor({ state: "hidden", timeout: 15_000 });
  }
};

const waitForGameplayReady = async (page, timeout = 90_000) => {
  await page.waitForFunction(() => {
    const text = document.querySelector("#root")?.innerText || "";
    // A persisted game ID is not proof that gameplay has finished initializing.
    return !/DRAWING BORDERS AND LABELS|LOADING WORLD|INITIALIZING WORLD/i.test(text);
  }, null, { timeout });
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
    return [...root.querySelectorAll("*")].some((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" &&
        Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    });
  }, null, { timeout: 90_000 });

  // Enter through the actual connection gate and demo notice.
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

  await page.waitForFunction(() => {
    const text = document.querySelector("#root")?.innerText || "";
    return text.includes("No games yet") || text.includes("Start from a scenario") || text.includes("Last Played");
  }, null, { timeout: 90_000 });

  // The first-run analytics consent dialog can intercept clicks across the app.
  // Decline optional analytics so this smoke test stays deterministic and privacy-preserving.
  const declineAnalytics = page.getByRole("button", { name: "No, thanks", exact: true });
  if (await declineAnalytics.isVisible().catch(() => false)) {
    // This optional consent layer can remain non-interactable during its entrance animation.
    // Dispatch its own button click directly, then wait for the overlay to close.
    await declineAnalytics.evaluate((button) => button.click());
    await declineAnalytics.waitFor({ state: "hidden", timeout: 10_000 });
  }

  await page.screenshot({ path: artifactsDir + "/browser-smoke-menu.png", fullPage: true });

  const startScenario = page.getByRole("button", { name: "Start from a scenario", exact: true });
  await startScenario.waitFor({ state: "visible", timeout: 15_000 });
  // The home screen can retain an invisible animated hit-test layer briefly;
  // activate the visible control directly and assert the next screen appears.
  await startScenario.evaluate((button) => button.click());
  await page.getByRole("button", { name: "New Game", exact: true }).first().waitFor({ state: "visible", timeout: 20_000 });
  await page.getByRole("button", { name: "New Game", exact: true }).first().click({ timeout: 30_000 });
  await page.getByText("Choose your country", { exact: true }).waitFor({ timeout: 20_000 });
  // This picker overlays an animated map canvas whose hit-testing can stall
  // Playwright's click even with force enabled. Dispatch the visible control's
  // click directly, then assert the next setup step appears.
  const defaultScenario = page.getByRole("button", { name: "Scenario default", exact: true });
  await defaultScenario.waitFor({ state: "visible", timeout: 15_000 });
  await defaultScenario.evaluate((button) => button.click());
  const mediumDifficulty = page.getByRole("button", { name: /Medium/ });
  await mediumDifficulty.waitFor({ state: "visible", timeout: 15_000 });
  // World setup can make Playwright's click action time out after dispatching it.
  // Click the visible control directly, then observe persisted game state below.
  await mediumDifficulty.evaluate((button) => button.click());

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
  await dismissProviderSetup(page);
  await waitForGameplayReady(page);
  await page.screenshot({ path: artifactsDir + "/browser-smoke-active-game.png", fullPage: true });

  await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  await delay(2_000);
  assert.equal(await readActiveGameId(), activeGameId, "The active game must survive a browser reload.");
  await dismissProviderSetup(page);
  // Do not count persistence as a successful reload if the game remains on its loading screen.
  await waitForGameplayReady(page);
  await delay(2_000);

  // Exercise a real player interaction, not just the loading screen: queue a
  // deterministic manual order and assert it appears in the submitted-orders
  // panel. This does not claim the simulation turn has been resolved.
  const actionsToggle = page.locator('button[title="Actions"]').first();
  await actionsToggle.waitFor({ state: "visible", timeout: 30_000 });
  // Gameplay panels can animate over the toolbar and intercept pointer events in headless Chromium.
  // Dispatch the real button handler directly after confirming the control is visible.
  await actionsToggle.evaluate((button) => button.click());
  const orderText = "Automated browser test: prioritize public infrastructure";
  const actionComposer = page.getByPlaceholder(/Enter your action/).first();
  await actionComposer.waitFor({ state: "visible", timeout: 15_000 });
  await actionComposer.fill(orderText);
  await page.getByRole("button", { name: "Submit action", exact: true }).evaluate((button) => button.click());
  await page.getByText(orderText, { exact: false }).first().waitFor({ state: "visible", timeout: 15_000 });
  await page.screenshot({ path: artifactsDir + "/browser-smoke-order-queued.png", fullPage: true });

  // Advance one in-game day and verify the displayed simulation date changes.
  // This is the first end-to-end assertion that the game processes a turn,
  // rather than merely accepting an order in its UI.
  const timelineToggle = page.getByRole("button", { name: "Timeline", exact: true });
  await timelineToggle.waitFor({ state: "visible", timeout: 15_000 });
  const readDisplayedDate = () => timelineToggle.evaluate((button) => button.parentElement?.children?.[1]?.innerText?.trim() || "");
  const dateBefore = await readDisplayedDate();
  await timelineToggle.evaluate((button) => button.click());
  const oneDayJump = page.locator("button.oh-tap-row").filter({ hasText: /1 day/ }).first();
  await oneDayJump.waitFor({ state: "visible", timeout: 15_000 });
  await oneDayJump.evaluate((button) => button.click());
  await page.waitForFunction(() => {
    const timeline = document.querySelector('button[aria-label="Timeline"]');
    if (!timeline) return false;
    const dockText = timeline.parentElement?.innerText || "";
    const loading = /Simulating|Processing|Loading/i.test(dockText);
    return !loading;
  }, null, { timeout: 120_000 });
  await page.waitForFunction((before) => {
    const timeline = document.querySelector('button[aria-label="Timeline"]');
    return Boolean(timeline && (timeline.parentElement?.children?.[1]?.innerText?.trim() || "") !== before);
  }, dateBefore, { timeout: 120_000 }).catch(async (error) => {
    const diagnostic = await page.locator('button[aria-label="Timeline"]').evaluate((button) => ({
      date: button.parentElement?.children?.[1]?.innerText?.trim() || "",
      dockText: button.parentElement?.innerText || "",
    })).catch(() => ({ date: "", dockText: "Timeline control unavailable" }));
    throw new Error(`Simulation date did not change within 120 seconds (before="${dateBefore}", after="${diagnostic.date}", timeline="${diagnostic.dockText}"): ${error.message}`);
  });
  const dateAfter = await readDisplayedDate();
  assert.notEqual(dateAfter, dateBefore, "Advancing one day must change the displayed in-game date.");

  // Advancing the date proves the simulation turn completed. The free-text
  // order is not guaranteed to produce a deterministic world effect, and the
  // Actions panel may continue displaying resolved orders; do not infer
  // processing from whether its text happens to remain visible.
  await page.screenshot({ path: artifactsDir + "/browser-smoke-turn-advanced.png", fullPage: true });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  await waitForGameplayReady(page);
  // The generic loading text can disappear before the gameplay toolbar mounts.
  // Wait for the actual timeline control before reading the persisted date.
  const reloadedTimeline = page.locator('button[aria-label="Timeline"]');
  await reloadedTimeline.waitFor({ state: "visible", timeout: 90_000 });
  // The toolbar may mount while its date still shows a placeholder. Wait for
  // the persisted game state to hydrate before comparing the date.
  await page.waitForFunction((expectedDate) => {
    const timeline = document.querySelector('button[aria-label="Timeline"]');
    const displayedDate = timeline?.parentElement?.children?.[1]?.innerText?.trim() || "";
    return displayedDate === expectedDate;
  }, dateAfter, { timeout: 120_000 });
  const dateAfterReload = await reloadedTimeline.evaluate((button) => button.parentElement?.children?.[1]?.innerText?.trim() || "");
  assert.equal(dateAfterReload, dateAfter, "The advanced in-game date must survive a browser reload.");

  await page.screenshot({ path: artifactsDir + "/browser-smoke.png", fullPage: true });
  assert.deepEqual(pageErrors, [], `Uncaught browser errors:\n${pageErrors.join("\n\n")}`);

  console.log("Browser E2E passed: game created and reloaded, a manual order was queued, one simulation day advanced and persisted after reload, and no uncaught page errors were observed.");
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
