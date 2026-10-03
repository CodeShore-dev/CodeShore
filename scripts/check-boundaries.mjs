#!/usr/bin/env node
// check-boundaries.mjs — 只檢查 @nx/enforce-module-boundaries，忽略其他 lint finding。
//
// 為什麼不直接在 CI 跑 `nx lint`：main 上有 62 個既有 error，接上去永遠紅，就是假關卡
// （細節見 .kiro/steering/tech.md 的「已知落差」）。但專案邊界的違規數在 main 上是 0，
// 所以它符合「只接已經綠的檢查」這條規則，可以當真關卡。
//
// 用法：
//   node scripts/check-boundaries.mjs          # 違規就 exit 1
//
// 不用 eslint 的 exit code：那 62 個既有 error 會讓它永遠非零。只數 boundary 那一條。
import { spawnSync } from 'node:child_process';

const RULE = '@nx/enforce-module-boundaries';

const run = spawnSync('npx', ['nx', 'run-many', '-t', 'lint', '--skip-nx-cache', '--parallel=3'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

// eslint 的輸出帶 ANSI 顏色，`grep` 得先拆掉
const raw = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
const plain = raw.replace(/\u001b\[[0-9;]*m/g, '');

// 健全性檢查：lint 真的跑過了嗎。沒有這段的話，nx 自己爆掉會被誤判成「零違規」。
const ranLint = /Running target lint for \d+ project|Successfully ran target lint|error|warning/.test(plain);
if (!ranLint) {
  console.error('看不出 lint 真的跑過，不當成通過。原始輸出：');
  console.error(plain.slice(-4000));
  process.exit(2);
}

const violations = plain
  .split('\n')
  .filter(line => line.includes(RULE))
  .map(line => line.trim());

if (violations.length === 0) {
  console.log(`${RULE}：0 個違規。`);
  process.exit(0);
}

// 把違規前面那一行的檔名一起印出來，否則只看到規則名不知道是哪個檔
const lines = plain.split('\n');
console.error(`${RULE}：${violations.length} 個違規。`);
let lastFile = '';
for (const line of lines) {
  const stripped = line.trim();
  if (/^\/.*\.(ts|tsx|js|jsx)$/.test(stripped)) lastFile = stripped;
  if (stripped.includes(RULE)) console.error(`  ${lastFile}\n    ${stripped}`);
}
console.error('\n依賴方向定義在 .eslintrc.json 的 depConstraints 與各 project.json 的 tags。');
console.error('細節見 .kiro/steering/tech.md 的「硬層」。');
process.exit(1);
