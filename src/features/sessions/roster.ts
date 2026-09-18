/** One name per line; dedupes, trims, drops blanks. Empty input = open link (no roster). */
export function parseRoster(rosterText: string | undefined): string[] | null {
  if (!rosterText || !rosterText.trim()) return null;
  const names = [
    ...new Set(
      rosterText
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean),
    ),
  ];
  return names.length ? names : null;
}
