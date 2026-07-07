import { TechService } from '@codeshore/data-utils';

/**
 * A single existing `tech` row that looks similar to a candidate label
 * (Requirement 3.2, 8.4). See design.md "ValidationHooks：CycleCheck /
 * SimilarityCheck（Full Block）" for the exact interface this mirrors.
 */
export interface SimilarityMatch {
  id: string;
  label: string;
  score: number; // 0..1
}

/**
 * Finds existing `tech` entries whose label looks similar to
 * `candidateLabel`.
 *
 * design.md and research.md（設計決策 #5）treat Postgres `pg_trgm`
 * trigram similarity as the preferred implementation but explicitly leave
 * its availability on the live Supabase project as an open question, with a
 * normalized-string-comparison fallback that must work regardless. Since
 * `pg_trgm` availability cannot be verified in this sandbox (no live
 * database), this implements that fallback as the actual primary logic:
 * normalize both the candidate and each existing label (lowercase, strip
 * non-alphanumeric characters), then score:
 *   - `1.0` when the normalized values are exactly equal
 *   - `0.6` when one contains the other as a substring (and they are not
 *     equal)
 *   - otherwise the tech is skipped entirely (no score, not returned)
 *
 * Only matches with `score >= threshold` are returned, sorted by score
 * descending.
 */
export async function findSimilarTech(
  candidateLabel: string,
  threshold: number,
): Promise<readonly SimilarityMatch[]> {
  const techService = new TechService();
  const { result } = await techService.fetchAll();

  const normalizedCandidate = normalize(candidateLabel);

  const matches: SimilarityMatch[] = [];
  for (const tech of result) {
    const score = scoreSimilarity(normalizedCandidate, normalize(tech.label));
    if (score !== null && score >= threshold) {
      matches.push({ id: tech.id, label: tech.label, score });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function scoreSimilarity(
  normalizedCandidate: string,
  normalizedExisting: string,
): number | null {
  if (normalizedCandidate.length === 0 || normalizedExisting.length === 0) {
    return null;
  }
  if (normalizedCandidate === normalizedExisting) {
    return 1.0;
  }
  if (
    normalizedExisting.includes(normalizedCandidate) ||
    normalizedCandidate.includes(normalizedExisting)
  ) {
    return 0.6;
  }
  return null;
}
