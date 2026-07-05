import { createTechFilterStore } from '../keyword/keywordFilterStore';

// Independent technology-selection store for the company page (task 3.1).
// Produced by the same factory as the job page's useKeywordFilterStore, but
// as a separate instance so selections made on one page never leak into the
// other.
export const useCompanyTechFilterStore = createTechFilterStore();
