const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("teamthinkDesktop", {
  platform: process.platform,
  isDesktop: true,
});
