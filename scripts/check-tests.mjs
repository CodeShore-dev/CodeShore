#!/usr/bin/env node
// check-tests.mjs — 測試的 CI 關卡。判準是「今天綠的專案不准變紅」，不是「全綠」。
//
// 為什麼不直接跑 `nx affected -t test` 當關卡：9 個有 test target 的專案裡有 4 個在乾淨的
// main 上就紅（Missing Supabase credentials、mock 與實作不同步）。接上去就是假關卡，而假關卡
// 比沒有關卡更糟——worker 會花整段時間解釋它為何紅（ptr:format:check 與 nx lint 都發生過，
// 見 docs/pacer-log.md 2026-10-02 那兩列）。
//
// 基準線在 scripts/test-baseline.json。修好一個就從那裡刪掉；某個列在基準線的專案變綠時，
// 這支腳本會提醒你刪，清單不會爛掉。
//
// 用法：
//   node scripts/check-tests.mjs                      # 預設比 origin/main
//   TEST_BASE=main node scripts/check-tests.mjs       # 本機用
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BASE = process.env.TEST_BASE ?? 'origin/main';
const baseline = JSON.parse(readFileSync(new URL('./test-baseline.json', import.meta.url), 'utf8'));
const known = new Set(Object.keys(baseline.knownFailing ?? {}));

const strip = t => t.replace(/\u001b\[[0-9;]*m/g, '');

function nx(args) {
  const r = spawnSync('npx', ['nx', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { out: strip(`${r.stdout ?? ''}\n${r.stderr ?? ''}`), code: r.status };
}

// 這輪實際跑到的專案。沒跑到的不算進判斷——affected 可能根本沒碰到它們。
const listed = nx(['show', 'projects', '--affected', `--base=${BASE}`, '--head=HEAD', '--withTarget=test']);
const ran = new Set(
  listed.out
    .split('\n')
    .map(l => l.trim())
    .filter(l => /^[a-z0-9][a-z0-9-]*$/.test(l)),
);

if (ran.size === 0) {
  console.log('這次改動沒有影響到任何帶 test target 的專案，跳過。');
  process.exit(0);
}
console.log(`這輪要跑的專案（${ran.size}）：${[...ran].sort().join(', ')}`);

const run = nx(['affected', '-t', 'test', `--base=${BASE}`, '--head=HEAD', '--parallel=2']);
console.log(run.out);

// nx 失敗時會印「Failed tasks:」再接 `- <project>:test`
const failed = new Set();
let inFailedBlock = false;
for (const line of run.out.split('\n')) {
  const t = line.trim();
  if (/^Failed tasks:/.test(t)) {
    inFailedBlock = true;
    continue;
  }
  if (inFailedBlock) {
    const m = t.match(/^-\s+([a-z0-9][a-z0-9-]*):test$/);
    if (m) {
      failed.add(m[1]);
      continue;
    }
    if (t !== '') inFailedBlock = false;
  }
}

// 健全性：nx 回非零卻解不出任何失敗專案，表示它是在別的地方爆掉的。不要當成通過。
if (run.code !== 0 && failed.size === 0) {
  console.error('nx 回了非零但解不出失敗專案清單，不當成通過。');
  process.exit(2);
}

const newlyFailing = [...failed].filter(p => !known.has(p)).sort();
const newlyPassing = [...ran].filter(p => known.has(p) && !failed.has(p)).sort();

if (newlyPassing.length > 0) {
  console.log(`\n這幾個已經不紅了，請從 scripts/test-baseline.json 的 knownFailing 刪掉：${newlyPassing.join(', ')}`);
}

if (newlyFailing.length === 0) {
  const stillRed = [...failed].sort().join(', ') || '無';
  console.log(`\n沒有新的失敗專案。仍在基準線上的：${stillRed}`);
  process.exit(0);
}

console.error(`\n新增失敗的專案：${newlyFailing.join(', ')}`);
console.error('這幾個在乾淨的 main 上是綠的，所以是這次改動弄壞的。');
console.error('基準線在 scripts/test-baseline.json。確定是既有問題才加進去，並寫清楚原因。');
process.exit(1);
