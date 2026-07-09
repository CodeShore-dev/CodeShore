import { useJobHostStatistics } from '../../../hooks/useJobHostStatistics';

const CHANNELS = [
  { name: '104 人力銀行', hostKey: '104.com.tw', host: 'https://104.com.tw' },
  { name: 'Cake', hostKey: 'cake.me', host: 'https://cake.me' },
];

export function HomeHandoff() {
  const { percentFor } = useJobHostStatistics();

  return (
    <section className="mt-10">
      <div className="grid items-center gap-6 rounded-3xl bg-[#003d92] p-6 text-white md:grid-cols-[1.4fr_1fr] md:gap-8 md:p-10">
        <div>
          <div className="mb-3 text-xs font-bold tracking-[0.2em] text-white/70">
            ● 我們做什麼
          </div>
          <h3
            className="leading-tight font-black tracking-[-0.02em] text-white"
            style={{ fontSize: '2.25rem', margin: '0 0 16px' }}
          >
            數據看完，<br />下一步交給你。
          </h3>
          <p
            className="max-w-120 text-[15px] leading-relaxed text-white/85"
            style={{ margin: 0 }}
          >
            碼的 上岸了 的定位很單純：幫你看懂市場。職缺資料來自 104、Cake，分析完了，
            <strong className="text-white">投履歷還是要回那裡。</strong>
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {CHANNELS.map(ch => {
            const percent = percentFor(ch.hostKey);
            return (
            <div
              key={ch.name}
              className="flex items-center justify-between rounded-xl bg-white/10 p-4"
            >
              <div>
                <div className="text-sm font-bold">{ch.name}</div>
                <div className="font-mono text-[11px] text-white/50">
                  {ch.host}
                  {percent != null ? ` · ${percent}%` : ''}
                </div>
              </div>
              <a
                href={ch.host}
                target="_blank"
                rel="noreferrer"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fd7700] text-base font-black text-[#001f2a]"
              >
                ↗
              </a>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
