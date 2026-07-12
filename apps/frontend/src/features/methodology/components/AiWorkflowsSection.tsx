import { useQuery } from '@tanstack/react-query';

import { fetchAiWorkflows } from '../service';
import { AiSuggestionWorkflowList } from './AiSuggestionWorkflowList';
import { KeywordCurationWorkflowPanel } from './KeywordCurationWorkflowPanel';

// Section container for「AI 應用與工作流程」(design.md「前端元件摘要」
// `AiWorkflowsSection`; requirements 1.1-1.3, 2.4, 2.5, 3.4, 3.5).
//
// The query is scoped to this component (not lifted to MethodologyPage), so a
// fetch failure here cannot affect the rendering of any sibling section — the
// same isolation the「資料來源 SQL」section's own scoped query already relies
// on. `useQuery`'s `isError` captures a rejection without throwing, so no
// try/catch or error boundary is needed here.
export function AiWorkflowsSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['methodology', 'ai-workflows'],
    queryFn: fetchAiWorkflows,
  });

  return (
    <section id="ai-workflows" className="mb-12 scroll-mt-20">
      <h2 className="mb-4 text-xl font-black text-[#003d92]">
        AI 應用與工作流程
      </h2>

      {isLoading && (
        <p className="rounded-lg bg-[#f4faff] p-4 text-xs text-[#434653]">
          AI 工作流程資料載入中…
        </p>
      )}

      {isError && (
        <p className="rounded-lg bg-[#fff4f4] p-4 text-xs text-[#434653]">
          無法取得 AI 工作流程資料
        </p>
      )}

      {data && (
        <>
          <AiSuggestionWorkflowList workflows={data.aiSuggestion} />
          <KeywordCurationWorkflowPanel info={data.keywordCuration} />
        </>
      )}
    </section>
  );
}
