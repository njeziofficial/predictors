import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/push";
import { listenForInstallPrompt } from "./lib/install";

// Before anything renders: the browser offers installing the app once, early.
listenForInstallPrompt();

createRoot(document.getElementById("root")!).render(<App />);

registerServiceWorker();
