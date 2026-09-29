import { useEffect, useState } from 'react';

import { CATEGORY_PRIORITY } from '../../../utils/constants';
import { fetchMvTechRanking } from '../service';

// 首頁「熱門技術組合」的技術來源。四個分類各取前 5 名，順序依
// CATEGORY_PRIORITY（語言 → 框架 → 資料庫 → 程式庫）。這裡刻意不吃
// 「熱門技術」排行榜的分類選擇，所以切換上方分類時下方組合不變。
export const COMBO_CATEGORIES = [
  'language',
  'framework',
  'database',
  'library',
];
export const COMBO_TECHS_PER_CATEGORY = 5;
export const COMBO_MIN_JOB_COUNT = 8;

export interface HomeComboTech {
  tech: string;
  category: string;
}

const ORDERED_COMBO_CATEGORIES = [...COMBO_CATEGORIES].sort(
  (a, b) =>
    (CATEGORY_PRIORITY[a] ?? Number.MAX_SAFE_INTEGER) -
    (CATEGORY_PRIORITY[b] ?? Number.MAX_SAFE_INTEGER),
);

export function useHomeComboTechs() {
  const [items, setItems] = useState<HomeComboTech[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const responses = await Promise.all(
          ORDERED_COMBO_CATEGORIES.map(category =>
            fetchMvTechRanking({
              from: 0,
              to: COMBO_TECHS_PER_CATEGORY - 1,
              where: JSON.stringify({
                category: { eq: category },
                job_count: { gte: COMBO_MIN_JOB_COUNT },
              }),
              orders: 'job_count:desc',
            }),
          ),
        );
        if (cancelled) return;

        const seen = new Set<string>();
        const next: HomeComboTech[] = [];
        responses.forEach((response, i) => {
          const category = ORDERED_COMBO_CATEGORIES[i];
          const top = (response.result ?? []).slice(
            0,
            COMBO_TECHS_PER_CATEGORY,
          );
          for (const item of top) {
            if (!item.tech || seen.has(item.tech)) continue;
            seen.add(item.tech);
            next.push({ tech: item.tech, category });
          }
        });
        setItems(next);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading };
}
