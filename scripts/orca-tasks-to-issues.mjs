#!/usr/bin/env node
// orca-tasks-to-issues.mjs — 把核准過的 tasks.md 拆成可以派工的子 issue。
//
// B 線（大任務）最後一段原本是純手工：讀 tasks.md、判斷哪幾條能平行、一張一張開 issue、
// 回頭更新母 issue。那是機械勞動不是判斷，所以搬進腳本。
//
// 用法：
//   node scripts/orca-tasks-to-issues.mjs <feature> --parent <母 issue>          # 預設 dry-run
//   node scripts/orca-tasks-to-issues.mjs <feature> --parent <N> --create        # 真的開
//   node scripts/orca-tasks-to-issues.mjs <feature> --parent <N> --create --limit 3
//
// 拆分規則（來自 tasks.md 本來就有的標記）：
//   一張子 issue = 一個 `_Boundary:_`，不是一條 task。一個 PR 的範圍是一個責任邊界。
//   `_Depends: a, b_` 指到還沒 [x] 且不在同一個 boundary 的 task → 這個 boundary 還不能開。
//   標題含「需要使用者授權」的 task → 整個 boundary 不開，那是人的工作。
//   全部 task 都已經 [x] 的 boundary → 跳過。
//
// 為什麼預設 dry-run：開 issue 會觸發 webhook 立刻派工，而 orca-dispatch.sh 一次最多 3 個，
// 一口氣開 5 張的話後兩張不會自動補派。先看清單再決定。
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..');
const MANUAL = /需要使用者授權|需要授權|人工/;

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function gh(args, { allowFail = false } = {}) {
  try {
    return execFileSync('gh', args, { cwd: REPO, encoding: 'utf8' }).trim();
  } catch (e) {
    if (allowFail) return '';
    die(`gh 失敗：${args.join(' ')}\n${e.stderr || e.message}`);
  }
}

// ---------- 解析 tasks.md ----------

// 一條 task：`- [ ] 1.2 (P) 標題` 後面跟著縮排的 bullet，其中可能有 _Boundary:_ / _Depends:_
function parseTasks(md) {
  const tasks = [];
  let cur = null;
  for (const line of md.split('\n')) {
    const head = line.match(/^- \[([ x])\]\s+([\d.]+)\s*(\(P\))?\s*(.*)$/);
    if (head) {
      cur = {
        done: head[1] === 'x',
        id: head[2].replace(/\.$/, ''),
        parallel: Boolean(head[3]),
        title: head[4].trim(),
        detail: [],
        boundary: null,
        depends: [],
      };
      tasks.push(cur);
      continue;
    }
    if (!cur) continue;
    const b = line.match(/_Boundary:\s*(.+?)_/);
    if (b) {
      cur.boundary = b[1].trim();
      continue;
    }
    const d = line.match(/_Depends:\s*(.+?)_/);
    if (d) {
      cur.depends = d[1]
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      continue;
    }
    if (/^\s+- /.test(line) && !/_(Requirements|Boundary|Depends):/.test(line)) {
      cur.detail.push(line.trim().replace(/^- /, ''));
    }
  }
  // 沒有 _Boundary:_ 的是父層標題（`- [ ] 1. Foundation：…`），不是可派工的工作
  return tasks.filter(t => t.boundary);
}

function groupByBoundary(tasks) {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const groups = new Map();
  for (const t of tasks) {
    if (!groups.has(t.boundary)) groups.set(t.boundary, []);
    groups.get(t.boundary).push(t);
  }

  const out = [];
  for (const [boundary, items] of groups) {
    const pending = items.filter(t => !t.done);
    if (pending.length === 0) {
      out.push({ boundary, items, skip: '全部已完成' });
      continue;
    }
    const manual = pending.find(t => MANUAL.test(t.title));
    if (manual) {
      out.push({ boundary, items, skip: `${manual.id} 需要你親自做` });
      continue;
    }
    // 外部依賴：指到別的 boundary 且那條還沒 [x]
    const blocked = [];
    for (const t of pending) {
      for (const dep of t.depends) {
        const d = byId.get(dep);
        if (d && d.boundary !== boundary && !d.done) blocked.push(`${t.id} 等 ${dep}`);
      }
    }
    if (blocked.length) {
      out.push({ boundary, items, skip: `等前置：${blocked.join('、')}` });
      continue;
    }
    out.push({ boundary, items, pending });
  }
  return out;
}

// ---------- 產 issue 內文 ----------

