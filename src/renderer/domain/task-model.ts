import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import type { ActiveMenu, CustomTag, MatrixQuadrant, RepeatRule, Task, TaskList } from './types';

export const TASKS_KEY = 'tasks_list';
export const LISTS_KEY = 'custom_lists';
export const CUSTOM_TAGS_KEY = 'custom_tags';
export const DEFAULT_TAGS = ['urgent', 'reading'];
export const INITIAL_LISTS: TaskList[] = [
  { id: 'list-work', label: '工作', color: 'bg-blue-400' },
  { id: 'list-personal', label: '个人', color: 'bg-green-400' }
];

export const TAG_MAPPING: Record<string, string> = {
  urgent: '紧急',
  reading: '阅读',
  work: '工作',
  personal: '个人',
  study: '学习',
  health: '健康',
  finance: '财务',
  family: '家庭',
  obsidian: 'obsidian',
  learning: 'learning',
  frontend: 'frontend',
  travel: 'travel',
  development: 'development'
};

export function getTagLabel(tagId: string): string {
  const raw = tagId.startsWith('tag-') ? tagId.slice(4) : tagId;
  return TAG_MAPPING[raw] || raw;
}

export function normalizeTagId(tag: string): string {
  return String(tag || '').trim().replace(/^tag-/, '');
}

