/**
 * TeamThink desktop shell — Chromium with WebGPU flags, loading the static
 * Next export from ../out (production) or the Next dev server (development).
 * Includes a local OpenAI-compatible HTTP gateway on 127.0.0.1:11434.
 */
const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");

app.commandLine.appendSwitch("enable-unsafe-webgpu");
app.commandLine.appendSwitch("enable-features", "Vulkan,UseSkiaRenderer");

const isDev = !app.isPackaged;
const DEV_URL = process.env.TEAMTHINK_DEV_URL || "http://127.0.0.1:3000";
const GATEWAY_PORT = Number(process.env.TEAMTHINK_GATEWAY_PORT || 11434);

function outDir() {
  if (isDev) return path.join(__dirname, "..", "out");
  return path.join(process.resourcesPath, "out");
}

function startStaticServer(root) {
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".wasm": "application/wasm",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".map": "application/json",
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const filePath = path.normalize(path.join(root, pathname));
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        const fallback = path.join(root, "index.html");
        fs.readFile(fallback, (err2, html) => {
          if (err2) {
            res.writeHead(404);
            res.end("Not found");
            return;
          }
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html);
        });
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": mime[ext] || "application/octet-stream",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

let mainWindow = null;
let staticServer = null;
let gatewayServer = null;
const pendingGateway = new Map();

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.trim()) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function startGatewayServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Api-Key");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const apiKey =
      req.headers["x-api-key"] ||
      (typeof req.headers.authorization === "string" &&
      req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null);

    if (!mainWindow?.webContents) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "TeamThink UI not ready" } }));
      return;
    }

    const id = `gw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      let body = null;
      if (req.method === "POST") body = await readBody(req);

      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingGateway.delete(id);
          reject(new Error("gateway timeout"));
        }, 180_000);
        pendingGateway.set(id, (status, payload) => {
          clearTimeout(timer);
          resolve({ status, payload });
        });
        mainWindow.webContents.send("gateway-request", id, req.method, pathname, body, apiKey);
      });

      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.payload));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: { message: err instanceof Error ? err.message : "gateway error" },
        }),
      );
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(GATEWAY_PORT, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

ipcMain.on("gateway-response", (_event, id, status, body) => {
  const cb = pendingGateway.get(id);
  if (cb) {
    pendingGateway.delete(id);
    cb(status, body);
  }
});

async function createWindow() {
  let startUrl = DEV_URL;
  if (!isDev) {
    const root = outDir();
    if (!fs.existsSync(path.join(root, "index.html"))) {
      console.error("Missing static export at", root);
    }
    const served = await startStaticServer(root);
    staticServer = served.server;
    startUrl = served.url;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: "TeamThink",
    backgroundColor: "#faf9f5",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(startUrl);
}

app.whenReady().then(async () => {
  try {
    gatewayServer = await startGatewayServer();
    console.log(`TeamThink OpenAI gateway listening on http://127.0.0.1:${GATEWAY_PORT}/v1`);
  } catch (err) {
    console.error("Gateway failed to start:", err);
  }
  void createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (staticServer) staticServer.close();
  if (gatewayServer) gatewayServer.close();
  if (process.platform !== "darwin") app.quit();
});
