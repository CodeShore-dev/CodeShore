// Cross-platform replacement for the old PowerShell-only build-x command
// (Remove-Item / New-Item / Copy-Item). Node's fs API behaves the same on
// native Windows, macOS, Linux, and WSL, so this works regardless of which
// shell nx invokes the run-commands executor through.
//
// Usage: node scripts/copy-dist.mjs <src> <dest>   (defaults: dist -> _dist)

import { cpSync, rmSync } from 'node:fs';

const [, , src = 'dist', dest = '_dist'] = process.argv;

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
