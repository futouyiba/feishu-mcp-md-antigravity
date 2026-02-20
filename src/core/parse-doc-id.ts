const DOC_TOKEN_PATTERN = /\/docx\/([A-Za-z0-9]+)(?:\?|$|\/)/;

export function parseDocId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("doc input is empty");
  }

  if (/^https?:\/\//.test(trimmed)) {
    const match = trimmed.match(DOC_TOKEN_PATTERN);
    if (!match) {
      throw new Error(`cannot parse doc token from url: ${trimmed}`);
    }
    return match[1];
  }

  return trimmed;
}
