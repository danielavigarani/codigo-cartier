import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const isTest = Boolean(process.env.VITEST);

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    ...(!isTest
      ? [
          VitePWA({
            registerType: "autoUpdate",
            includeAssets: [
              "background.svg",
              "icon.svg",
              "samples/piano/*.mp3",
              "samples/cello/*.mp3",
            ],
            manifest: {
              name: "Código Cartier — Symphonic Edition",
              short_name: "Código Cartier",
              description:
                "Criptografia Musical para RPG com partitura viva, piano e violoncelo.",
              theme_color: "#060814",
              background_color: "#060814",
              display: "standalone",
              icons: [
                {
                  src: "icon.svg",
                  sizes: "any",
                  type: "image/svg+xml",
                  purpose: "any maskable",
                },
              ],
            },
            workbox: {
              maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
              globPatterns: ["**/*.{js,css,html,svg,woff,woff2,mp3}"],
            },
          }),
        ]
      : []),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          tone: ["tone", "tonal"],
          vexflow: ["vexflow"],
          pdf: ["jspdf", "svg2pdf.js", "pdfjs-dist"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
