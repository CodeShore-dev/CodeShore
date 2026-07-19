import { AboutPageShell } from '../components/AboutPageShell';

const GITHUB_REPO_URL = 'https://github.com/CodeShore-dev/CodeShore';
const CONTACT_EMAIL = 'ucnsaythtagn@gmail.com';

const CHANNELS: { icon: string; title: string; desc: string; action: string; href: string; external?: boolean }[] = [
  {
    icon: 'bug_report',
    title: '回報問題',
    desc: '發現數據錯誤、網站異常或想提功能建議？',
    action: '在 GitHub Issues 發起討論',
    href: `${GITHUB_REPO_URL}/issues`,
    external: true,
  },
  {
    icon: 'mail',
    title: 'Email 聯絡',
    desc: '一般詢問、合作或授權相關事宜。',
    action: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
    external: true,
  },
  {
    icon: 'code',
    title: '原始碼',
    desc: '檢視完整程式碼、參與開發或追蹤更新。',
    action: '前往 GitHub 儲存庫',
    href: GITHUB_REPO_URL,
    external: true,
  },
];

// 聯絡我們頁面：提供回報問題、Email 與開源儲存庫等聯絡管道。
export function ContactPage() {
  return (
    <AboutPageShell
      title="聯絡我們"
      description="有問題、建議或合作想法？以下是我們最即時的聯絡管道。"
      breadcrumb={[
        { name: '首頁', path: '/' },
        { name: '聯絡我們', path: '/contact' },
      ]}
    >
      <p className="mb-8 text-sm leading-relaxed text-[#1f2330]">
        我們是一個小團隊，沒有專屬客服信箱，但會盡可能回覆每一則訊息。技術問題與功能建議請優先透過 GitHub
        Issues，一般詢問則歡迎來信。
      </p>

      <div className="space-y-4">
        {CHANNELS.map(channel => (
          <a
            key={channel.title}
            href={channel.href}
            target={channel.external ? '_blank' : undefined}
            rel={channel.external ? 'noreferrer' : undefined}
            className="flex items-start gap-4 rounded-xl border border-[#eceef3] bg-white p-4 transition-colors hover:border-[#003d92] hover:bg-[#f4faff]"
          >
            <span className="material-symbols-outlined mt-0.5 shrink-0 text-[#003d92]" style={{ fontSize: '24px' }}>
              {channel.icon}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#001f2a]">{channel.title}</div>
              <p className="mb-1 text-sm leading-relaxed text-[#434653]">{channel.desc}</p>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-[#003d92]">
                {channel.action}
                {channel.external && (
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    open_in_new
                  </span>
                )}
              </span>
            </div>
          </a>
        ))}
      </div>
    </AboutPageShell>
  );
}
