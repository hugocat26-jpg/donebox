import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'package.json',
  'electron.vite.config.ts',
  'src/main/index.ts',
  'src/preload/index.ts',
  'src/renderer/index.html',
  'src/renderer/src/App.tsx',
  'src/renderer/src/main.tsx',
  'src/renderer/src/styles.css',
  'src/renderer/domain/task-model.ts',
  'src/renderer/domain/types.ts',
  'out/main/index.js',
  'out/preload/index.js',
  'out/renderer/index.html',
  'resources/icon.png',
  'resources/tray-icon.png'
];

const failures = [];

for (const file of requiredFiles) {
  const fullPath = join(root, file);
  if (!existsSync(fullPath)) {
    failures.push(`缺少文件：${file}`);
    continue;
  }
  if (statSync(fullPath).size === 0) {
    failures.push(`文件为空：${file}`);
  }
}

const htmlPath = join(root, 'out/renderer/index.html');
const html = existsSync(htmlPath) ? readFileSync(htmlPath, 'utf8') : '';
const assetMatches = [...html.matchAll(/(?:src|href)="\.\/assets\/([^"]+)"/g)].map((match) => match[1]);

if (assetMatches.length === 0) {
  failures.push('渲染入口没有引用 assets 资源');
}

for (const asset of assetMatches) {
  const assetPath = join(root, 'out/renderer/assets', asset);
  if (!existsSync(assetPath)) {
    failures.push(`缺少渲染资源：out/renderer/assets/${asset}`);
  } else if (statSync(assetPath).size < 1024) {
    failures.push(`渲染资源异常偏小：out/renderer/assets/${asset}`);
  }
}

const main = readFileSync(join(root, 'out/main/index.js'), 'utf8');
const preload = readFileSync(join(root, 'out/preload/index.js'), 'utf8');

const expectedMainFragments = [
  'setPath',
  'userData',
  'DoneBox',
  'createTray',
  'update-timer',
  'update-shortcut',
  'focus-quick-add'
];

for (const fragment of expectedMainFragments) {
  if (!main.includes(fragment)) {
    failures.push(`主进程缺少关键片段：${fragment}`);
  }
}

const expectedPreloadFragments = [
  'update-shortcut',
  'update-timer',
  'focus-quick-add',
  'exposeInMainWorld',
  'electron'
];

for (const fragment of expectedPreloadFragments) {
  if (!preload.includes(fragment)) {
    failures.push(`预加载脚本缺少关键片段：${fragment}`);
  }
}

const packageJson = readFileSync(join(root, 'package.json'), 'utf8');
const appSource = readFileSync(join(root, 'src/renderer/src/App.tsx'), 'utf8');
const domainSource = readFileSync(join(root, 'src/renderer/domain/task-model.ts'), 'utf8');

const expectedPackageFragments = [
  'electron-vite',
  'react',
  'localforage',
  '@dnd-kit/core',
  'framer-motion'
];

for (const fragment of expectedPackageFragments) {
  if (!packageJson.includes(fragment)) {
    failures.push(`package.json 缺少源码重建依赖或脚本：${fragment}`);
  }
}

const expectedDomainFragments = [
  'ticktick-clone',
  'tasks_list',
  'custom_lists',
  'custom_tags',
  '👋 欢迎使用 DoneBox',
  '配置 Obsidian 同步目录',
  '艾宾浩斯'
];

for (const fragment of expectedDomainFragments) {
  if (!domainSource.includes(fragment) && !appSource.includes(fragment)) {
    failures.push(`源码缺少数据契约或默认内容：${fragment}`);
  }
}

const expectedUiFragments = [
  '未分类',
  '今天',
  '最近7天',
  '列表视图',
  '看板视图',
  '日历视图',
  '时间线视图',
  '四象限视图',
  '番茄钟',
  '添加任务至',
  '搜索...'
];

for (const fragment of expectedUiFragments) {
  if (!appSource.includes(fragment)) {
    failures.push(`源码缺少关键 UI 文案：${fragment}`);
  }
}

if (failures.length > 0) {
  console.error('DoneBox 复刻校验失败：');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('DoneBox 复刻静态校验通过。');
console.log(`校验资源数：${requiredFiles.length + assetMatches.length}`);
