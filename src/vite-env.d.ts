/// <reference types="vite/client" />

/** Immutable Git commit injected into production artifacts by Vite. */
declare const __EFFECTIME_RELEASE_SHA__: unknown;

/** True only when the compiled artifact came from a clean Git worktree. */
declare const __EFFECTIME_RELEASE_ATTESTABLE__: unknown;

/** Immutable reviewed Edge source-tree digest expected beside this web build. */
declare const __EFFECTIME_EDGE_SOURCE_SHA256__: unknown;
