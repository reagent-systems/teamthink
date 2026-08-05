#!/usr/bin/env node
/**
 * Upload .github/social-preview.jpg to the repo's GitHub Social preview
 * (Settings → Social preview). Required for X/Twitter cards when sharing
 * https://github.com/reagent-systems/teamthink — GitHub has no public API.
 *
 * Setup (once):
 *   cd scripts && npm install playwright && npx playwright install chromium
 *   node upload-github-social-preview.mjs --login
 *
 * Upload:
 *   node upload-github-social-preview.mjs
 *
 * Env:
 *   REPO=owner/name   (default: reagent-systems/teamthink)
 *   IMAGE=path.jpg    (default: ../.github/social-preview.jpg)
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const REPO = process.env.REPO || "reagent-systems/teamthink";
const IMAGE =
  process.env.IMAGE ||
  path.resolve(__dirname, "../.github/social-preview.jpg");
const STATE = path.join(
  os.homedir(),
  ".local/state/teamthink/github-playwright.json",
);

async function main() {
  const login = process.argv.includes("--login");
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    console.error(
      "Install Playwright first:\n  cd scripts && npm i playwright && npx playwright install chromium",
    );
    process.exit(1);
  }

  if (login) {
    fs.mkdirSync(path.dirname(STATE), { recursive: true });
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("https://github.com/login");
    console.log("Log into GitHub in the browser window, then return here…");
    await page.waitForFunction(
      () => !!document.querySelector('meta[name="user-login"]')?.content,
      null,
      { timeout: 0 },
    );
    await context.storageState({ path: STATE });
    await browser.close();
    console.log("Saved session to", STATE);
    return;
  }

  if (!fs.existsSync(IMAGE)) {
    console.error("Missing image:", IMAGE);
    process.exit(1);
  }
  if (!fs.existsSync(STATE)) {
    console.error("No saved session. Run: node upload-github-social-preview.mjs --login");
    process.exit(1);
  }
  const size = fs.statSync(IMAGE).size;
  if (size > 1_000_000) {
    console.error("Image must be under 1MB for GitHub social preview. Got", size);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE });
  const page = await context.newPage();
  await page.goto(`https://github.com/${REPO}/settings`, {
    waitUntil: "domcontentloaded",
  });
  if (page.url().includes("/login")) {
    await browser.close();
    console.error("Session expired. Re-run with --login");
    process.exit(1);
  }

  const heading = page.locator("xpath=//h2[normalize-space()='Social preview']").first();
  await heading.waitFor({ state: "attached", timeout: 60_000 });
  await heading.scrollIntoViewIfNeeded();

  const edit = page.locator("#edit-social-preview-button");
  if (await edit.count()) await edit.first().click({ force: true });
  else {
    const alt = page.locator(
      "xpath=(//h2[normalize-space()='Social preview']/following::*[(self::button or self::summary) and normalize-space(.)='Edit'][1])",
    );
    if (await alt.count()) await alt.first().click({ force: true });
  }

  const fileInput = page.locator("input#repo-image-file-input");
  await fileInput.first().waitFor({ state: "attached", timeout: 30_000 });
  await fileInput.first().setInputFiles(IMAGE);

  await page.waitForFunction(() => {
    const input = document.querySelector("input.js-repository-image-id");
    return !!((input?.value || "").trim());
  }, { timeout: 30_000 });

  await context.storageState({ path: STATE });
  await browser.close();

  const html = await fetch(`https://github.com/${REPO}`).then((r) => r.text());
  const m = html.match(/property="og:image" content="([^"]+)"/);
  console.log("Uploaded. og:image =", m?.[1] || "(check Settings → Social preview)");
  if (m?.[1]?.includes("repository-images")) {
    console.log("OK — custom social preview is live.");
  } else {
    console.warn("og:image may still be the default card; wait a few seconds and recheck.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
