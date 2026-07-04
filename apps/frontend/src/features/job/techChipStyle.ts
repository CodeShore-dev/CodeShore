// Shared pure helper producing the hardcoded HEX chip class strings for a
// selected vs. unselected tech chip. The selected-state value is taken
// directly from the established hardcoded-HEX tech chip pattern (see
// JobTechChips.tsx), and mirrors the tech filter panel's selected-state look
// (JobTechFilterPanel.tsx), per frontend-standards.md's "hardcoded HEX only,
// no CSS custom-property token classes" rule.
export function techChipClass(selected: boolean): string {
  return selected ? 'bg-[#003d92] text-white' : 'bg-[#d9f2ff] text-[#434653]';
}
