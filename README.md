# DoneBox

这是从 `DoneBox-portable-20260610_182534.zip` 复刻出的 DoneBox Electron 桌面应用源码工程。

当前实现采用源码重建路线：Electron + Vite + React + TypeScript + Tailwind CSS。原便携包的运行效果是唯一视觉和交互基准；技术栈可以升级，但产品表现不能改变。

## 命令

```bash
npm install
npm run dev
npm test
npm run build
```

`npm run dev` 会先用 `electron-vite` 生成 `out`，再通过本地 `.runtime/win-unpacked` 启动应用。若本地没有 `.runtime`，脚本会尝试使用当前工作区相邻的 `_DoneBox_source_20260610_182534/win-unpacked` 生成本地运行时。

## 目录

- `src/main/index.ts`：Electron 主进程源码。
- `src/preload/index.ts`：预加载脚本源码。
- `src/renderer/`：React 渲染端源码。
- `src/renderer/domain/`：任务数据契约、筛选、重复任务、Obsidian 导入导出等领域逻辑。
- `resources/`：窗口和托盘图标。
- `docs/replica-spec.md`：复刻规格书。
- `scripts/verify-app.mjs`：源码和构建产物完整性校验。

## 复刻约束

用户可见的布局、文案、颜色、字体、间距、圆角、阴影、交互、动画和数据表现都必须与原应用保持一致。任何视觉、交互、文案、流程差异都按 bug 处理，不能作为技术升级的副作用接受。
