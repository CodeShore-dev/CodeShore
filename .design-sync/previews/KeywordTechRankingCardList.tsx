import { KeywordTechRankingCardList } from 'codeshore';

const noop = () => {};

const items = [
  { keyword_group: 'javascript', label: 'JavaScript', icon_slugs: ['simple-icons:javascript'], tags: ['frontend-web'], job_count: 4213 },
  { keyword_group: 'python', label: 'Python', icon_slugs: ['simple-icons:python'], tags: ['data-ai'], job_count: 3987 },
  { keyword_group: 'typescript', label: 'TypeScript', icon_slugs: ['simple-icons:typescript'], tags: ['frontend-web'], job_count: 3120 },
  { keyword_group: 'java', label: 'Java', icon_slugs: ['simple-icons:openjdk'], tags: ['backend'], job_count: 2890 },
  { keyword_group: 'go', label: 'Go', icon_slugs: ['simple-icons:go'], tags: ['backend'], job_count: 1450 },
];

export const Loaded = () => (
  <KeywordTechRankingCardList
    title="熱門程式語言"
    items={items}
    loading={false}
    getItems={noop}
    moreTo="/keywords"
  />
);

export const Loading = () => (
  <KeywordTechRankingCardList
    title="熱門程式語言"
    items={[]}
    loading={true}
    getItems={noop}
  />
);
