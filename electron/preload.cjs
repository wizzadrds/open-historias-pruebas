/*! Open Historia — setup-window preload bridge © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
// The setup window shows an update installing as the game opens, with a button
// to open the game now instead and, on the stable app, one that opens the
// beta's download in the player's browser; then the map download. So it gets the
// narrowest possible bridge: three listeners in, three actions out. Context
// isolation stays on (the default) — the page never sees ipcRenderer itself.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ohSetup", {
  onProgress: (fn) => ipcRenderer.on("setup:progress", (_event, payload) => fn(payload)),
  onDone: (fn) => ipcRenderer.on("setup:done", () => fn()),
  onUpdate: (fn) => ipcRenderer.on("setup:update", (_event, payload) => fn(payload)),
  updateLater: () => ipcRenderer.invoke("setup:update-later"),
  openBeta: () => ipcRenderer.invoke("setup:open-beta"),
  cancel: () => ipcRenderer.invoke("setup:cancel"),
});
