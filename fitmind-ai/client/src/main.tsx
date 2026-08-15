import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { ToastProvider } from "./components/ToastProvider";
import "./index.css";
import { registerServiceWorker } from "./register-service-worker";
import { ThemeProvider } from "./theme/ThemeContext";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element '#root' was not found.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>,
);

registerServiceWorker();
