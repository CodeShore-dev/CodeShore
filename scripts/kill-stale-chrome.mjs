// 清除 Windows 端殘留的 chrome.exe(WSL 呼叫 Windows Chrome 時,crawler 異常結束不會殺掉 Windows 行程)。
// 殘留行程會鎖住 PUPPETEER_USER_DATA_DIR,導致下次啟動失敗:"Failed to launch the browser process!"。
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function readProfileDir() {
  if (process.env.PUPPETEER_USER_DATA_DIR) return process.env.PUPPETEER_USER_DATA_DIR;
  for (const file of ['apps/crawler/.env', '.env']) {
    try {
      const match = readFileSync(file, 'utf-8').match(/^PUPPETEER_USER_DATA_DIR=(.+)$/m);
      if (match) return match[1].trim();
    } catch {
      // 檔案不存在則略過
    }
  }
  return undefined;
}

const profileDir = readProfileDir();
if (!profileDir) {
  console.error('PUPPETEER_USER_DATA_DIR 未設定,無法判斷要清除哪些 chrome.exe。');
  process.exit(1);
}

const marker = profileDir.split(/[\\/]/).filter(Boolean).pop();
const ps = [
  `$procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${marker}*' }`,
  '$procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }',
  '($procs | Measure-Object).Count',
].join('; ');

const count = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf-8' }).trim();
console.log(`已清除 ${count} 個使用 ${profileDir} 的 chrome.exe 行程。`);
