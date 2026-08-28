const { contextBridge, ipcRenderer } = require("electron");

const GATEWAY_PORT = Number(process.env.TEAMTHINK_GATEWAY_PORT || 11434);

contextBridge.exposeInMainWorld("teamthinkDesktop", {
  platform: process.platform,
  isDesktop: true,
  gateway: {
    port: GATEWAY_PORT,
    onRequest(cb) {
      const listener = (_event, id, method, path, body, apiKey) => {
        void cb(id, method, path, body, apiKey);
      };
      ipcRenderer.on("gateway-request", listener);
      return () => ipcRenderer.removeListener("gateway-request", listener);
    },
    respond(id, status, body) {
      ipcRenderer.send("gateway-response", id, status, body);
    },
  },
});
