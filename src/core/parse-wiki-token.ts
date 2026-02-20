const WIKI_TOKEN_PATTERN = /\/wiki\/([A-Za-z0-9]+)(?:\?|$|\/)/;

export function parseWikiToken(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("wiki input is empty");
  }

  if (/^https?:\/\//.test(trimmed)) {
    const match = trimmed.match(WIKI_TOKEN_PATTERN);
    if (!match) {
      throw new Error(`cannot parse wiki token from url: ${trimmed}`);
    }
    return match[1];
  }
  return trimmed;
}
