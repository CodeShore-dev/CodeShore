import { AboutPageShell } from '../components/AboutPageShell';

const SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: '服務性質',
    paragraphs: [
      '「碼的 上岸了」是一個工程師求職市場分析工具，並非人力銀行或職缺平台。我們不提供、也不經手任何履歷投遞、面試媒合或聘僱服務。所有原始職缺資訊均連結回原平台，請於原平台完成應徵流程。',
    ],
  },
  {
    title: '資料來源與準確性',
    paragraphs: [
      '本站資料來自 104 人力銀行、Cake 等公開來源，由系統定期自動爬取與正規化。我們已盡力確保數據的正確性與即時性，但資料可能因來源更新延遲、爬取失敗或正規化誤差而與原始內容有所出入。',
      '所有統計數字（如薪資分位、技術熱度）僅供參考，不構成任何求職、薪資談判或投資建議。使用者應以各原平台的最新資訊為準。',
    ],
  },
  {
    title: '智慧財產權',
    paragraphs: [
      '本站整理、分析後產生的圖表與統計結果，其編排與呈現受本站權利保護。各職缺的原始文字、公司名稱與商標仍歸各原平台與權利人所有，本站僅為合理引用與分析目的而使用。',
      '若您為權利人並認為本站內容涉及侵權，請透過「聯絡我們」頁面與我們聯繫，我們將於收到通知後盡速處理。',
    ],
  },
  {
    title: '免責聲明',
    paragraphs: [
      '本站不保證服務的持續可用性、無中斷或無錯誤。使用者因使用（或無法使用）本站所產生的任何直接或間接損失，本站不負任何法律責任。',
      '本站可能包含指向第三方網站的連結，該等網站的內容、隱私政策與使用條款由該等第三方負責，本站不為其內容背書或擔保。',
    ],
  },
];

// 法律聲明頁面：揭露服務性質、資料來源、智慧財產權與免責聲明。
export function LegalNoticePage() {
  return (
    <AboutPageShell
      title="法律聲明"
      description="本站之服務性質、資料來源與準確性、智慧財產權歸屬及免責聲明。"
      breadcrumb={[
        { name: '首頁', path: '/' },
        { name: '法律聲明', path: '/legal' },
      ]}
    >
      {SECTIONS.map(section => (
        <section key={section.title} className="mb-8">
          <h2 className="mb-3 text-xl font-black text-[#003d92]">{section.title}</h2>
          {section.paragraphs.map((text, index) => (
            <p key={index} className="mb-3 text-sm leading-relaxed text-[#1f2330]">
              {text}
            </p>
          ))}
        </section>
      ))}
      <p className="mt-4 text-xs leading-relaxed text-[#434653]">
        本聲明最後更新於 2026 年。隨著服務演進，我們可能隨時修訂內容，最新版本以本站刊登者為準。
      </p>
    </AboutPageShell>
  );
}
