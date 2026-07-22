import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_RECOVERED_MIGRATIONS,
  MIGRATION_PROVENANCE_MANIFEST,
  parseRecoveredMigrationManifest,
  verifyRecoveredMigrationProvenance,
} from "./check-remote-migration-provenance.mjs";

const actualRepositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const sourceByVersion = Object.freeze(
  Object.fromEntries(
    EXPECTED_RECOVERED_MIGRATIONS.map(({ version, name }) => [
      version,
      readFileSync(
        resolve(
          actualRepositoryRoot,
          `supabase/migrations/${version}_${name}.sql`,
        ),
      ),
    ]),
  ),
);

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function createFixture() {
  const repositoryRoot = mkdtempSync(resolve(tmpdir(), "effectime-migration-provenance-"));
  mkdirSync(resolve(repositoryRoot, "scripts/ci"), { recursive: true });
  mkdirSync(resolve(repositoryRoot, "supabase/migrations"), { recursive: true });

  const migrations = EXPECTED_RECOVERED_MIGRATIONS.map(
    ({ version, name, bytes, sha256: canonicalSha256 }) => {
      const content = sourceByVersion[version];
      const path = `supabase/migrations/${version}_${name}.sql`;
      writeFileSync(resolve(repositoryRoot, path), content);
      return { version, name, path, bytes, sha256: canonicalSha256 };
    },
  );
  const manifest = { schemaVersion: 1, algorithm: "sha256", migrations };
  writeFileSync(
    resolve(repositoryRoot, MIGRATION_PROVENANCE_MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return { repositoryRoot, manifest };
}

function withFixture(callback) {
  const fixture = createFixture();
  return Promise.resolve()
    .then(() => callback(fixture))
    .finally(() => rmSync(fixture.repositoryRoot, { recursive: true, force: true }));
}

function writeManifest(repositoryRoot, manifest) {
  writeFileSync(
    resolve(repositoryRoot, MIGRATION_PROVENANCE_MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

test("verifies the exact ordered recovered migration byte set", async () => {
  await withFixture(async ({ repositoryRoot, manifest }) => {
    const result = await verifyRecoveredMigrationProvenance({ repositoryRoot });
    assert.deepEqual(result, {
      files: 2,
      bytes: manifest.migrations.reduce((sum, entry) => sum + entry.bytes, 0),
    });
  });
});

test("rejects same-length content drift by SHA-256", async () => {
  await withFixture(async ({ repositoryRoot, manifest }) => {
    const entry = manifest.migrations[0];
    const source = sourceByVersion[entry.version];
    const changed = Buffer.from(source);
    changed[changed.length - 3] = changed[changed.length - 3] === 0x31 ? 0x39 : 0x31;
    assert.equal(changed.byteLength, entry.bytes);
    writeFileSync(resolve(repositoryRoot, entry.path), changed);
    await assert.rejects(
      verifyRecoveredMigrationProvenance({ repositoryRoot }),
      /SHA-256 drift/u,
    );
  });
});

test("rejects coordinated migration and manifest digest drift", async () => {
  await withFixture(async ({ repositoryRoot, manifest }) => {
    const entry = manifest.migrations[0];
    const changed = Buffer.from(sourceByVersion[entry.version]);
    changed[changed.length - 1] ^= 0x01;
    assert.equal(changed.byteLength, entry.bytes);
    writeFileSync(resolve(repositoryRoot, entry.path), changed);
    writeManifest(repositoryRoot, {
      ...manifest,
      migrations: manifest.migrations.map((migration, index) =>
        index === 0 ? { ...migration, sha256: sha256(changed) } : migration,
      ),
    });

    await assert.rejects(
      verifyRecoveredMigrationProvenance({ repositoryRoot }),
      /canonical recovery attestation/u,
    );
  });
});

test("rejects line-ending and byte-length drift before hashing", async () => {
  await withFixture(async ({ repositoryRoot, manifest }) => {
    const entry = manifest.migrations[0];
    writeFileSync(
      resolve(repositoryRoot, entry.path),
      sourceByVersion[entry.version].toString("utf8").replaceAll("\n", "\r\n"),
    );
    await assert.rejects(
      verifyRecoveredMigrationProvenance({ repositoryRoot }),
      /byte drift/u,
    );
  });
});

test("rejects a missing file and a directory masquerading as a migration", async () => {
  await withFixture(async ({ repositoryRoot, manifest }) => {
    const entry = manifest.migrations[0];
    rmSync(resolve(repositoryRoot, entry.path));
    await assert.rejects(
      verifyRecoveredMigrationProvenance({ repositoryRoot }),
      /Unable to read recovered migration/u,
    );
    mkdirSync(resolve(repositoryRoot, entry.path));
    await assert.rejects(
      verifyRecoveredMigrationProvenance({ repositoryRoot }),
      /regular non-symlink file/u,
    );
  });
});

test("requires the exact two-entry ordered recovery set", () => {
  const { repositoryRoot, manifest } = createFixture();
  try {
    for (const migrations of [
      manifest.migrations.slice(0, 1),
      manifest.migrations.toReversed(),
      [...manifest.migrations, { ...manifest.migrations[1] }],
    ]) {
      assert.throws(
        () =>
          parseRecoveredMigrationManifest(
            JSON.stringify({ ...manifest, migrations }),
          ),
        /exact ordered recovery set/u,
      );
    }
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
});

test("rejects path traversal, backslashes and identity/path mismatches", () => {
  const { repositoryRoot, manifest } = createFixture();
  try {
    for (const path of [
      "../outside.sql",
      "supabase\\migrations\\20260514124827_v3_22_0_clock_in_engine.sql",
      "supabase/migrations/20260514124827_wrong.sql",
    ]) {
      const migrations = manifest.migrations.map((entry, index) =>
        index === 0 ? { ...entry, path } : entry,
      );
      assert.throws(
        () => parseRecoveredMigrationManifest(JSON.stringify({ ...manifest, migrations })),
        /path must equal/u,
      );
    }
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
});

test("rejects unknown keys and malformed manifest primitives", () => {
  const { repositoryRoot, manifest } = createFixture();
  try {
    assert.throws(
      () => parseRecoveredMigrationManifest(JSON.stringify({ ...manifest, unexpected: true })),
      /keys must be exactly/u,
    );
    assert.throws(
      () =>
        parseRecoveredMigrationManifest(
          JSON.stringify({
            ...manifest,
            migrations: [
              { ...manifest.migrations[0], unexpected: true },
              manifest.migrations[1],
            ],
          }),
        ),
      /keys must be exactly/u,
    );
    assert.throws(() => parseRecoveredMigrationManifest("{"), /not valid JSON/u);
    assert.throws(
      () => parseRecoveredMigrationManifest(JSON.stringify({ ...manifest, schemaVersion: 2 })),
      /schemaVersion/u,
    );
    assert.throws(
      () => parseRecoveredMigrationManifest(JSON.stringify({ ...manifest, algorithm: "sha512" })),
      /algorithm/u,
    );
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
});

test("rejects invalid byte and digest attestations", () => {
  const { repositoryRoot, manifest } = createFixture();
  try {
    for (const mutation of [
      { bytes: 0 },
      { bytes: 1.5 },
      { sha256: manifest.migrations[0].sha256.toUpperCase() },
      { sha256: "0".repeat(63) },
    ]) {
      const migrations = manifest.migrations.map((entry, index) =>
        index === 0 ? { ...entry, ...mutation } : entry,
      );
      assert.throws(
        () => parseRecoveredMigrationManifest(JSON.stringify({ ...manifest, migrations })),
        /bytes|sha256/u,
      );
    }
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
});
