import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const localRuntime = join(root, '.runtime', 'win-unpacked');
const localExe = join(localRuntime, 'focus.exe');
const defaultSource = resolve(root, '..', '_DoneBox_source_20260610_182534', 'win-unpacked');

function resolveRuntimeSource() {
  if (process.env.DONEBOX_RUNTIME_DIR && existsSync(join(process.env.DONEBOX_RUNTIME_DIR, 'focus.exe'))) {
    return process.env.DONEBOX_RUNTIME_DIR;
  }
  if (existsSync(localExe)) {
    return localRuntime;
  }
  if (existsSync(join(defaultSource, 'focus.exe'))) {
    return defaultSource;
  }
  throw new Error(
    '找不到本地 Electron 运行时。请设置 DONEBOX_RUNTIME_DIR 指向解压后的 win-unpacked 目录，或先保留相邻的 _DoneBox_source_20260610_182534/win-unpacked。'
  );
}

async function ensureRuntime() {
  const source = resolveRuntimeSource();
  if (resolve(source) !== resolve(localRuntime)) {
    await rm(localRuntime, { recursive: true, force: true });
    await mkdir(dirname(localRuntime), { recursive: true });
    await cp(source, localRuntime, { recursive: true });
  }
}

async function syncCurrentApp() {
  const appDir = join(localRuntime, 'resources', 'app');
  await rm(appDir, { recursive: true, force: true });
  await mkdir(appDir, { recursive: true });
  await cp(join(root, 'out'), join(appDir, 'out'), { recursive: true });
  await cp(join(root, 'resources'), join(appDir, 'resources'), { recursive: true });
  await cp(join(root, 'package.json'), join(appDir, 'package.json'));
  await mkdir(join(appDir, 'node_modules', '@electron-toolkit'), { recursive: true });
  await cp(
    join(root, 'node_modules', '@electron-toolkit', 'utils'),
    join(appDir, 'node_modules', '@electron-toolkit', 'utils'),
    { recursive: true }
  );
}

await ensureRuntime();
await syncCurrentApp();

const child = spawn(localExe, [], {
  cwd: localRuntime,
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