function issueBody(feature, parent, group) {
  const specDir = `.kiro/specs/${feature}`;
  const lines = [
    '## 現象',
    '',
    `這張是 \`#${parent}\` 拆出來的實作工作，範圍是 **${group.boundary}** 這個責任邊界。`,
    '規格已核准，不要重新討論要不要做，照 tasks.md 實作即可。',
    '',
    '## 出處',
    '',
    `- 母 issue：#${parent}`,
    `- 規格：\`${specDir}/\`（requirements / design / tasks 都已 approved）`,
    `- Boundary：\`${group.boundary}\``,
    '',
    '## 涉及檔案',
    '',
    `- 依 \`${specDir}/design.md\` 的資料模型與架構，不要自己另外設計`,
    `- 命名與放置照 \`.kiro/steering/structure.md\``,
    '',
    '## 重現步驟',
    '',
    `- 不適用（這是依規格的實作，不是 bug）`,
    '',
    '## 需要的資訊',
    '',
    `- 無。規格已核准，不清楚的先讀 \`${specDir}/design.md\` 與 \`requirements.md\``,
    '',
    '## 驗收條件',
    '',
  ];
  for (const t of group.pending) {
    lines.push(`- [ ] **${t.id}** ${t.title}`);
    for (const d of t.detail) lines.push(`  - ${d}`);
  }
  lines.push('- [ ] 既有測試不退化');
  lines.push('');
  lines.push('## 不在範圍內');
  lines.push('');
  lines.push(`- 其他 boundary 的 task（這張只做 \`${group.boundary}\`）`);
  lines.push(`- 修改 \`${specDir}/\` 底下的規格檔。規格要改就退回 #${parent} 討論`);
  lines.push('');
  return lines.join('\n');
}

// ---------- 主流程 ----------

const argv = process.argv.slice(2);
const feature = argv.find(a => !a.startsWith('--'));
const parent = Number(argv[argv.indexOf('--parent') + 1]);
const create = argv.includes('--create');
const limitIdx = argv.indexOf('--limit');
const limit = limitIdx > -1 ? Number(argv[limitIdx + 1]) : 3;

if (!feature || !parent) {
  die('用法：node scripts/orca-tasks-to-issues.mjs <feature> --parent <母 issue> [--create] [--limit 3]');
}

const tasksPath = resolve(REPO, '.kiro/specs', feature, 'tasks.md');
if (!existsSync(tasksPath)) die(`找不到 ${tasksPath}。先跑完 /kiro-spec-tasks。`);

const specJson = resolve(REPO, '.kiro/specs', feature, 'spec.json');
if (existsSync(specJson)) {
  const ap = JSON.parse(readFileSync(specJson, 'utf8')).approvals || {};
  const missing = ['requirements', 'design', 'tasks'].filter(k => !ap[k]?.approved);
  if (missing.length) die(`這份 spec 還沒核准完：${missing.join('、')}。拆 issue 之前先審完。`);
}

const groups = groupByBoundary(parseTasks(readFileSync(tasksPath, 'utf8')));
const ready = groups.filter(g => !g.skip);
const skipped = groups.filter(g => g.skip);

console.log(`feature：${feature}　母 issue：#${parent}`);
console.log(`boundary 共 ${groups.length} 個，可以開 ${ready.length} 個\n`);

for (const g of skipped) console.log(`  —  ${g.boundary}　（跳過：${g.skip}）`);
for (const g of ready) {
  console.log(`  ✔  ${g.boundary}　${g.pending.length} 條 task：${g.pending.map(t => t.id).join('、')}`);
}

const batch = ready.slice(0, limit);
if (ready.length > limit) {
  console.log(`\n這輪只開前 ${limit} 個。orca-dispatch.sh 一次最多派 ${limit} 個，多開的不會自動補派。`);
  console.log('前面的 PR merge 之後再跑一次，剩下的會接著開。');
}

if (!create) {
  console.log('\n這是 dry-run。確認清單沒問題就加 --create。');
  process.exit(0);
}

const created = [];
for (const g of batch) {
  const title = `[spec:${feature}] ${g.boundary}`;
  const body = issueBody(feature, parent, g);
  const url = gh([
    'issue',
    'create',
    '--title',
    title,
    '--label',
    'orca-ready',
    '--label',
    'enhancement',
    '--body',
    body,
  ]);
  const num = url.split('/').pop();
  created.push({ num, boundary: g.boundary, url });
  console.log(`開了 #${num}　${g.boundary}　${url}`);
}

// 母 issue：補上子 issue 的 task list（GitHub 會自動顯示進度並回連），拿掉 orca-needs-spec
const parentBody = gh(['issue', 'view', String(parent), '--json', 'body', '-q', '.body']);
const marker = '## 子 issue';
const list = created.map(c => `- [ ] #${c.num} ${c.boundary}`).join('\n');
const newBody = parentBody.includes(marker)
  ? parentBody.replace(marker, `${marker}\n\n${list}`)
  : `${parentBody}\n\n${marker}\n\n規格：\`.kiro/specs/${feature}/\`\n\n${list}\n`;
gh(['issue', 'edit', String(parent), '--body', newBody]);
gh(['issue', 'edit', String(parent), '--remove-label', 'orca-needs-spec'], { allowFail: true });

console.log(`\n母 issue #${parent} 已更新子 issue 清單，並拿掉 orca-needs-spec。`);
console.log('母 issue 本身不貼 orca-ready——它是追蹤單，不是工作。');
