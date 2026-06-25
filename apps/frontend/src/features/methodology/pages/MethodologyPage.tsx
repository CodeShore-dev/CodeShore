import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { CloudArchitectureSection } from '../components/CloudArchitectureSection';
import { metricExplanations } from '../content/metrics';
import { methodologySections } from '../content/sections';
import type { MethodologyBlock } from '../content/types';
import { fetchMethodologySql } from '../service';

// Methodology / transparency page (task 5.2). Content (sections, metrics) is
// reused from the framework-agnostic content modules; the source SQL map is
// fetched at runtime. Section ids back the hash deep-links handled by
// ScrollManager (requirements 8.2, 8.3).
export function MethodologyPage() {
  const { data: sqlMap = {} } = useQuery({
    queryKey: ['methodology', 'sql'],
    queryFn: fetchMethodologySql,
  });

  const sqlObjects = useMemo(() => {
    const used = new Map<string, string[]>();
    for (const metric of Object.values(metricExplanations)) {
      for (const name of metric.sqlObjects) {
        const titles = used.get(name) ?? [];
        if (!titles.includes(metric.title)) titles.push(metric.title);
        used.set(name, titles);
      }
    }
    return [...used.entries()].map(([name, usedBy]) => ({ name, usedBy }));
  }, []);

  const renderBlock = (block: MethodologyBlock, index: number) => {
    if (block.kind === 'paragraph') {
      return (
        <p key={index} className="mb-4 text-sm leading-relaxed text-[#1f2330]">
          {block.text}
        </p>
      );
    }
    if (block.kind === 'list') {
      return (
        <ul key={index} className="mb-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#1f2330]">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    }
    return (
      <div key={index} className="mb-4 w-full overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-[#1f2330]">
          <thead>
            <tr>
              {block.headers.map((header, h) => (
                <th key={h} className="border-b border-[#d4d7e0] py-2 pr-4 align-top font-bold text-[#434653]">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="border-b border-[#eceef3] py-2 pr-4 align-top leading-relaxed">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-7xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-black text-[#001f2a]">公開透明</h1>
        <p className="mb-10 text-sm text-[#434653]">
          本頁完整揭露 CodeShore 的資料來源、網站架構、資料庫設計與效能取捨。
        </p>

        <CloudArchitectureSection />

        {methodologySections.map(section => (
          <section key={section.id} id={section.id} className="mb-12 scroll-mt-20">
            <h2 className="mb-4 text-xl font-black text-[#003d92]">{section.title}</h2>
            {section.blocks.map((block, index) => renderBlock(block, index))}
          </section>
        ))}

        <section id="source-sql" className="mb-12 scroll-mt-20">
          <h2 className="mb-2 text-xl font-black text-[#003d92]">資料來源 SQL</h2>
          <p className="mb-6 text-sm leading-relaxed text-[#1f2330]">
            以下是各分析數字背後實際使用的資料庫物件定義，於建置時自 schema.sql 擷取。
          </p>

          {sqlObjects.map(obj => (
            <div key={obj.name} id={`sql-${obj.name}`} className="mb-6 scroll-mt-20">
              <h3 className="font-mono text-sm font-bold break-all text-[#001f2a]">{obj.name}</h3>
              <p className="mb-2 text-xs text-[#434653]">用於：{obj.usedBy.join('、')}</p>
              {sqlMap[obj.name] ? (
                <pre className="overflow-x-auto rounded-lg bg-[#001f2a] p-4 text-xs leading-relaxed text-[#d9f2ff]">
                  <code>{sqlMap[obj.name]}</code>
                </pre>
              ) : (
                <p className="rounded-lg bg-[#f4faff] p-4 text-xs text-[#434653]">SQL 載入中…</p>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
