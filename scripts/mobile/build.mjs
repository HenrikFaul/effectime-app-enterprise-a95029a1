import { build } from "vite";

// Keep production environment resolution identical to the web build while
// selecting a separate native-only HTML/public artifact in vite.config.ts.
process.env.EFFECTIME_BUILD_TARGET = "mobile";

await build({ mode: "production" });
