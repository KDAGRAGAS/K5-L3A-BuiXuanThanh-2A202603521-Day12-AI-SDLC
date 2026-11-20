const NAME_PATTERN = /^[\p{Script=Latin}0-9_]+$/u;

export function validLeaderboardName(name) {
  if (typeof name !== 'string') return false;
  const normalized = name.normalize('NFC');
  return Array.from(normalized).length >= 3
    && Array.from(normalized).length <= 12
    && NAME_PATTERN.test(normalized);
}

export function validLeaderboardEntry(entry) {
  return Boolean(entry && validLeaderboardName(entry.name)
    && Number.isInteger(entry.score) && entry.score >= 0
    && Number.isInteger(entry.nights_won) && entry.nights_won >= 0 && entry.nights_won <= 3
    && typeof entry.achieved_at === 'string'
    && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(entry.achieved_at)
    && Number.isFinite(Date.parse(entry.achieved_at)) && Number.isInteger(entry.seed));
}

export function rankEntries(entries) {
  return [...entries]
    .filter(validLeaderboardEntry)
    .sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at))
    .slice(0, 10);
}
