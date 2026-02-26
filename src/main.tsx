import React from "react";
import ReactDOM from "react-dom/client";
import { DiscordSDK } from "@discord/embedded-app-sdk";
import App from "./App";
import "./index.css";

function render() {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

const params = new URLSearchParams(window.location.search);

if (params.has('frame_id')) {
  // Läuft innerhalb von Discord
  const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
  discordSdk.ready().then(render);
} else {
  // Lokaler Browser-Dev-Modus
  render();
}
