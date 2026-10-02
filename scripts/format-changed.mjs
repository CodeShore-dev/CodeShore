#!/usr/bin/env node
// format-changed.mjs — 只對「這個 branch 改動過的檔」跑 prettier。
//
// 為什麼不直接 `prettier --check .`：全庫在 main 上就是紅的（578 個 .ts/.tsx 有 552 個不符
// `.prettierrc`），拿它當關卡量不出退化，worker 會困在那裡解釋它為何紅。細節見
// `.kiro/steering/tech.md` 的「已知落差」。
//
// 用法：
//   node scripts/format-changed.mjs --check   # 只檢查，不符就 exit 1（這是關卡）
//   node scripts/format-changed.mjs --write   # 就地修正
//
// 檔案來源是四者聯集：相對 main 的 commit、已 stage、未 stage、還沒加進 git 的新檔。
// 最後那項不能漏——worker 新增的元件與測試檔在 `git add` 之前都是 untracked，
// 而那正是最該被檢查的新程式碼。
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// 只管程式碼。`.md` / `.yml` 刻意不列：文件與 workflow 從來沒被 prettier 排過，
// 把它們納進來只會在每個 PR 製造無關 diff，而中文表格被 reflow 之後更難讀。
const EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|scss)$/;
const BASE = process.env.FORMAT_BASE ?? 'main';

const mode = process.argv.includes('--write') ? '--write' : '--check';

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).split('\n');
  } catch {
    return [];
  }
}

// main...HEAD 需要共同祖先；worktree 剛建好或 main 不存在時退回只看工作區。
const hasBase = git(['rev-parse', '--verify', '--quiet', BASE]).join('').trim() !== '';

const files = [
  ...(hasBase ? git(['diff', '--name-only', '--diff-filter=ACMR', `${BASE}...HEAD`]) : []),
  ...git(['diff', '--name-only', '--diff-filter=ACMR', '--cached']),
  ...git(['diff', '--name-only', '--diff-filter=ACMR']),
  ...git(['ls-files', '--others', '--exclude-standard']),
]
  .map(f => f.trim())
  .filter(f => f && EXT.test(f) && existsSync(f));

const unique = [...new Set(files)];

if (unique.length === 0) {
  console.log('沒有改動到 prettier 管得到的檔案，跳過。');
  process.exit(0);
}

console.log(`對 ${unique.length} 個改動檔跑 prettier ${mode}（基準 ${hasBase ? BASE : '工作區'}）`);

try {
  execFileSync('npx', ['prettier', mode, ...unique], { stdio: 'inherit' });
} catch {
  // prettier 自己印了哪幾個檔不符，這裡不要再重複一次
  process.exit(1);
}
