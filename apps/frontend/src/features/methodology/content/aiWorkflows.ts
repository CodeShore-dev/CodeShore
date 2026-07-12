import type { AiSuggestionWorkflow } from '@codeshore/data-types';

/**
 * 「AI 應用與工作流程」區塊的靜態說明文字（content registry）。
 *
 * 與 `crawlerPipeline.ts` 相同的模式：內容為此頁對應區塊的唯一可信來源，元件
 * （`AiSuggestionWorkflowList`、`KeywordCurationWorkflowPanel`）只讀取這裡的
 * 常數，不在元件內另行硬編用途文字，避免文字散落各處、彼此漂移。
 *
 * `AI_SUGGESTION_WORKFLOW_PURPOSE` 的型別刻意宣告為
 * `Record<AiSuggestionWorkflow, string>`（而非 `Record<string, string>`）：
 * 若後端新增第 6 個 `AiSuggestionWorkflow` 值，此檔會因缺少對應 key 而編譯失敗，
 * 強迫維護者同步補上說明文字（design.md「重新驗證觸發條件」）。
 *
 * 每則用途說明依實際 generator 行為撰寫（見對應 generator 的
 * `SYSTEM_PROMPT`/doc comment），與 `WORKFLOW_LABELS` 提供的簡短名稱互補、
 * 不重複。
 *
 * 語系：zh-TW。
 */
export const AI_SUGGESTION_WORKFLOW_PURPOSE: Record<AiSuggestionWorkflow, string> = {
  keyword_mapping:
    '將職缺描述萃取出、出現頻率已達門檻但尚未對應任何技術字典項目的關鍵字，交由 AI 判斷是否為既有技術條目的別名或縮寫並提出對應建議；AI 判斷無適合項目時，會同時提出「以此關鍵字建立新技術條目」與「歸類為雜訊排除」兩個互斥選項，交由管理員擇一核准。',
  tech_dictionary:
    '將尚未對應任何技術條目、但出現頻率已達門檻的關鍵字群集，交由 AI 一次性分析並提出新增技術條目的建議（含分類、標籤），同時檢查建議標籤與既有條目的相似度以提示可能重複；AI 也會一併檢視既有技術條目的分類、標籤或圖示是否有需要修正之處並提出更新建議。',
  tech_hierarchy:
    '找出尚未被納入任何父子階層的技術條目，交由 AI 判斷它與既有技術條目之間是否存在明顯的父子關係（例如某框架隸屬於其基礎語言），並提出新增階層關聯的建議；若建議關聯會在既有階層中形成循環，則直接放棄產生該建議，不會提交給管理員審核。',
  location_mapping:
    '找出職缺地點欄位中尚未對應任何標準地區群組的原始地點字串，交由 AI 判斷應併入既有地區群組、或需另立新群組（遵循「縣市＋鄉鎮市區」命名慣例），藉此將零散、不一致的地點寫法逐步正規化為一致的標準地區群組。',
  noise_detection:
    '從兩個角度偵測資料雜訊：一是檢視既有關鍵字清單，找出明顯不是技術/技能詞彙的雜訊關鍵字（如招募制式用語、斷詞錯誤片段）；二是抽樣近期職缺描述全文，找出重複出現、會干擾關鍵字萃取的樣板文字（如聯絡資訊區塊、代理商制式聲明），兩者皆提出建議交管理員確認後才會排除。',
};

/**
 * `keyword-curation` 三個決策路徑的用途說明，對應 `llm-classifier.ts` 的
 * `classify_keyword` 工具 schema（`path` 欄位列舉值 `A`/`B`/`C`）。
 *
 * 型別刻意宣告為 `Record<'A' | 'B' | 'C', string>`：若 `CLASSIFY_TOOL_INPUT_SCHEMA`
 * 的路徑列舉未來變動，此檔亦會因型別不符而編譯失敗（design.md「重新驗證觸發
 * 條件」）。
 */
export const KEYWORD_CURATION_PATH_PURPOSE: Record<'A' | 'B' | 'C', string> = {
  A: '候選關鍵字明顯是既有技術條目的同義詞、別名或縮寫，AI 會指出對應到哪一個既有條目，並附上信心分數供管理員判斷。',
  B: '候選關鍵字指向一個真實存在、但既有技術字典尚未涵蓋的技術，AI 會提出建立新技術條目的完整建議（含識別碼、顯示名稱、分類，以及與既有條目可能的父子階層關係）。',
  C: '候選關鍵字並非明確指向任何真實技術（例如錯字、通用詞彙、公司名稱等），AI 會建議將其移入 keyword bin，往後不再視為技術候選字。',
};

/**
 * 「AI 應用與工作流程」區塊中，keyword 策展工作流程的靜態引言段落。
 *
 * 需求 3.2：必須明確說明人為驗證關卡——AI 僅產生分類建議，實際寫入資料庫前
 * 一律須經管理員人工確認，AI 本身不會自動提交任何變更。
 */
export const KEYWORD_CURATION_INTRO: string =
  '「keyword 策展」是一套引導式流程：系統逐一挑出候選關鍵字，交由 AI 分類器判斷應歸入路徑 A（映射至既有技術條目）、路徑 B（建立新技術條目）或路徑 C（移入 keyword bin），並附上判斷理由與（路徑 A 時的）信心分數。無論 AI 判斷結果為何，這裡始終只是一則「建議」——AI 本身不會、也無法自動提交任何變更；每一筆分類結果都會停在人為驗證關卡，等待管理員在策展頁逐筆檢視、視需要修改後親自確認，唯有經過管理員人工確認，才會真正寫入資料庫。';
