import { defineConfig, loadEnv, type Plugin, type ResolvedConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { readFileSync } from "node:fs";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { createMobileCsp, transformMobileIndexHtml } from "./src/lib/platform/mobileCsp";
import {
  resolveReleaseSourceIdentity,
  writePublicReleaseManifest,
} from "./scripts/release/release-identity.mjs";
import { verifyGeneratedEdgeSourceIdentity } from "./scripts/release/edge-source-identity.mjs";

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

function releaseIdentityPlugin(identity: {
  application: string;
  version: string;
  sha: string;
  dirty: boolean;
}): Plugin {
  let resolvedConfig: ResolvedConfig | null = null;
  return {
    name: "effectime-release-identity",
    apply: "build",
    configResolved(config) {
      resolvedConfig = config;
    },
    closeBundle() {
      if (!resolvedConfig) {
        throw new Error("Release identity cannot resolve the Vite build output directory.");
      }
      writePublicReleaseManifest({
        distributionDirectory: path.resolve(
          resolvedConfig.root,
          resolvedConfig.build.outDir,
        ),
        ...identity,
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
    name: string;
    version: string;
  };
  const releaseSourceIdentity = resolveReleaseSourceIdentity({ repositoryRoot: process.cwd() });
  const edgeSourceIdentity = verifyGeneratedEdgeSourceIdentity({ repositoryRoot: process.cwd() });
  const publicReleaseIdentity = {
    application: packageJson.name,
    version: packageJson.version,
    sha: releaseSourceIdentity.sha,
    dirty: releaseSourceIdentity.dirty,
  };
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
      releaseIdentityPlugin(publicReleaseIdentity),
    ].filter(Boolean),
    define: {
      __EFFECTIME_RELEASE_SHA__: JSON.stringify(releaseSourceIdentity.sha),
      __EFFECTIME_RELEASE_ATTESTABLE__: JSON.stringify(releaseSourceIdentity.attestable),
      __EFFECTIME_EDGE_SOURCE_SHA256__: JSON.stringify(edgeSourceIdentity.sha256),
    },
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
