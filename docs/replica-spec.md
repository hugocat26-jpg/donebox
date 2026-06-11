# DoneBox 复刻规格书

## 目标

在当前仓库中以源码形式复刻 `DoneBox-portable-20260610_182534.zip` 里的 DoneBox 桌面应用。技术栈允许升级，但产品表现不能改变；任何视觉、交互、文案、流程差异都视为 bug。

## 原项目技术栈

- 应用形态：Electron Windows 便携版，复刻版入口程序名为 `donebox.exe`。
- 主进程：Electron CommonJS 产物，窗口尺寸 `1000 x 700`，隐藏菜单栏，`titleBarStyle: "hiddenInset"`，托盘图标，外链白名单。
- 预加载脚本：通过 `contextBridge` 暴露 `window.electron.ipcRenderer`，只允许 `update-shortcut`、`update-timer` 发送，只允许监听 `donebox-quick-add`。
- 渲染端：React 生产 bundle，Vite 风格入口，Tailwind CSS 输出。
- 依赖痕迹：`@dnd-kit`、`framer-motion`、`localforage`、`chrono-node`、`date-fns`、`lunar-javascript`、`react-markdown`、`remark-gfm`、`lucide-react`、`tailwind-merge`。
- 本地持久化：`localforage.config({ name: "ticktick-clone", storeName: "tasks" })`，主要键为 `tasks_list`、`custom_lists`、`custom_tags`，另有 `localStorage.removed_static_tags`。

## 新技术栈

- Electron + electron-vite：主进程、preload、renderer 统一源码构建。
- React + TypeScript：渲染端组件化源码。
- Tailwind CSS：复刻原样式系统。
- localforage：保持原本地数据模型。
- Vitest + TypeScript：领域模型和类型验证。
- electron-builder：生成 Windows 未压缩产物和便携包。

选择原因：该组合比生产 bundle 更可维护，同时保留 Electron 行为、localforage 数据契约和原 UI 结构，不以技术升级改变产品体验。

## 页面/路由结构

应用是单页桌面应用，无浏览器路由。页面状态由内部状态切换：

- 左侧菜单：`未分类`、`今天`、`最近7天`、默认清单 `工作`/`个人`、默认标签 `紧急`/`阅读`、底部 `设置`。
- 顶部视图：`列表视图`、`看板视图`、`日历视图`、`时间线视图`、`四象限视图`。
- 弹层/面板：`任务详情`、`搜索`、`快速添加`、`番茄钟`、`设置`、删除确认行为。

## 组件结构

- `App`：应用状态、localforage 读写、布局组合。
- `Sidebar`：菜单、清单、标签、计数、设置入口。
- `Header`：视图切换、搜索、番茄钟、新建。
- `TaskListView`：列表、拖拽排序、底部快速添加。
- `KanbanView`：按优先级列展示任务。
- `CalendarView`：月历展示有日期任务。
- `TimelineView`：按日期区间展示任务条。
- `MatrixView`：按重要/紧急展示四象限。
- `TaskDetail`：标题、Markdown 内容、日期、清单、优先级、重复、复习、依赖、子任务、删除。
- `QuickAddModal`、`SearchModal`、`PomodoroTimer`、`SettingsDialog`：对应原弹层。
- `src/renderer/domain/task-model.ts`：默认数据、筛选、重复任务、依赖、Obsidian 导入导出。

## UI 视觉规范

- 字体：`Inter`、`Alibaba PuHuiTi 3.0`、`Alibaba PuHuiTi`、`PingFang SC`、`Microsoft YaHei`、系统 sans。
- 主体：白色窗口，主内容极浅灰背景。
- 侧栏：约 `220px`，浅灰半透明玻璃感，右边框，蓝色活动项。
- 顶栏：白色半透明，左侧视图图标组，右侧搜索、番茄钟、新建按钮。
- 快速添加栏：底部固定，白色圆角，轻阴影，图标式日期/清单/优先级/语音控件。
- 顶部添加任务弹层：浅灰模糊遮罩，居中白色大面板，输入占位 `想做点什么?`，底部工具栏依次为日期、清单、优先级、标签、语音关闭、`↵ 保存, Esc 取消`、`保存`。
- 任务卡：白底、`8px` 圆角、浅边框、轻阴影，悬停变浅蓝。
- 弹层：白色卡片、轻阴影、`8px` 到 `14px` 圆角。

## 交互逻辑

- 左侧菜单切换筛选，默认隐藏已完成任务。
- 顶部五种视图读取同一任务数据。
- 底部输入框回车创建任务，支持自然语言日期和 `#tag` 提取。
- 顶部 `新建` 和全局快捷键打开同一个添加任务弹层；`Enter` 保存，`Escape` 或点击遮罩取消；保存按钮随标题空/非空切换禁用和启用。
- 任务支持完成、删除、点击打开详情、拖拽排序。
- 前置任务未完成时，任务 checkbox 显示锁定并阻止完成。
- 重复任务完成后保留一条已完成副本，并推进下一次截止日期。
- 艾宾浩斯任务完成后按阶段推进下一次复习日期。
- 详情面板支持 Markdown、子任务、清单、优先级、重复、复习、依赖。
- 搜索弹层按标题和内容搜索任务。
- 设置弹层支持快捷键保存、Markdown 导出和导入。
- 番茄钟支持专注/休息、分钟编辑、开始/暂停、重置，并通过 IPC 更新托盘计时。
- 主进程保留托盘菜单 `Show App`/`Quit`、全局快捷键、外链拦截、窗口隐藏标题栏。

## 状态管理和数据结构

- 任务字段：`id`、`title`、`content`、`listId`、`isDone`、`dueDate`、`startDate`、`tags`、`subTasks`、`createdAt`、`updatedAt`、`priority`、`blockedBy`、`repeatRule`、`ebbinghaus`、`ebbinghausStage`、`notified`。
- 默认清单：`list-work`/`工作`/`bg-blue-400`，`list-personal`/`个人`/`bg-green-400`。
- 默认标签：`urgent`/`紧急`，`reading`/`阅读`。
- localforage key：`tasks_list`、`custom_lists`、`custom_tags`。
- Electron IPC：Renderer -> Main `update-shortcut`、`update-timer`；Main -> Renderer `donebox-quick-add`。

## 构建、启动、测试方式

- 安装依赖：`npm install`
- 开发启动：`npm run dev`
- 测试和校验：`npm test`
- 构建未压缩 Windows 产物：`npm run build`
- 构建便携包：`npm run dist`

## 需要 1:1 保留的细节清单

- 产品名 `DoneBox`、窗口尺寸 `1000 x 700`、隐藏标题栏、自动隐藏菜单栏。
- 侧栏结构和默认文案。
- 顶部五个视图按钮顺序、搜索文案 `搜索...`、快捷键提示 `⌘K`。
- 空状态文案：`暂无未分类任务`、`今天没有待办任务`、`这个清单暂无任务`。
- 快速添加栏文案：`添加任务至 "xxx"，回车保存`。
- 顶部添加任务弹层文案：`想做点什么?`、`↵ 保存, Esc 取消`、`保存`。
- 默认快捷键 `Option+Space`。
- localforage 数据库名 `ticktick-clone` 与存储 key。
- 首次启动示例任务，包含欢迎、Obsidian、OKR、喝水、复习、依赖、重复、多日任务等。
- 番茄钟标题、专注/休息切换、开始/暂停/重置、托盘计时。
