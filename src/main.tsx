import React from "react";
import ReactDOM from "react-dom/client";
import { DiscordSDK } from "@discord/embedded-app-sdk";
import App from "./App";
import "./index.css";

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID as string;

function render(discordUserId?: string, username?: string, avatar?: string) {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App discordUserId={discordUserId} username={username} avatar={avatar} />
    </React.StrictMode>
  );
}

const params = new URLSearchParams(window.location.search);

if (params.has('frame_id')) {
  // Running inside a Discord Activity
  const discordSdk = new DiscordSDK(CLIENT_ID);

  (async () => {
    await discordSdk.ready();

    // Request an OAuth authorization code
    const { code } = await discordSdk.commands.authorize({
      client_id: CLIENT_ID,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: ['identify'],
    });

    // Exchange the code for an access token via our backend
    const response = await fetch('/.proxy/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const { access_token } = await response.json();

    // Authenticate with Discord and get the current user's info
    const auth = await discordSdk.commands.authenticate({ access_token });

    render(auth.user.id, auth.user.username, auth.user.avatar ?? undefined);
  })().catch((err) => {
    console.error('Discord auth failed:', err);
    render(); // fall back to anonymous mode
  });
} else {
  // Running in a regular browser (web mode)
  render();
}
