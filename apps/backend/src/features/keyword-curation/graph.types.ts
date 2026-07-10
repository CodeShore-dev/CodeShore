// 佇列項目
export interface QueuedKeyword {
  id: string; // keyword 文字本身（keyword.id）
  count: number; // 在職缺中的出現次數
  affectedJobCount: number;
}

// AI 建議（interrupt payload）
// path: 'ai_failed' 用於 LLM 呼叫失敗時的 interrupt payload（需求 3.5, 9.2）
export type AiRecommendation =
  | {
      path: 'A';
      matchedTech: { id: string; label: string; category: string };
      confidence: number; // 0–1
      reasoning: string;
      affectedJobCount: number;
    }
  | {
      path: 'B';
      suggestedTech: SuggestedNewTech;
      suggestedEdges: SuggestedEdge[];
      reasoning: string;
      affectedJobCount: number;
    }
  | {
      path: 'C';
      reasoning: string;
      affectedJobCount: number;
    }
  | {
      path: 'ai_failed';
      error: string;
    };

export interface SuggestedNewTech {
  id: string;
  label: string;
  category: string;
  tags: string[];
  iconSlugs: string[]; // 預設為 []，管理員可在前端補充
}

export interface SuggestedEdge {
  type: 'parent' | 'child';
  techId: string;
  techLabel: string;
  reasoning: string;
}

// 人工決策（resume payload）
export type HumanDecision =
  | { path: 'A'; confirmedTechId: string }
  | { path: 'B'; newTech: NewTechFields; confirmedEdges: ConfirmedEdge[] }
  | { path: 'C' };

export interface NewTechFields {
  id: string;
  label: string;
  category: string;
  iconSlugs: string[];
  tags: string[];
}

export interface ConfirmedEdge {
  parentId: string;
  childId: string;
}

// 提交結果（需求 9.3：partialChanges 記錄部分成功明細）
export type CommitResult =
  | { ok: true; changes: CommittedChange[] }
  | { ok: false; error: string; partialChanges: CommittedChange[] };

export interface CommittedChange {
  type: 'tech' | 'tech_keyword' | 'tech_parent' | 'keyword_bin';
  details: Record<string, string>;
  status: 'committed' | 'failed';
  error?: string;
}

// 圖形內部輔助
export interface TechOption {
  id: string;
  label: string;
  category: string;
}

// LangGraph 圖形狀態（對應 CurationAnnotation.State）
export interface CurationState {
  keyword: string;
  affectedJobCount: number;
  allTechs: ReadonlyArray<TechOption>;
  aiRecommendation: AiRecommendation | null;
  humanDecision: HumanDecision | null;
  commitResult: CommitResult | null;
}
