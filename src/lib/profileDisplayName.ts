const MAX_DISPLAY_NAME_LENGTH = 200;

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (
      codePoint <= 0x1f
      || (codePoint >= 0x7f && codePoint <= 0x9f)
      || (codePoint >= 0xd800 && codePoint <= 0xdfff)
    );
  });
}

/** Canonical display-name contract shared by every browser write path. */
export function canonicalizeWorkspaceProfileDisplayName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const normalized = value.trim();
  if (
    normalized.length === 0
    || Array.from(normalized).length > MAX_DISPLAY_NAME_LENGTH
    || hasControlCharacter(normalized)
  ) {
    return undefined;
  }

  return normalized;
}
