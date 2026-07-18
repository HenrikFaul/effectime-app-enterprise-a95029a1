import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { createMobileCsp, transformMobileIndexHtml } from "./src/lib/platform/mobileCsp";

const mobileBuild = process.env.EFFECTIME_BUILD_TARGET === "mobile";

function mobileIndexPlugin(supabaseUrl: string): Plugin {
  const csp = createMobileCsp(supabaseUrl);
  return {
    name: "effectime-mobile-csp",
    enforce: "pre",
    transformIndexHtml: {
      order: "pre",
      handler: (html) => transformMobileIndexHtml(html, csp),
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (mobileBuild && !env.VITE_SUPABASE_URL) {
    throw new Error("VITE_SUPABASE_URL is required for the CSP-hardened mobile build.");
  }

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      mobileBuild && mobileIndexPlugin(env.VITE_SUPABASE_URL),
    ].filter(Boolean),
    publicDir: mobileBuild ? false : "public",
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Consolidate repeated dependency license notices at each chunk's end while
    // preserving them in the distributed artifact.
    esbuild: {
      legalComments: "eof",
    },
    build: {
      outDir: mobileBuild ? "dist-mobile" : "dist",
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-query": ["@tanstack/react-query"],
            "vendor-supabase": ["@supabase/supabase-js"],
            "vendor-toast": ["sonner"],
            "vendor-ui": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-popover",
              "@radix-ui/react-select",
              "@radix-ui/react-tabs",
              "@radix-ui/react-tooltip",
            ],
            "vendor-dates": ["date-fns"],
          },
        },
      },
    },
  };
});
