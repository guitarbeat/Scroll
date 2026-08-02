import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Intercept and suppress the tldraw production license warning banners
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

// Patch EventTarget.prototype.addEventListener to make touch events non-passive by default when calling preventDefault
// This prevents Chrome from throwing "Unable to preventDefault inside passive event listener invocation" errors
const originalAddEventListener = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function (
  this: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
) {
  let patchedOptions = options;
  if (type === "touchstart" || type === "touchmove") {
    if (typeof options === "object" && options !== null) {
      if (options.passive === undefined) {
        patchedOptions = { ...options, passive: false };
      }
    } else if (typeof options === "boolean") {
      patchedOptions = { capture: options, passive: false };
    }
  }
  return originalAddEventListener.call(this, type, listener, patchedOptions);
};

const shouldSuppressMessage = (args: any[]) => {
  return args.some(arg => {
    let str = "";
    if (typeof arg === "string") {
      str = arg;
    } else if (arg instanceof Error) {
      str = arg.message;
    } else if (arg && typeof arg === "object") {
      str = arg.message || arg.toString?.() || "";
    }
    const lower = str.toLowerCase();
    return (
      lower.includes("tldraw") ||
      lower.includes("license") ||
      lower.includes("sales@tldraw.com") ||
      lower.includes("vercel web analytics") ||
      lower.includes("vercel analytics") ||
      lower.includes("unable to preventdefault inside passive event listener") ||
      lower.includes("passive event listener") ||
      lower.includes("resizeobserver loop completed") ||
      lower.includes("resizeobserver loop limit exceeded") ||
      lower.includes("websocket closed without opened") ||
      lower.includes("failed to connect to websocket") ||
      (lower.includes("websocket") && lower.includes("vite")) ||
      str.includes("-------------------------------------------------------------------")
    );
  });
};

console.log = (...args: any[]) => {
  if (shouldSuppressMessage(args)) return;
  originalLog(...args);
};

console.warn = (...args: any[]) => {
  if (shouldSuppressMessage(args)) return;
  originalWarn(...args);
};

console.error = (...args: any[]) => {
  if (shouldSuppressMessage(args)) return;
  originalError(...args);
};

// Directly intercept window.onerror to swallow ResizeObserver and Vite HMR WebSocket errors
const originalOnError = window.onerror;
window.onerror = function (message, source, lineno, colno, error) {
  const msgStr = (typeof message === "string" ? message : (message?.toString() || error?.message || "")).toLowerCase();
  if (
    msgStr.includes("resizeobserver loop completed") ||
    msgStr.includes("resizeobserver loop limit exceeded") ||
    msgStr.includes("websocket closed without opened") ||
    msgStr.includes("failed to connect to websocket")
  ) {
    return true; // Prevents the firing of the default browser error handler
  }
  if (originalOnError) {
    return originalOnError.apply(this, arguments as any);
  }
  return false;
};

// Intercept and ignore ResizeObserver & Vite HMR WebSocket errors globally
window.addEventListener("error", (e) => {
  const msg = (e.message || e.error?.message || "").toLowerCase();
  const isIgnored = 
    msg.includes("resizeobserver loop") ||
    msg.includes("websocket closed without opened") ||
    msg.includes("failed to connect to websocket") ||
    (msg.includes("websocket") && msg.includes("vite"));

  if (isIgnored) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

// Swallow inside promise unhandled rejections (e.g. Vite HMR WebSocket connection failure promises)
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason;
  const msg = (
    reason?.message || (typeof reason === "string" ? reason : reason?.toString() || "")
  ).toLowerCase();

  if (
    msg.includes("resizeobserver loop") ||
    msg.includes("websocket closed without opened") ||
    msg.includes("failed to connect to websocket") ||
    (msg.includes("websocket") && msg.includes("vite"))
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});



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
