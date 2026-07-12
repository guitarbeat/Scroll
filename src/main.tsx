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

const shouldSuppressMessage = (args: any[]) => {
  return args.some(arg => {
    if (typeof arg !== "string") {
      if (arg instanceof Error) {
        return (
          arg.message.includes("ResizeObserver loop completed") ||
          arg.message.includes("ResizeObserver loop limit exceeded")
        );
      }
      return false;
    }
    return (
      arg.includes("No tldraw license key provided") ||
      arg.includes("A license is required for production deployments") ||
      arg.includes("sales@tldraw.com") ||
      arg.includes("Unable to preventDefault inside passive event listener invocation") ||
      arg.includes("passive event listener") ||
      arg.includes("ResizeObserver loop completed") ||
      arg.includes("ResizeObserver loop limit exceeded") ||
      arg.trim() === "-------------------------------------------------------------------"
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

// Directly intercept window.onerror to swallow the ResizeObserver warnings completely
const originalOnError = window.onerror;
window.onerror = function (message, source, lineno, colno, error) {
  const msgStr = typeof message === "string" ? message : (message?.toString() || "");
  if (
    msgStr.includes("ResizeObserver loop completed") ||
    msgStr.includes("ResizeObserver loop limit exceeded") ||
    (error && error.message && (error.message.includes("ResizeObserver loop completed") || error.message.includes("ResizeObserver loop limit exceeded")))
  ) {
    return true; // Prevents the firing of the default browser error handler
  }
  if (originalOnError) {
    return originalOnError.apply(this, arguments as any);
  }
  return false;
};

// Intercept and ignore ResizeObserver loop completed/limit errors globally
window.addEventListener("error", (e) => {
  const isResizeObserverError = 
    (e.message && (e.message.includes("ResizeObserver loop completed") || e.message.includes("ResizeObserver loop limit exceeded"))) ||
    (e.error && e.error.message && (e.error.message.includes("ResizeObserver loop completed") || e.error.message.includes("ResizeObserver loop limit exceeded")));

  if (isResizeObserverError) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

// Also swallow inside promise unhandled rejections if wrapped there
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason;
  if (reason) {
    const msg = reason.message || (typeof reason === "string" ? reason : "");
    if (msg.includes("ResizeObserver loop completed") || msg.includes("ResizeObserver loop limit exceeded")) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
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
