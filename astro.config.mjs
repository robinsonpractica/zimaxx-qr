import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

const isLocalDev = process.argv.includes("dev");

export default defineConfig({
  output: "server",
  adapter: isLocalDev ? undefined : cloudflare({ imageService: "compile" }),
  security: { checkOrigin: true },
  vite: { optimizeDeps: { noDiscovery: true, include: [], exclude: ["astro", "aria-query", "axobject-query", "cssesc"] } },
});
