/** Real browser + disposable Termix and SSH/tmux, never production.
 * node scripts/verify-sessions-e2e.mjs /path/to/playwright-core/index.mjs /path/to/artifacts
 * Requires a disposable sshd/tmux image named termix-sessions-e2e-sshd:local.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const artifacts = resolve(process.argv[3]);
const testImage = process.argv[4] ?? "termix:sessions-recovery-20261102";
const tag = `sessions-e2e-${randomUUID().slice(0, 8)}`;
const network = `${tag}-net`,
  seed = `${tag}-seed`,
  data = `${tag}-data`,
  sshd = `${tag}-ssh`,
  web = `${tag}-web`;
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 4_000_000,
  }).trim();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = { assertions: [], consoleErrors: [], dialogs: [] };
let browser;
let capture = async () => ({});
const authorizedBases = new Set();
async function startWeb(volume) {
  docker(
    "create",
    "--name",
    web,
    "--network",
    network,
    "-e",
    "PUID=0",
    "-e",
    "PGID=0",
    "-e",
    "ENABLE_SSL=false",
    "--mount",
    `type=volume,source=${volume},target=/app/data`,
    testImage,
  );
  docker("start", web);
  const ip = docker(
    "inspect",
    web,
    "--format",
    "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}",
  );
  assert(/^\d+\.\d+\.\d+\.\d+$/.test(ip));
  const base = `http://${ip}:8080`;
  authorizedBases.add(base);
  for (let n = 0; n < 90; n++) {
    try {
      const result = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(1500),
      });
      if (result.ok) return base;
    } catch {
      /* still starting */
    }
    await pause(500);
  }
  throw new Error(
    `Isolated app did not start: ${docker("logs", "--tail", "50", web)}`,
  );
}
async function api(context, base, method, path, body, headers) {
  assert(
    authorizedBases.has(base),
    "API requests must target this script's disposable containers",
  );
  const response = await context.request.fetch(base + path, {
    method,
    ...(body === undefined ? {} : { data: body }),
    headers,
  });
  const text = await response.text();
  if (!response.ok())
    throw new Error(
      `${method} ${path}: ${response.status()} ${text.slice(0, 700)}`,
    );
  return text ? JSON.parse(text) : null;
}
async function login(context, base) {
  await api(context, base, "POST", "/users/login", {
    username: "sessions-e2e",
    password: "Sessions-fixture-only-482!",
  });
}
async function snapshot(page) {
  return page.evaluate(() => {
    const key = Object.keys(sessionStorage).find((key) =>
      key.startsWith("sessions:recovery:v1:"),
    );
    return key ? JSON.parse(sessionStorage.getItem(key)) : null;
  });
}
async function waitSnapshot(page, count) {
  await page.waitForFunction(
    (count) => {
      const key = Object.keys(sessionStorage).find((key) =>
        key.startsWith("sessions:recovery:v1:"),
      );
      return (
        key &&
        JSON.parse(sessionStorage.getItem(key)).layout.tabs.length === count
      );
    },
    count,
    { timeout: 30_000 },
  );
  return snapshot(page);
}
async function registry(page) {
  return page.evaluate(async () => {
    const sdk = await import("@termix-ssh/plugin-sdk/frontend");
    return sdk.invokeAction("terminal.listSessions");
  });
}
async function reloadManaged(page, count) {
  // Wait until the plugin has durably saved the latest tab changes. While a
  // save is pending, retaining the unload warning is intentional.
  await page.waitForFunction(
    () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return !event.defaultPrevented;
    },
    null,
    { timeout: 30_000 },
  );
  const previous = JSON.stringify(await snapshot(page));
  await page.reload();
  await page.waitForFunction(
    ({ previous, count }) => {
      const key = Object.keys(sessionStorage).find((key) =>
        key.startsWith("sessions:recovery:v1:"),
      );
      const value = key && sessionStorage.getItem(key);
      return (
        value &&
        value !== previous &&
        JSON.parse(value).layout.tabs.length === count
      );
    },
    { previous, count },
    { timeout: 30_000 },
  );
  await page.waitForFunction(
    async (count) => {
      try {
        const sdk = await import("@termix-ssh/plugin-sdk/frontend");
        return (
          (await sdk.invokeAction("terminal.listSessions"))?.length === count
        );
      } catch {
        return false;
      }
    },
    count,
    { timeout: 30_000 },
  );
  return snapshot(page);
}
async function openPanel(page) {
  const rail = page.locator('button:has(span:text-is("Sessions"))');
  await rail.waitFor();
  if (!(await page.getByPlaceholder("codex-termix").isVisible()))
    await rail.click();
  await page.mouse.move(900, 250);
  await page.getByPlaceholder("codex-termix").waitFor();
}
function sessionRow(page, name) {
  return page
    .locator('div[class~="group/row"]')
    .filter({ has: page.getByText(name, { exact: true }) })
    .first();
}
async function rowAction(page, name, action) {
  const row = sessionRow(page, name);
  // Hover trays change neighboring row geometry. Dispatch to the identified
  // button so a pointer move cannot land on a different row during reflow.
  const button = row.getByRole("button", {
    name: action,
    exact: true,
    includeHidden: true,
  });
  assert(await button.isEnabled());
  await button.dispatchEvent("click");
}

