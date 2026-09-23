import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "@/App";
import { NoteSaveGuard } from "@/features/life/note-save-guard";
import "@/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <App />
      <NoteSaveGuard />
    </HashRouter>
  </StrictMode>,
);
