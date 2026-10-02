#!/usr/bin/env node
// orca-issue-to-brief.mjs — 把一張 orca-needs-spec 的 issue 變成 kiro 的起點。
//
// B 線原本的第一步是：手動 `gh issue view` 再把內容貼進 /kiro-discovery。那是搬運不是判斷，
// 所以搬進腳本。`orca-issue` 寫的七節剛好對得上 brief.md 的一半欄位。
//
// 用法：
//   node scripts/orca-issue-to-brief.mjs <issue>                 # 預設 dry-run，印出會寫什麼
//   node scripts/orca-issue-to-brief.mjs <issue> --write
//   node scripts/orca-issue-to-brief.mjs <issue> --write --name job-salary-filter
//
// 它只填「issue 裡真的有寫」的欄位。Approach、Boundary Candidates、Existing Spec Touchpoints
// 這些是判斷，腳本填不了，一律標成「未決」留給 /kiro-discovery 問你。
// **不要把未決欄位當成已經有答案**——那會讓 kiro-spec-init 跳過它本來該問的問題。
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..');
const TBD = '_未決——`/kiro-discovery` 要問出來，不要當成已有答案_';

const argv = process.argv.slice(2);
const num = Number(argv.find(a => /^\d+$/.test(a)));
const write = argv.includes('--write');
const nameIdx = argv.indexOf('--name');
const override = nameIdx > -1 ? argv[nameIdx + 1] : null;

if (!num) {
  console.error('用法：node scripts/orca-issue-to-brief.mjs <issue> [--write] [--name <feature>]');
  process.exit(1);
}

const raw = execFileSync('gh', ['issue', 'view', String(num), '--json', 'number,title,body,labels,url'], {
  cwd: REPO,
  encoding: 'utf8',
});
const issue = JSON.parse(raw);
const labels = issue.labels.map(l => l.name);

// dry-run 是唯讀的，永遠放行；擋的是真的寫檔那條路。
if (!labels.includes('orca-needs-spec')) {
  console.error(`⚠ #${num} 沒有 orca-needs-spec（現在是 ${labels.join('、') || '無 label'}）。`);
  console.error('  小任務不需要 spec，直接貼 orca-ready 讓 worker 做就好。');
  if (write && !argv.includes('--force')) {
    console.error('  真的要為它寫 spec 就加 --force。');
    process.exit(1);
  }
}

// ---------- 把七節拆開 ----------
function section(body, name) {
  const m = body.match(new RegExp(`^##\\s*${name}\\s*$([\\s\\S]*?)(?=^##\\s|\\z)`, 'm'));
  return m ? m[1].trim() : '';
}

const b = issue.body || '';
const parts = {
  現象: section(b, '現象'),
  想法: section(b, '使用者想法'),
  出處: section(b, '出處'),
  檔案: section(b, '涉及檔案'),
  重現: section(b, '重現步驟'),
  資訊: section(b, '需要的資訊'),
  驗收: section(b, '驗收條件'),
  範圍外: section(b, '不在範圍內'),
};

// ---------- feature name ----------
// 中文標題湊不出有意義的英文 slug，猜一個反而更難改名。拿不到就用 issue-<N>。
function slug(title) {
  const latin = title.replace(/^\[[^\]]*\]\s*/, '').match(/[A-Za-z][A-Za-z0-9]*/g);
  if (!latin || latin.length < 2) return null;
  return latin.slice(0, 4).join('-').toLowerCase();
}
const feature = override || slug(issue.title) || `issue-${num}`;
const dir = resolve(REPO, '.kiro/specs', feature);

// ---------- 組 brief.md ----------
const brief = `# Brief: ${feature}

> 由 \`scripts/orca-issue-to-brief.mjs\` 從 [#${num}](${issue.url}) 產生。
> 標「未決」的欄位是判斷，腳本填不了，\`/kiro-discovery\` 要問出來。

## Problem

${parts.現象 || TBD}

${parts.想法 ? `使用者原話：\n\n${parts.想法}\n` : ''}
## Current State

${parts.重現 || parts.現象 || TBD}

## Desired Outcome

${parts.驗收 || TBD}

## Approach

${TBD}

## Scope

- **In**: ${TBD}
- **Out**:

${parts.範圍外 || TBD}

## Boundary Candidates

${TBD}

## Out of Boundary

${parts.範圍外 || TBD}

## Upstream / Downstream

- **Upstream**: issue 列出的涉及檔案：

${parts.檔案 || '（issue 沒列）'}

- **Downstream**: ${TBD}

## Existing Spec Touchpoints

${TBD}

## Constraints

${parts.資訊 || '（issue 說無，可直接實作——但這是小任務的判斷，寫規格時要重新想一次）'}
`;

const missing = Object.entries(parts)
  .filter(([, v]) => !v)
  .map(([k]) => k);

console.log(`issue #${num}　${issue.title}`);
console.log(
  `feature：${feature}${override ? '（你指定的）' : slug(issue.title) ? '' : '（標題沒有可用的英文字，退回 issue-N）'}`,
);
console.log(`目錄：.kiro/specs/${feature}/`);
if (missing.length) console.log(`issue 缺這幾節：${missing.join('、')}`);

if (!write) {
  console.log('\n--- brief.md 預覽 ---\n');
  console.log(brief);
  console.log('--- 以上 dry-run。要寫入就加 --write ---');
  process.exit(0);
}

if (existsSync(resolve(dir, 'brief.md'))) {
  console.error(`\n${dir}/brief.md 已經存在，不覆蓋。要重產先自己刪掉。`);
  process.exit(1);
}

mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'brief.md'), brief, 'utf8');
writeFileSync(resolve(dir, 'issue.md'), `# ${issue.title}\n\n來源：${issue.url}\n\n---\n\n${b}\n`, 'utf8');

console.log(`\n寫好了：
  .kiro/specs/${feature}/brief.md   ← kiro-spec-init 會讀它
  .kiro/specs/${feature}/issue.md   ← 原始 issue 留底

下一步：
  /kiro-discovery ${feature}          # 把「未決」那幾欄問出來
  /kiro-spec-requirements ${feature}  # 然後照常三道審核

全部 approved 之後拆子 issue：
  node scripts/orca-tasks-to-issues.mjs ${feature} --parent ${num}`);
