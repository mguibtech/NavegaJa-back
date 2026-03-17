export function removeDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeLocationText(value?: string): string {
  return removeDiacritics(value?.trim().toLowerCase() ?? '').replace(
    /\s+/g,
    ' ',
  );
}

export function locationHasDiacritics(value: string): boolean {
  return removeDiacritics(value) !== value;
}

export function titleCaseLocationText(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function preferCanonicalLocationName(
  currentName: string | null,
  candidateName: string,
): string {
  if (!currentName) return candidateName;

  const currentHasDiacritics = locationHasDiacritics(currentName);
  const candidateHasDiacritics = locationHasDiacritics(candidateName);

  if (candidateHasDiacritics && !currentHasDiacritics) {
    return candidateName;
  }

  if (
    candidateHasDiacritics === currentHasDiacritics &&
    candidateName.length > currentName.length
  ) {
    return candidateName;
  }

  return currentName;
}
