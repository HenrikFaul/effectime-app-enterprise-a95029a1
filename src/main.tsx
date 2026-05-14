import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerEffectimeServiceWorker, captureInstallPrompt } from "./lib/pwa/registerSW";

// PWA bootstrap (v3.32.0 — Top-20 Rank 7).
// Capture the install prompt BEFORE the SW registers so it's available
// the moment the prompt component mounts.
captureInstallPrompt();
void registerEffectimeServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
