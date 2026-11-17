import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { StartProvider } from "./context/StartContext.jsx";
import { PlayersProvider } from "./context/PlayersContext.jsx";
import { FixturesProvider } from "./context/FixturesContext.jsx";
import "./styles.css";

// Offline support: the service worker (built by vite.config.js) caches the app so it
// opens without internet. Only in production builds — the dev server stays uncached.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <StartProvider>
        <PlayersProvider>
          <FixturesProvider>
            <App />
          </FixturesProvider>
        </PlayersProvider>
      </StartProvider>
    </BrowserRouter>
  </React.StrictMode>
);
