/**
 * Playful Norwegian title shown next to "NIVÅ {n}" on the Meg tab (e.g. "NIVÅ 1 · FERSK
 * BEBOER"). Awaiting the real copy - fill in as {level: title}. Any level not listed here
 * falls back to a bare "NIVÅ {n}", so it's safe to add titles incrementally.
 */
export const LEVEL_TITLES: Record<number, string> = {
  1: "FERSK BEBOER",
  2: "HUSVARM",
  3: "RYDDEASPIRANT",
  4: "STØVJEGER",
  5: "ORDEN I REKKENE",
  6: "KOLLEKTIVVETERAN",
  7: "RYDDEMESTER",
  8: "HUSFREDENS VOKTER",
  9: "KOLLEKTIVLEGENDE",
  10: "SJEFEN AV KOLLEKTIVET",
};

export function levelTitle(level: number): string | null {
  return LEVEL_TITLES[level] ?? null;
}
