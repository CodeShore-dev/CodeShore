import { Link } from 'react-router';

import { AboutPageShell } from '../components/AboutPageShell';

const GITHUB_REPO_URL = 'https://github.com/CodeShore-dev/CodeShore';

const TECH_STACK = [
  { label: '前端', value: 'React 19 · TypeScript · Tailwind CSS · Vite' },
  { label: '後端', value: 'NestJS 11 · Supabase (PostgreSQL)' },
  { label: '爬蟲', value: 'Puppeteer · Crawlee' },
  { label: 'AI', value: 'LangChain / LangGraph · Anthropic / OpenRouter' },
  { label: '授權', value: 'MIT License' },
];

// 開源於 GitHub 頁面：說明專案開源、技術堆疊與如何參與，並提供直達 repo 的連結。
export function OpenSourcePage() {
  return (
    <AboutPageShell
      title="開源於 GitHub"
      description="碼的 上岸了 是開源專案。原始碼、資料處理邏輯與分析計算皆可於 GitHub 上檢視與參與。"
      breadcrumb={[
        { name: '首頁', path: '/' },
        { name: '開源於 GitHub', path: '/open-source' },
      ]}
    >
      <section className="mb-10">
        <p className="mb-4 text-sm leading-relaxed text-[#1f2330]">
          我們相信求職市場的數據分析應當公開、可檢驗。整個網站的原始碼 —— 包含 爬蟲、資料正規化、計算邏輯到前端介面 ——
          都以 MIT 授權釋出，完整公開在 GitHub 上。你也可以到「公開透明」頁面查看每個數字背後實際執行的 SQL。
        </p>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-[#001f2a] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#003d92]"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            code
          </span>
          前往 GitHub 儲存庫
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            open_in_new
          </span>
        </a>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-black text-[#003d92]">技術堆疊</h2>
        <dl className="divide-y divide-[#eceef3] rounded-xl border border-[#eceef3] bg-white">
          {TECH_STACK.map(item => (
            <div key={item.label} className="flex items-start gap-4 px-4 py-3">
              <dt className="w-20 shrink-0 text-sm font-bold text-[#434653]">{item.label}</dt>
              <dd className="text-sm leading-relaxed text-[#1f2330]">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mb-4">
        <h2 className="mb-4 text-xl font-black text-[#003d92]">如何參與</h2>
        <ul className="mb-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#1f2330]">
          <li>在 Issues 回報錯誤或提出功能建議。</li>
          <li>Fork 儲存庫並發送 Pull Request，我們會檢視並合併。</li>
          <li>資料來源以 104 人力銀行與 Cake 的公開職缺為主，歡迎補充新來源。</li>
        </ul>
        <p className="text-sm leading-relaxed text-[#1f2330]">
          想了解分析背後的計算方式？請參考
          <Link to="/methodology" className="font-bold text-[#003d92] hover:underline">
            公開透明
          </Link>
          頁面。
        </p>
      </section>
    </AboutPageShell>
  );
}
