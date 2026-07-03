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
  return args.some(arg => {
    if (typeof arg !== "string") return false;
    return (
      arg.includes("No tldraw license key provided") ||
      arg.includes("A license is required for production deployments") ||
      arg.includes("sales@tldraw.com") ||
      arg.includes("Unable to preventDefault inside passive event listener invocation") ||
      arg.includes("passive event listener") ||
      arg.trim() === "-------------------------------------------------------------------"
    );
  });
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