export function mergeTags(defaultTags: string[], customTags: CustomTag[]): CustomTag[] {
  const mappedDefaults = defaultTags.map((id) => ({ id, label: getTagLabel(id) }));
  const seen = new Set(mappedDefaults.map((tag) => tag.id));
  const custom = customTags.filter((tag) => {
    const id = normalizeTagId(tag.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return [...mappedDefaults, ...custom.map((tag) => ({ id: normalizeTagId(tag.id), label: tag.label || getTagLabel(tag.id) }))];
}

export function getNextSelectedTaskId(current: string | null, clicked: string): string | null {
  return current === clicked ? null : clicked;
}

export function createId(prefix = 'task'): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function dayAtNoon(base: Date): Date {
  const date = new Date(base);
  date.setHours(12, 0, 0, 0);
  return date;
}

type MatrixTask = Task & {
  important: boolean;
  urgentOverride: boolean | null;
};

type MatrixPatch = Pick<Task, 'important' | 'urgentOverride' | 'sortOrder'>;

const legacyMatrixByPriority: Record<Task['priority'], Pick<MatrixTask, 'important' | 'urgentOverride'>> = {
  3: { important: true, urgentOverride: true },
  2: { important: true, urgentOverride: false },
  1: { important: false, urgentOverride: true },
  0: { important: false, urgentOverride: false }
};

const matrixQuadrantPatch: Record<MatrixQuadrant, Pick<MatrixTask, 'important' | 'urgentOverride'>> = {
  'important-urgent': { important: true, urgentOverride: true },
  'important-not-urgent': { important: true, urgentOverride: false },
  'not-important-urgent': { important: false, urgentOverride: true },
  'not-important-not-urgent': { important: false, urgentOverride: false }
};

const matrixQuadrantWeight: Record<MatrixQuadrant, number> = {
  'important-urgent': 0,
  'important-not-urgent': 1,
  'not-important-urgent': 2,
  'not-important-not-urgent': 3
};

function hasOwnTaskField(task: Task, field: keyof Task): boolean {
  return Object.prototype.hasOwnProperty.call(task, field);
}

export function normalizeTaskForMatrix(task: Task): MatrixTask {
  const hasMatrixFields = hasOwnTaskField(task, 'important') || hasOwnTaskField(task, 'urgentOverride');
  const legacy = legacyMatrixByPriority[task.priority];
  const important = hasMatrixFields ? task.important ?? false : legacy.important;
  const urgentOverride = hasMatrixFields ? task.urgentOverride ?? null : legacy.urgentOverride;
  const sortOrder = Number.isFinite(task.sortOrder) ? task.sortOrder : undefined;
  return { ...task, important, urgentOverride, sortOrder };
}

export function resolveTaskUrgency(task: Task, referenceDate = new Date()): boolean {
  const normalized = normalizeTaskForMatrix(task);
  if (normalized.urgentOverride !== null) return normalized.urgentOverride;
  if (!normalized.dueDate) return false;
  const dueDay = startOfDay(new Date(normalized.dueDate)).getTime();
  const today = startOfDay(referenceDate).getTime();
  const afterTomorrow = addDays(startOfDay(referenceDate), 2).getTime();
  return dueDay < today || dueDay < afterTomorrow;
}

export function getMatrixQuadrant(task: Task, referenceDate = new Date()): MatrixQuadrant {
  const normalized = normalizeTaskForMatrix(task);
  const important = normalized.important;
  const urgent = resolveTaskUrgency(normalized, referenceDate);
  if (important && urgent) return 'important-urgent';
  if (important) return 'important-not-urgent';
  if (urgent) return 'not-important-urgent';
  return 'not-important-not-urgent';
}

function compareNumberWithNullsLast(left?: number | null, right?: number | null): number {
  const leftHasValue = typeof left === 'number';
  const rightHasValue = typeof right === 'number';
  if (leftHasValue && rightHasValue) return left - right;
  if (leftHasValue) return -1;
  if (rightHasValue) return 1;
  return 0;
}

function compareStableTaskFallback(left: Task, right: Task): number {
  const priorityResult = right.priority - left.priority;
  if (priorityResult !== 0) return priorityResult;
  const dueDateResult = compareNumberWithNullsLast(left.dueDate, right.dueDate);
  if (dueDateResult !== 0) return dueDateResult;
  const createdAtResult = left.createdAt - right.createdAt;
  if (createdAtResult !== 0) return createdAtResult;
  return left.id.localeCompare(right.id);
}

function compareMatrixTasksInQuadrant(left: Task, right: Task): number {
  const leftHasSort = typeof left.sortOrder === 'number';
  const rightHasSort = typeof right.sortOrder === 'number';
  if (leftHasSort && rightHasSort) {
    const sortResult = (left.sortOrder as number) - (right.sortOrder as number);
    if (sortResult !== 0) return sortResult;
    return compareStableTaskFallback(left, right);
  }
  if (leftHasSort) return -1;
  if (rightHasSort) return 1;
  return compareStableTaskFallback(left, right);
}

export function sortMatrixTasks(tasks: Task[], referenceDate = new Date()): Task[] {
  return [...tasks].sort((left, right) => {
    const leftQuadrant = getMatrixQuadrant(left, referenceDate);
    const rightQuadrant = getMatrixQuadrant(right, referenceDate);
    const quadrantResult = matrixQuadrantWeight[leftQuadrant] - matrixQuadrantWeight[rightQuadrant];
    if (quadrantResult !== 0) return quadrantResult;
    return compareMatrixTasksInQuadrant(normalizeTaskForMatrix(left), normalizeTaskForMatrix(right));
  });
}

function matrixSortAnchor(task: Task, index: number): number {
  return typeof task.sortOrder === 'number' ? task.sortOrder : (index + 1) * 1000;
}

export function getNextMatrixSortOrder(targetTasks: Task[], overId?: string | null, referenceDate = new Date()): number {
  const ordered = sortMatrixTasks(targetTasks, referenceDate);
  if (ordered.length === 0) return 1000;
  const overIndex = overId ? ordered.findIndex((task) => task.id === overId) : -1;
  if (overIndex === -1) return matrixSortAnchor(ordered[ordered.length - 1], ordered.length - 1) + 1000;
  const nextAnchor = matrixSortAnchor(ordered[overIndex], overIndex);
  if (overIndex === 0) return nextAnchor / 2;
  const previousAnchor = matrixSortAnchor(ordered[overIndex - 1], overIndex - 1);
  return (previousAnchor + nextAnchor) / 2;
}

export function getMatrixPatchForQuadrant(
  task: Task,
  quadrant: MatrixQuadrant,
  targetTasks: Task[] = [],
  overId?: string | null,
  referenceDate = new Date()
): MatrixPatch {
  const patch = matrixQuadrantPatch[quadrant];
  const targetWithoutTask = targetTasks.filter((targetTask) => targetTask.id !== task.id);
  return {
    ...patch,
    sortOrder: getNextMatrixSortOrder(targetWithoutTask, overId, referenceDate)
  };
}

export function generateSampleTasks(referenceDate = new Date(), idFactory = createId): Task[] {
  const now = referenceDate.getTime();
  const today = dayAtNoon(referenceDate);
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  const twoDaysAgo = addDays(today, -2);
  const in3Days = addDays(today, 3);
  const in5Days = addDays(today, 5);
  const nextWeekend = new Date(today);
  const daysUntilSaturday = 6 - nextWeekend.getDay();
  nextWeekend.setDate(nextWeekend.getDate() + (daysUntilSaturday >= 0 ? daysUntilSaturday : 6));
  const nextWeek = addDays(today, 7);
  const taskAId = idFactory('task');
  const taskBId = idFactory('task');

  return [
    {
      id: idFactory('task'),
      title: '👋 欢迎使用 DoneBox',
      content:
        'DoneBox 是一款轻量桌面端待办清单软件。Put it in. Get it done.\n\n**核心功能**:\n- ⚡️ **快速收集**: 使用全局快捷键 (`Option+Space`) 随时添加任务。\n- 🧠 **智能解析**: 输入“明天下午3点开会”，自动识别并设置截止日期。\n- 🍅 **番茄钟**: 点击右上角番茄图标，开始专注工作。\n- 📊 **多维视图**: 顶栏无缝切换列表、看板、日历、时间线、四象限等多种视图。\n- 📈 **科学复习**: 在任务详情中开启**艾宾浩斯记忆曲线**，科学规划复习周期。\n- 🔗 **任务依赖**: 在详情面板设置“前置任务”，理清工作流。\n- 📝 **Obsidian 联动**: 在左下角设置中，一键导入导出 Markdown 待办。\n\n快点击左侧的**清单**和**标签**探索更多功能吧！',
      listId: 'inbox',
      isDone: false,
      dueDate: today.getTime(),
      tags: [],
      subTasks: [
        { id: idFactory('sub'), title: '尝试点击完成这个子任务', isDone: false },
        { id: idFactory('sub'), title: '去顶部切换到【日历】视图看看', isDone: false },
        { id: idFactory('sub'), title: '在左侧边栏新建一个标签', isDone: false }
      ],
      createdAt: now,
      updatedAt: now,
      priority: 3
    },
    {
      id: taskAId,
      title: '配置 Obsidian 同步目录',
      content: '在 Obsidian 中创建一个专门用于存放 DoneBox 导出任务的文件夹。',
      listId: 'list-work',
      isDone: false,
      dueDate: today.getTime(),
      tags: ['obsidian'],
      subTasks: [],
      createdAt: now - 5_000,
      updatedAt: now - 5_000,
      priority: 2
    },
    {
      id: taskBId,
      title: '导出本周任务到 Obsidian',
      content: '利用左下角的【设置】-【数据导入与导出】，将本周的计划导出并备份。\n\n*注意：此任务已被锁定，必须先完成“配置 Obsidian 同步目录”才能打勾。*',
      listId: 'list-work',
      isDone: false,
      dueDate: tomorrow.getTime(),
      tags: ['obsidian'],
      subTasks: [],
      createdAt: now - 4_000,
      updatedAt: now - 4_000,
      priority: 1,
      blockedBy: [taskAId]
    },
    baseTask(idFactory, '规划下季度 OKR', '与团队对齐下季度的核心目标与关键结果，输出文档。', 'list-work', in5Days.getTime(), ['urgent'], 2, now, [
      '收集各部门意见',
      '草拟初版文档',
      '开会评审'
    ]),
    { ...baseTask(idFactory, '💧 每天喝水 2000ml', '保持健康，每天至少喝 8 杯水。', 'list-personal', today.getTime(), [], 0, now - 10_000), repeatRule: { type: 'daily', interval: 1 } },
    baseTask(idFactory, '学习前端进阶教程', '掌握 React 性能优化和底层原理。', 'inbox', tomorrow.getTime(), ['learning', 'frontend'], 1, now - 20_000, [
      '观看视频课程',
      '跟着敲一遍代码',
      '写一篇博客总结'
    ]),
    baseTask(idFactory, '周末大扫除', '清理卧室、客厅，给植物浇水。', 'list-personal', nextWeekend.getTime(), [], 1, now - 30_000),
    baseTask(idFactory, '完成产品原型设计', '包含首页、任务详情页、设置面板的设计稿。', 'list-work', today.getTime(), ['urgent'], 2, now - 40_000),
    baseTask(idFactory, '缴纳水电费', '', 'list-personal', yesterday.getTime(), [], 3, now - 50_000),
    { ...baseTask(idFactory, '阅读《代码整洁之道》第一章', '使用番茄钟保持25分钟的专注阅读。', 'inbox', tomorrow.getTime(), ['reading'], 1, now - 60_000), ebbinghaus: true, ebbinghausStage: 0 },
    { ...baseTask(idFactory, '周报总结', '总结本周的工作进度并规划下周计划。', 'list-work', today.getTime(), [], 2, now - 70_000), repeatRule: { type: 'weekly', interval: 1 } },
    { ...baseTask(idFactory, '苏州旅行', '去平江路喝茶，逛拙政园，吃松鼠桂鱼。', 'list-personal', in3Days.getTime(), ['travel'], 2, now - 80_000), startDate: today.getTime() },
    { ...baseTask(idFactory, '读《夜晚的潜水艇》', '陈春成短篇小说集，每天读两篇。', 'list-personal', tomorrow.getTime(), ['reading'], 1, now - 85_000), startDate: yesterday.getTime() },
    { ...baseTask(idFactory, '准备季度财报', '整理财务数据，制作PPT并向董事会汇报。', 'list-work', tomorrow.getTime(), ['finance', 'urgent'], 3, now - 86_000), startDate: twoDaysAgo.getTime() },
    { ...baseTask(idFactory, '开发新版用户中心', '包括前端UI重构和后端接口联调。', 'list-work', nextWeek.getTime(), ['development'], 2, now - 87_000, ['UI组件开发', '接口联调', '测试上线']), startDate: today.getTime() },
    baseTask(idFactory, '回复工作邮件', '处理积累的客户咨询。', 'list-work', today.getTime(), [], 0, now - 90_000),
    baseTask(idFactory, '检查代码审查请求 (PR)', '前端组件重构的 PR 需要合入。', 'list-work', today.getTime(), [], 1, now - 95_000),
    baseTask(idFactory, '更新项目文档', '补充新加功能的 API 文档说明。', 'list-work', today.getTime(), [], 0, now - 100_000),
    baseTask(idFactory, '参加每日站会', '下午2点在会议室3。', 'list-work', today.getTime(), [], 2, now - 105_000),
    baseTask(idFactory, '取快递', '丰巢柜：圆通速递。', 'list-personal', today.getTime(), [], 0, now - 110_000),
    baseTask(idFactory, '买点水果', '下班路过去超市买些苹果和香蕉。', 'list-personal', today.getTime(), [], 0, now - 115_000),
    baseTask(idFactory, '预订高铁票', '提前购买周末回家的高铁票。', 'list-personal', tomorrow.getTime(), [], 1, now - 116_000),
    baseTask(idFactory, '续费服务器', '个人网站服务器快到期了，记得续费。', 'inbox', in3Days.getTime(), ['urgent'], 2, now - 117_000),
    baseTask(idFactory, '看牙医', '下午3点，中心医院口腔科复诊。', 'list-personal', tomorrow.getTime(), ['health'], 3, now - 118_000)
  ];
}

function baseTask(
  idFactory: (prefix?: string) => string,
  title: string,
  content: string,
  listId: string,
  dueDate: number,
  tags: string[],
  priority: Task['priority'],
  createdAt: number,
  subTaskTitles: string[] = []
): Task {
  return {
    id: idFactory('task'),
    title,
    content,
    listId,
    isDone: false,
    dueDate,
    tags,
    subTasks: subTaskTitles.map((subTitle) => ({ id: idFactory('sub'), title: subTitle, isDone: false })),
    createdAt,
    updatedAt: createdAt,
    priority
  };
}

export function filterTasks(tasks: Task[], activeMenu: ActiveMenu, now = new Date(), includeDone = false): Task[] {
  let filtered = includeDone ? tasks : tasks.filter((task) => !task.isDone);
  if (activeMenu === 'inbox') {
    filtered = filtered.filter((task) => task.listId === 'inbox');
  } else if (activeMenu === 'today') {
    filtered = filtered.filter((task) => Boolean(task.dueDate) && isSameDay(task.dueDate as number, now));
  } else if (activeMenu === 'next7days') {
    const today = startOfDay(now).getTime();
    const next7Days = addDays(startOfDay(now), 7).getTime();
    filtered = filtered.filter((task) => Boolean(task.dueDate) && (task.dueDate as number) >= today && (task.dueDate as number) <= next7Days);
  } else if (activeMenu.startsWith('list-')) {
    filtered = filtered.filter((task) => task.listId === activeMenu);
  } else if (activeMenu.startsWith('tag-')) {
    const tag = activeMenu.replace('tag-', '');
    filtered = filtered.filter((task) => task.tags.includes(tag));
  }
  return filtered;
}

export function getVisibleTasksForMenu(tasks: Task[], activeMenu: ActiveMenu, now = new Date()): Task[] {
  return filterTasks(tasks, activeMenu, now, true);
}

export function isTaskBlocked(task: Task, tasks: Task[]): boolean {
  if (!task.blockedBy || task.blockedBy.length === 0) return false;
  return task.blockedBy.some((id) => !tasks.find((candidate) => candidate.id === id)?.isDone);
}

export function nextRepeatDueDate(rule: RepeatRule, baseDueDate: number): number {
  const base = new Date(baseDueDate);
  if (rule.type === 'daily') return baseDueDate + rule.interval * 24 * 60 * 60 * 1000;
  if (rule.type === 'weekly') return baseDueDate + rule.interval * 7 * 24 * 60 * 60 * 1000;
  if (rule.type === 'monthly') {
    base.setMonth(base.getMonth() + rule.interval);
    return base.getTime();
  }
  if (rule.type === 'yearly') {
    base.setFullYear(base.getFullYear() + rule.interval);
    return base.getTime();
  }
  if (rule.type === 'workday') {
    let added = 0;
    while (added < rule.interval) {
      base.setDate(base.getDate() + 1);
      if (base.getDay() !== 0 && base.getDay() !== 6) added++;
    }
    return base.getTime();
  }
  return baseDueDate + Math.round(rule.interval * 29.53 * 24 * 60 * 60 * 1000);
}

export function nextEbbinghausDueDate(stage: number, baseDueDate: number): number | null {
  const intervals = [1, 2, 4, 7, 15, 30];
  if (stage >= intervals.length) return null;
  return addDays(new Date(baseDueDate), intervals[stage]).getTime();
}

export function toggleTaskDone(
  tasks: Task[],
  id: string,
  now = new Date(),
  idFactory: (prefix?: string) => string = createId
): { changed: boolean; tasks: Task[]; reason?: 'missing' | 'blocked' } {
  const task = tasks.find((item) => item.id === id);
  if (!task) return { changed: false, tasks, reason: 'missing' };
  if (!task.isDone && isTaskBlocked(task, tasks)) return { changed: false, tasks, reason: 'blocked' };

  if (!task.isDone) {
    const baseDueDate = task.dueDate || now.getTime();
    let nextDueDate: number | null = null;
    let nextStage = task.ebbinghausStage || 0;

    if (task.ebbinghaus) {
      nextDueDate = nextEbbinghausDueDate(nextStage, baseDueDate);
      nextStage += 1;
    } else if (task.repeatRule) {
      nextDueDate = nextRepeatDueDate(task.repeatRule, baseDueDate);
    }

    if (nextDueDate !== null) {
      const completedClone: Task = {
        ...task,
        id: idFactory('task'),
        isDone: true,
        repeatRule: undefined,
        ebbinghaus: false,
        updatedAt: now.getTime()
      };
      const updatedTask: Task = {
        ...task,
        dueDate: nextDueDate,
        ebbinghausStage: nextStage,
        notified: false,
        updatedAt: now.getTime()
      };
      return {
        changed: true,
        tasks: [...tasks.map((item) => (item.id === id ? updatedTask : item)), completedClone]
      };
    }
  }

  return {
    changed: true,
    tasks: tasks.map((item) => (item.id === id ? { ...item, isDone: !item.isDone, updatedAt: now.getTime() } : item))
  };
}

export function exportToObsidian(tasks: Task[]): string {
  const lines = ['# DoneBox Tasks Export', ''];
  tasks
    .filter((task) => !task.isDone)
    .forEach((task) => {
      let line = `- [ ] ${task.title}`;
      if (task.dueDate) line += ` 📅 ${format(task.dueDate, 'yyyy-MM-dd')}`;
      task.tags.forEach((tag) => {
        line += ` #${tag}`;
      });
      line += ` <!-- id: ${task.id} -->`;
      lines.push(line);
      if (task.content) {
        task.content.split('\n').forEach((contentLine) => lines.push(`    ${contentLine}`));
      }
      task.subTasks.forEach((subTask) => {
        lines.push(`    - [${subTask.isDone ? 'x' : ' '}] ${subTask.title}`);
      });
    });
  return lines.join('\n');
}

export function importFromObsidian(markdown: string, idFactory: (prefix?: string) => string = createId): Task[] {
  const tasks: Task[] = [];
  const lines = markdown.split('\n');
  let currentTask: Task | null = null;
  for (const line of lines) {
    const taskMatch = line.match(/^- \[([ x])\]\s+(.*)/i);
    if (taskMatch && !line.startsWith(' ')) {
      if (currentTask) tasks.push(currentTask);
      const isDone = taskMatch[1].toLowerCase() === 'x';
      let rest = taskMatch[2];
      let dueDate: number | null = null;
      const dateMatch = rest.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const parsedDate = new Date(dateMatch[1]);
        if (!Number.isNaN(parsedDate.getTime())) dueDate = parsedDate.getTime();
        rest = rest.replace(dateMatch[0], '').trim();
      }
      const tags: string[] = [];
      const tagRegex = /#([\w-]+)/g;
      let match: RegExpExecArray | null;
      while ((match = tagRegex.exec(rest)) !== null) tags.push(match[1]);
      rest = rest.replace(tagRegex, '').trim();
      const idMatch = rest.match(/<!--\s*id:\s*([a-zA-Z0-9-]+)\s*-->/);
      const id = idMatch ? idMatch[1] : idFactory('task');
      if (idMatch) rest = rest.replace(idMatch[0], '').trim();
      currentTask = {
        id,
        title: rest,
        isDone,
        dueDate,
        tags,
        subTasks: [],
        content: '',
        priority: 0,
        important: false,
        urgentOverride: null,
        listId: 'inbox',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    } else if (currentTask) {
      const subtaskMatch = line.match(/^\s+- \[([ x])\]\s+(.*)/i);
      if (subtaskMatch) {
        currentTask.subTasks.push({
          id: idFactory('sub'),
          title: subtaskMatch[2].trim(),
          isDone: subtaskMatch[1].toLowerCase() === 'x'
        });
      } else {
        const contentLine = line.replace(/^\s{0,4}/, '');
        currentTask.content = currentTask.content ? `${currentTask.content}\n${contentLine}` : contentLine;
      }
    }
  }
  if (currentTask) tasks.push(currentTask);
  return tasks;
}
