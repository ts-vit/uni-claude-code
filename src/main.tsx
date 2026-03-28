import React from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { UniProvider, TauriSettingsAdapter } from "@uni-fw/ui";
import { App } from "./App";
import "./i18n/i18n";
import "@uni-fw/ui/src/styles/markdown.css";

const settingsAdapter = new TauriSettingsAdapter(invoke);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <UniProvider settingsAdapter={settingsAdapter}>
      <App />
    </UniProvider>
  </React.StrictMode>,
);