try {
  docker("network", "create", "--internal", network);
  docker("volume", "create", seed);
  docker("volume", "create", data);
  docker(
    "run",
    "-d",
    "--name",
    sshd,
    "--network",
    network,
    "--network-alias",
    "sessions-fixture",
    "termix-sessions-e2e-sshd:local",
  );
  let base = await startWeb(seed);
  console.log("isolated seed started");
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const setup = await browser.newContext();
  await api(setup, base, "POST", "/users/create", {
    username: "sessions-e2e",
    password: "Sessions-fixture-only-482!",
  });
  await login(setup, base);
  await api(setup, base, "PUT", "/plugins/developer-mode", { enabled: true });
  for (const filename of ["sessions-0.2.0.tmxplug"]) {
    const upload = await api(
      setup,
      base,
      "POST",
      "/plugins/upload",
      await readFile(resolve(artifacts, filename)),
      { "content-type": "application/octet-stream" },
    );
    await api(setup, base, "POST", `/plugins/upload/${upload.token}/install`, {
      capabilities: upload.capabilities,
    });
  }
  const list = await api(setup, base, "GET", "/plugins");
  const plugins = Array.isArray(list) ? list : list.plugins;
  for (const id of [
    "classic-layout",
    "classic-themes",
    "ssh-terminal",
    "workspaces",
    "sessions",
  ]) {
    if (!plugins.find((plugin) => plugin.id === id)?.enabled)
      await api(setup, base, "PATCH", `/plugins/${id}/state`, {
        enabled: true,
      });
  }
  const keep = new Set([
    "classic-layout",
    "classic-themes",
    "ssh-terminal",
    "workspaces",
    "sessions",
  ]);
  await api(setup, base, "POST", "/plugins/onboarding/apply", {
    choices: Object.fromEntries(
      plugins.map((plugin) => [
        plugin.id,
        keep.has(plugin.id) ? "enabled" : "disabled",
      ]),
    ),
  });
  await api(setup, base, "PUT", "/user-preferences", {
    reopenTabsOnLogin: true,
  });
  await api(setup, base, "PUT", "/ui-preferences", {
    onboarding: {
      completedAt: new Date().toISOString(),
      baselinePending: false,
      seen: {
        plugins: 999,
        security: 999,
        "desktop-updates": 999,
        "classic-layout:preset": 999,
        "classic-layout:appearance": 999,
      },
    },
  });
  const host = await api(setup, base, "POST", "/host/db/host", {
    name: "sessions-fixture",
    connectionType: "ssh",
    ip: "sessions-fixture",
    port: 22,
    username: "root",
    authType: "password",
    password: "sessions-e2e-disposable",
    statusCheckEnabled: false,
  });
  report.hostId = host.id;
  await setup.close();
  console.log("seed configured");
  // Test against a coherent COPY of a disposable seed volume, never live data.
  docker("stop", web);
  docker("rm", web);
  docker(
    "run",
    "--rm",
    "--network",
    "none",
    "--mount",
    `type=volume,source=${seed},target=/seed,readonly`,
    "--mount",
    `type=volume,source=${data},target=/app/data`,
    "--entrypoint",
    "sh",
    testImage,
    "-c",
    "cp -a /seed/. /app/data/",
  );
  base = await startWeb(data);
  console.log("copied fixture started");
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await login(context, base);
  await context.addInitScript(() =>
    localStorage.setItem(
      "termix_auth",
      JSON.stringify({ loggedIn: true, username: "sessions-e2e" }),
    ),
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => report.consoleErrors.push(error.message));
  page.on("dialog", async (dialog) => {
    report.dialogs.push(dialog.type());
    await dialog.accept();
  });
  capture = async () => ({
    cache: await snapshot(page),
    known: await page.evaluate(() =>
      Object.fromEntries(
        Object.entries(localStorage).filter(([key]) =>
          key.startsWith("sessions:recovery:v1:"),
        ),
      ),
    ),
    openTabs: await api(context, base, "GET", "/open-tabs"),
    activeSessions: await api(
      context,
      base,
      "GET",
      "/open-tabs/active-sessions",
    ),
    registry: await registry(page).catch((error) => ({ error: error.message })),
  });
  await page.goto(base);
  await openPanel(page);
  await page.getByPlaceholder("codex-termix").fill("e2e-one");
  await page
    .getByRole("button", { name: "Create session", exact: true })
    .click();
  await waitSnapshot(page, 1);
  const acceptKey = page.getByRole("button", {
    name: "Accept & Continue",
    exact: true,
  });
  await acceptKey.waitFor({ timeout: 20_000 });
  const fingerprints = docker(
    "exec",
    sshd,
    "sh",
    "-c",
    'for key in /etc/ssh/ssh_host_*_key.pub; do ssh-keygen -lf "$key"; done',
  );
  const shown = await page
    .locator("input[readonly]")
    .evaluateAll((inputs) => inputs.map((input) => input.value))
    .catch(() => []);
  const body = await page.locator("body").innerText();
  assert(
    fingerprints
      .split("\n")
      .some(
        (line) =>
          line.split(" ")[1] &&
          (body.includes(line.split(" ")[1]) ||
            shown.some((value) => value.includes(line.split(" ")[1]))),
      ),
    "accept only the disposable fixture's public host key",
  );
  await acceptKey.click();
  await page.waitForFunction(
    () => document.querySelector(".xterm-rows")?.textContent?.includes("root@"),
    null,
    { timeout: 30_000 },
  );
  console.log("first managed terminal connected");
  report.firstConnection = await capture();
  for (const name of ["e2e-two", "e2e-three"]) {
    await api(context, base, "POST", "/plugin-api/sessions/", {
      hostId: host.id,
      displayName: name,
      tmuxSessionName: name,
    });
  }
  await reloadManaged(page, 1);
  await openPanel(page);
  for (const name of ["e2e-two", "e2e-three"])
    await rowAction(page, name, "Attach");
  const before = await waitSnapshot(page, 3);
  assert.equal(
    new Set(before.layout.tabs.map((tab) => tab.data.sessionsSessionId)).size,
    3,
  );
  const order = before.layout.tabs.map((tab) => tab.data.sessionsSessionId);
  report.beforeReload = await capture();
  const after = await reloadManaged(page, 3);
  assert.deepEqual(
    after.layout.tabs.map((tab) => tab.data.sessionsSessionId),
    order,
  );
  assert.equal(
    report.dialogs.length,
    0,
    "recoverable views must not prompt on reload",
  );
  report.assertions.push(
    "reload restores three distinct views in order without unload dialog",
  );
  const second = await context.newPage();
  second.on("dialog", async (dialog) => {
    report.dialogs.push(dialog.type());
    await dialog.accept();
  });
  await second.goto(base);
  const cloned = await waitSnapshot(second, 3);
  const firstInstances = new Set(
    Object.values(after.links).map((link) => link.instanceId),
  );
  assert(
    Object.values(cloned.links).every(
      (link) => !firstInstances.has(link.instanceId),
    ),
    "new window must have independent transport identities",
  );
  assert.deepEqual(
    (await snapshot(page)).layout.tabs.map((tab) => tab.data.sessionsSessionId),
    order,
  );
  await second
    .locator('div[class~="group/tab"]')
    .filter({ hasText: "e2e-three" })
    .getByRole("button")
    .last()
    .click();
  await waitSnapshot(second, 2);
  assert(
    docker("exec", sshd, "tmux", "list-sessions", "-F", "#{session_name}")
      .split("\n")
      .includes("e2e-three"),
    "X must leave remote session alive",
  );
  assert.equal((await snapshot(page)).layout.tabs.length, 3);
  await reloadManaged(second, 2);
  await second.close();
  report.assertions.push(
    "tab X disconnects only that view, keeps remote session alive and preserves the other window",
  );
  report.assertions.push(
    "new window clones layout with independent views and preserves the first window",
  );
  await openPanel(page);
  await rowAction(page, "e2e-three", "Rename session");
  await page
    .locator("[data-setting-row]")
    .filter({ hasText: "Session name" })
    .locator("input")
    .fill("e2e-renamed");
  await page
    .getByRole("button", { name: "Save", exact: true, includeHidden: true })
    .dispatchEvent("click");
  await page.waitForFunction(() =>
    Object.values(sessionStorage).some((value) =>
      value.includes('"tmuxSession":"e2e-renamed"'),
    ),
  );
  assert(
    docker("exec", sshd, "tmux", "list-sessions", "-F", "#{session_name}")
      .split("\n")
      .includes("e2e-renamed"),
  );
  await reloadManaged(page, 3);
  report.assertions.push(
    "rename updates reconnect metadata and reconnects to the renamed remote session",
  );
  await openPanel(page);
  await rowAction(page, "e2e-one", "Split");
  await page.waitForFunction(() =>
    Object.values(sessionStorage).some((value) => {
      try {
        return JSON.parse(value).layout?.splits?.length === 1;
      } catch {
        return false;
      }
    }),
  );
  await rowAction(page, "e2e-two", "Split");
  await page.waitForFunction(() =>
    Object.values(sessionStorage).some((value) => {
      try {
        return JSON.parse(value).layout?.splits?.length === 1;
      } catch {
        return false;
      }
    }),
  );
  await page.waitForFunction(() =>
    Object.values(sessionStorage).some((value) => {
      try {
        const layout = JSON.parse(value).layout;
        const panes = (node) =>
          node.kind === "pane" ? [node] : node.children.flatMap(panes);
        return (
          layout?.splits?.length === 1 &&
          panes(layout.splits[0].root).filter((pane) => pane.tabId).length === 2
        );
      } catch {
        return false;
      }
    }),
  );
  const split = await reloadManaged(page, 3);
  assert.equal(split.layout.splits.length, 1);
  report.assertions.push("split survives reload without duplicate split tabs");
  await openPanel(page);
  await rowAction(page, "e2e-renamed", "Terminate e2e-renamed?");
  await page.getByRole("button", { name: "Terminate", exact: true }).click();
  await waitSnapshot(page, 2);
  await reloadManaged(page, 2);
  report.assertions.push(
    "confirmed termination closes the view and it does not reopen",
  );
  await page.screenshot({ path: resolve(artifacts, "sessions-e2e.png") });
  assert.deepEqual(report.consoleErrors, []);
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.error = error.stack;
  try {
    report.lastState = await capture();
  } catch {
    /* context may be closing */
  }
  const failedPage = browser
    ?.contexts()
    .flatMap((context) => context.pages())
    .at(-1);
  if (failedPage) {
    try {
      await failedPage.screenshot({
        path: resolve(artifacts, "sessions-e2e-failure.png"),
      });
      report.pageText = (await failedPage.locator("body").innerText()).slice(
        0,
        3000,
      );
    } catch {
      /* page may be closed */
    }
  }
  try {
    report.appLog = docker("logs", "--tail", "60", web);
  } catch {
    /* failed before start */
  }
  throw error;
} finally {
  await writeFile(
    resolve(artifacts, "sessions-e2e.json"),
    JSON.stringify(report, null, 2),
  );
  if (browser) await browser.close();
  for (const name of [web, sshd]) {
    try {
      docker("rm", "-f", name);
    } catch {
      /* own fixture only */
    }
  }
  for (const name of [seed, data]) {
    try {
      docker("volume", "rm", name);
    } catch {
      /* own fixture only */
    }
  }
  try {
    docker("network", "rm", network);
  } catch {
    /* own fixture only */
  }
}
