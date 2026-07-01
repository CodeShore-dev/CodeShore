import { useEffect, useState } from 'react';

// Scrollspy for the floating section nav: tracks which of the given section
// ids currently occupies the top of the viewport. rootMargin biases the
// trigger zone to a thin band near the top (below the fixed site nav) so a
// section becomes "active" as soon as it reaches reading position, not only
// when fully in view.
export function useActiveSection(ids: readonly string[]): string {
  const [activeId, setActiveId] = useState(ids[0] ?? '');
  const idsKey = ids.join('|');

  useEffect(() => {
    if (!idsKey) return;

    const elements = idsKey
      .split('|')
      .map(id => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(entry => entry.isIntersecting);
        if (visible.length === 0) return;
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        setActiveId(visible[0].target.id);
      },
      { rootMargin: '-96px 0px -70% 0px', threshold: 0 },
    );

    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [idsKey]);

  return activeId;
}
