import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    allowedHosts: true,
    proxy: {
      '/img-proxy': {
        target: 'https://www.steal-a-brainrot.de',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/img-proxy/, ''),
      },
    },
  },
});
