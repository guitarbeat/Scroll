import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Intercept and suppress the tldraw production license warning banners
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

const isTldrawLicenseMessage = (args: any[]) => {
  const text = args.map(arg => (arg && typeof arg === "object" ? JSON.stringify(arg) : String(arg))).join(" ");
  return (
    text.includes("No tldraw license key provided") ||
    text.includes("A license is required for production deployments") ||
    text.includes("sales@tldraw.com") ||
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
