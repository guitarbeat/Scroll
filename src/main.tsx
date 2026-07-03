import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Intercept and suppress the tldraw production license warning banners
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

// Patch EventTarget.prototype.addEventListener to make touch/wheel events non-passive by default
// This prevents Chrome from throwing "Unable to preventDefault inside passive event listener invocation" errors
const originalAddEventListener = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function (
  this: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
) {
  let patchedOptions = options;
  if (type === "touchstart" || type === "touchmove" || type === "touchend" || type === "wheel") {
    if (typeof options === "object" && options !== null) {
      if (options.passive === undefined || options.passive === true) {
        patchedOptions = { ...options, passive: false };
      }
    } else {
      patchedOptions = { capture: !!options, passive: false };
    }
  }
  return originalAddEventListener.call(this, type, listener, patchedOptions);
};

const isTldrawLicenseMessage = (args: any[]) => {
  const text = args.map(arg => (arg && typeof arg === "object" ? JSON.stringify(arg) : String(arg))).join(" ");
  return (
    text.includes("No tldraw license key provided") ||
    text.includes("A license is required for production deployments") ||
    text.includes("sales@tldraw.com") ||
    text.includes("Unable to preventDefault inside passive event listener invocation") ||
    text.includes("passive event listener") ||
    text.trim() === "-------------------------------------------------------------------"
  );
};

console.log = (...args: any[]) => {
  if (isTldrawLicenseMessage(args)) return;
  originalLog(...args);
};

console.warn = (...args: any[]) => {
  if (isTldrawLicenseMessage(args)) return;
  originalWarn(...args);
};

console.error = (...args: any[]) => {
  if (isTldrawLicenseMessage(args)) return;
  originalError(...args);
};

// Add global database & state diagnostic utility
if (typeof window !== "undefined") {
  (window as any).scribeDebug = async () => {
    const divider = "%c==================================================================";
    const dividerColor = "color: #cca162; opacity: 0.5;";
    
    console.log(divider, dividerColor);
    console.log(
      "%c📜 SCRIBE DIAGNOSTIC PANEL: Initiating Deep Synchronization Audit...",
      "color: #cca162; font-weight: bold; font-size: 13px; font-family: 'IM Fell English', 'Cinzel', serif; background: #26160d; padding: 4px 10px; border: 1px solid #cca162; border-radius: 4px;"
    );

    try {
      console.log("%c🔍 1. Querying API Gateway for Scribe link status...", "color: #eebd7b; font-weight: bold;");
      const res = await fetch("/api/canvas-state?status=true");
      if (!res.ok) {
        throw new Error(`API Gateway returned HTTP status ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      
      console.log(
        `%c✅ Scribe Link Status Received:`,
        "color: #10b981; font-weight: bold; font-family: monospace;",
        data
      );

      if (data.isKvConfigured) {
        if (data.pingSuccess) {
          console.log(
            `%c🟢 DATABASE REACHABLE: Vercel KV Redis database is responsive and writable!`,
            "color: #10b981; font-weight: bold; background: #064e3b; padding: 4px 8px; border-radius: 4px; border: 1px solid #10b981;"
          );
        } else {
          console.warn(
            `%c⚠️ DATABASE UNREACHABLE: Vercel KV environment credentials exist, but ping test failed!`,
            "color: #f59e0b; font-weight: bold; background: #78350f; padding: 4px 8px; border-radius: 4px; border: 1px solid #f59e0b;",
            "\nReason:", data.pingError
          );
        }
      } else {
        console.log(
          `%c🟤 LOCAL SANDBOX MODE: Vercel KV database is not configured. Falling back to local/in-memory storage.`,
          "color: #94a3b8; font-weight: bold; background: #1e293b; padding: 4px 8px; border-radius: 4px; border: 1px solid #475569;"
        );
      }

      console.log(
        `%c🖥️  Deployment Container Ingress: %c${data.environment || "Local Server"}`,
        "color: #a78bfa; font-family: monospace;",
        "color: #c084fc; font-weight: bold; font-family: monospace;"
      );

    } catch (err: any) {
      console.error(
        `%c❌ API Diagnostic Query Failed!`,
        "color: #f87171; font-weight: bold; background: #7f1d1d; padding: 4px; border-radius: 4px;",
        err
      );
    }

    // Try reading active editor state
    if ((window as any).tldrawEditor) {
      const editor = (window as any).tldrawEditor;
      try {
        const snapshot = editor.store.getSnapshot();
        const records = snapshot.store || {};
        const shapesCount = Object.values(records).filter((r: any) => r && r.typeName === "shape").length;
        console.log(
          `%c🎨 Active Scroll Canvas State:\n` +
          `   - Total Rendered Shapes: ${shapesCount}\n` +
          `   - Current Active Tool:   ${editor.getCurrentToolId()}\n` +
          `   - Document Zoom Scale:  ${Math.round(editor.getZoomLevel() * 100)}%\n` +
          `   - Editor Id:            ${editor.id || "Main Scribe"}\n` +
          `   - Total History Undos:  ${editor.getCanUndo() ? "Yes" : "None"}`,
          "color: #38bdf8; font-family: monospace; line-height: 1.4;"
        );
      } catch (err) {
        console.error("Error evaluating editor shapes", err);
      }
    } else {
      console.log(
        "%cℹ️  No active tldraw editor registered on window.tldrawEditor yet. Begin drawing on the scroll to initialize.",
        "color: #94a3b8; font-style: italic;"
      );
    }
    
    console.log(divider, dividerColor);
    return "Audit complete.";
  };

}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
