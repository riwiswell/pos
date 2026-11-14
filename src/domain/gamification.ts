export const FIRST_LEVEL_XP = 1200;
export const LEVEL_XP_INCREMENT = 300;

/** Cada nivel exige 300 XP más que el anterior. El XP es acumulado de por vida. */
export function getLevelProgress(totalXp: number) {
  const safeXp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  let xpAtLevelStart = 0;
  let xpRequiredForLevel = FIRST_LEVEL_XP;

  while (safeXp >= xpAtLevelStart + xpRequiredForLevel) {
    xpAtLevelStart += xpRequiredForLevel;
    level += 1;
    xpRequiredForLevel += LEVEL_XP_INCREMENT;
  }

  const xpIntoLevel = safeXp - xpAtLevelStart;
  return {
    level,
    xpIntoLevel,
    xpRequiredForLevel,
    xpToNext: xpRequiredForLevel - xpIntoLevel,
  };
}
