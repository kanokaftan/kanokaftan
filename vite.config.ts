import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    // Short commit id of this build, so app errors say which version they came from.
    __APP_RELEASE__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7)),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      // A new version takes over as soon as it downloads (see src/lib/registerServiceWorker.ts).
      registerType: "autoUpdate",
      // Registered in src/lib/registerServiceWorker.ts, which handles browsers that refuse it.
      injectRegister: null,
      includeAssets: ["favicon.ico", "robots.txt", "logo.svg"],
      manifest: {
        name: "K² Kano Kaftan",
        short_name: "K² Kaftan",
        description: "Clothing, fabrics, shoes, caps and accessories from trusted sellers",
        theme_color: "#2A0800",
        background_color: "#FAF9F7",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            // Extra padding so Android's round/squircle masks never cut the logo.
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        importScripts: ["/push-sw.js"],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        // Big libraries change rarely: keep them in their own files so app updates don't re-download them.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
