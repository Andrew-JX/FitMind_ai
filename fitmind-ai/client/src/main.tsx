import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
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
        <App />
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>,
);

registerServiceWorker();
