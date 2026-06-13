import { describe, expect, it } from 'vitest';
import {
  CUSTOM_TAGS_KEY,
  DEFAULT_TAGS,
  INITIAL_LISTS,
  LISTS_KEY,
  TASKS_KEY,
  exportToObsidian,
  filterTasks,
  generateSampleTasks,
  getMatrixPatchForQuadrant,
  getMatrixQuadrant,
  getNextMatrixSortOrder,
  getNextSelectedTaskId,
  getVisibleTasksForMenu,
  importFromObsidian,
  normalizeTaskForMatrix,
  resolveTaskUrgency,
  sortMatrixTasks,
  toggleTaskDone
} from './task-model';
import type { Task } from './types';

const noon = (offset = 0) => {
  const date = new Date('2026-06-10T12:00:00');
  date.setDate(date.getDate() + offset);
  return date.getTime();
};

describe('DoneBox 任务领域模型', () => {
  it('保留默认清单和默认标签契约', () => {
    expect(INITIAL_LISTS).toEqual([
      { id: 'list-work', label: '工作', color: 'bg-blue-400' },
      { id: 'list-personal', label: '个人', color: 'bg-green-400' }
    ]);
    expect(DEFAULT_TAGS).toEqual(['urgent', 'reading']);
  });

  it('保护本地存储 key 契约', () => {
    expect(TASKS_KEY).toBe('tasks_list');
    expect(LISTS_KEY).toBe('custom_lists');
    expect(CUSTOM_TAGS_KEY).toBe('custom_tags');
  });

  it('生成原应用可见的首次启动示例任务', () => {
    const tasks = generateSampleTasks(new Date('2026-06-10T09:00:00'));
    expect(tasks[0].title).toBe('👋 欢迎使用 DoneBox');
    expect(tasks.some((task) => task.title === '配置 Obsidian 同步目录')).toBe(true);
    expect(tasks.some((task) => task.title === '导出本周任务到 Obsidian' && task.blockedBy?.length === 1)).toBe(true);
    expect(tasks.some((task) => task.title === '阅读《代码整洁之道》第一章' && task.ebbinghaus)).toBe(true);
  });

  it('按左侧菜单过滤任务且默认隐藏已完成任务', () => {
    const tasks: Task[] = [
      { id: 'a', title: '收件箱', listId: 'inbox', isDone: false, tags: [], subTasks: [], priority: 0, createdAt: 1, updatedAt: 1 },
      { id: 'b', title: '今天', listId: 'list-work', isDone: false, dueDate: noon(), tags: ['urgent'], subTasks: [], priority: 1, createdAt: 1, updatedAt: 1 },
      { id: 'c', title: '明天', listId: 'list-personal', isDone: false, dueDate: noon(1), tags: ['reading'], subTasks: [], priority: 2, createdAt: 1, updatedAt: 1 },
      { id: 'd', title: '完成', listId: 'inbox', isDone: true, dueDate: noon(), tags: ['urgent'], subTasks: [], priority: 3, createdAt: 1, updatedAt: 1 }
    ];

    expect(filterTasks(tasks, 'inbox').map((task) => task.id)).toEqual(['a']);
    expect(filterTasks(tasks, 'today', new Date('2026-06-10T08:00:00')).map((task) => task.id)).toEqual(['b']);
    expect(filterTasks(tasks, 'next7days', new Date('2026-06-10T08:00:00')).map((task) => task.id)).toEqual(['b', 'c']);
    expect(filterTasks(tasks, 'list-personal').map((task) => task.id)).toEqual(['c']);
    expect(filterTasks(tasks, 'tag-urgent').map((task) => task.id)).toEqual(['b']);
    expect(filterTasks(tasks, 'tag-urgent', new Date('2026-06-10T08:00:00'), true).map((task) => task.id)).toEqual(['b', 'd']);
    expect(getVisibleTasksForMenu(tasks, 'today', new Date('2026-06-10T08:00:00')).map((task) => task.id)).toEqual(['b', 'd']);
  });

  it('同一任务二次点击会关闭详情，点击不同任务会切换详情', () => {
    expect(getNextSelectedTaskId(null, 'a')).toBe('a');
    expect(getNextSelectedTaskId('a', 'a')).toBeNull();
    expect(getNextSelectedTaskId('a', 'b')).toBe('b');
  });

  it('前置任务未完成时阻止完成，被允许后推进重复任务并保留完成副本', () => {
    const tasks: Task[] = [
      { id: 'a', title: '前置', listId: 'inbox', isDone: false, tags: [], subTasks: [], priority: 0, createdAt: 1, updatedAt: 1 },
      { id: 'b', title: '被阻塞', listId: 'inbox', isDone: false, tags: [], subTasks: [], priority: 0, blockedBy: ['a'], createdAt: 1, updatedAt: 1 },
      { id: 'c', title: '每日', listId: 'inbox', isDone: false, dueDate: noon(), tags: [], subTasks: [], priority: 0, repeatRule: { type: 'daily', interval: 1 }, createdAt: 1, updatedAt: 1 }
    ];

    const blocked = toggleTaskDone(tasks, 'b', new Date('2026-06-10T09:00:00'), () => 'copy');
    expect(blocked.changed).toBe(false);
    expect(blocked.reason).toBe('blocked');

    const repeated = toggleTaskDone(tasks, 'c', new Date('2026-06-10T09:00:00'), () => 'copy');
    expect(repeated.changed).toBe(true);
    expect(repeated.tasks.find((task) => task.id === 'c')?.dueDate).toBe(noon(1));
    expect(repeated.tasks.find((task) => task.id === 'copy')?.isDone).toBe(true);
  });

  it('Obsidian Markdown 导入导出保持任务、日期、标签和子任务', () => {
    const markdown = exportToObsidian([
      {
        id: 'task-1',
        title: '导出任务',
        content: '正文',
        listId: 'inbox',
        isDone: false,
        dueDate: new Date('2026-06-10T00:00:00').getTime(),
        tags: ['urgent'],
        subTasks: [{ id: 'sub-1', title: '子任务', isDone: true }],
        priority: 0,
        createdAt: 1,
        updatedAt: 1
      }
    ]);

    expect(markdown).toContain('- [ ] 导出任务 📅 2026-06-10 #urgent <!-- id: task-1 -->');
    expect(markdown).toContain('    - [x] 子任务');

    const imported = importFromObsidian(markdown, () => 'sub-new');
    expect(imported[0]).toMatchObject({
      id: 'task-1',
      title: '导出任务',
      listId: 'inbox',
      isDone: false,
      tags: ['urgent'],
      content: '正文'
    });
    expect(imported[0].subTasks[0]).toMatchObject({ id: 'sub-new', title: '子任务', isDone: true });
  });

  it('旧数据按 priority 完整归一化到原四象限', () => {
    const baseTask: Task = {
      id: 'matrix-legacy',
      title: '矩阵任务',
      listId: 'inbox',
      isDone: false,
      dueDate: noon(5),
      tags: [],
      subTasks: [],
      priority: 0,
      createdAt: 1,
      updatedAt: 1
    };
    const now = new Date('2026-06-10T09:00:00');

    expect(getMatrixQuadrant({ ...baseTask, priority: 3 }, now)).toBe('important-urgent');
    expect(getMatrixQuadrant({ ...baseTask, priority: 2 }, now)).toBe('important-not-urgent');
    expect(getMatrixQuadrant({ ...baseTask, priority: 1 }, now)).toBe('not-important-urgent');
    expect(getMatrixQuadrant({ ...baseTask, priority: 0 }, now)).toBe('not-important-not-urgent');
    expect(normalizeTaskForMatrix({ ...baseTask, priority: 2 })).toMatchObject({ important: true, urgentOverride: false });
    expect(baseTask).not.toHaveProperty('important');
  });

  it('urgentOverride 覆盖日期，null 时按 dueDate 自动判断紧急性', () => {
    const baseTask: Task = {
      id: 'matrix-1',
      title: '矩阵任务',
      listId: 'inbox',
      isDone: false,
      dueDate: noon(5),
      tags: [],
      subTasks: [],
      priority: 0,
      createdAt: 1,
      updatedAt: 1
    };
    const now = new Date('2026-06-10T09:00:00');

    expect(resolveTaskUrgency({ ...baseTask, urgentOverride: true }, now)).toBe(true);
    expect(resolveTaskUrgency({ ...baseTask, urgentOverride: false, dueDate: noon() }, now)).toBe(false);
    expect(resolveTaskUrgency({ ...baseTask, urgentOverride: null, dueDate: noon(-1) }, now)).toBe(true);
    expect(resolveTaskUrgency({ ...baseTask, urgentOverride: null, dueDate: noon() }, now)).toBe(true);
    expect(resolveTaskUrgency({ ...baseTask, urgentOverride: null, dueDate: noon(1) }, now)).toBe(true);
    expect(resolveTaskUrgency({ ...baseTask, urgentOverride: null, dueDate: noon(2) }, now)).toBe(false);
    expect(resolveTaskUrgency({ ...baseTask, urgentOverride: null, dueDate: null, startDate: noon(-1) }, now)).toBe(false);
  });

  it('四象限拖拽 patch 只写象限字段和目标象限内 sortOrder', () => {
    const baseTask: Task = {
      id: 'matrix-1',
      title: '矩阵任务',
      listId: 'inbox',
      isDone: false,
      dueDate: noon(5),
      startDate: noon(-1),
      tags: [],
      subTasks: [],
      priority: 3,
      important: true,
      urgentOverride: true,
      sortOrder: 10,
      createdAt: 1,
      updatedAt: 1
    };
    const targetTasks: Task[] = [
      { ...baseTask, id: 'target-a', priority: 2, important: true, urgentOverride: false, sortOrder: 1000, createdAt: 2 },
      { ...baseTask, id: 'target-b', priority: 1, important: true, urgentOverride: false, sortOrder: 2000, createdAt: 3 }
    ];

    const patch = getMatrixPatchForQuadrant(baseTask, 'important-not-urgent', targetTasks, 'target-b');

    expect(patch).toEqual({ important: true, urgentOverride: false, sortOrder: 1500 });
    expect(patch).not.toHaveProperty('priority');
    expect(patch).not.toHaveProperty('dueDate');
    expect(patch).not.toHaveProperty('startDate');
    expect(getMatrixQuadrant({ ...baseTask, ...patch }, new Date('2026-06-10T09:00:00'))).toBe('important-not-urgent');
  });

  it('四象限排序稳定且重要不紧急优先于紧急不重要', () => {
    const now = new Date('2026-06-10T09:00:00');
    const tasks: Task[] = [
      { id: 'later', title: '无顺序低优先', listId: 'inbox', isDone: false, dueDate: noon(2), tags: [], subTasks: [], priority: 0, important: true, urgentOverride: false, createdAt: 4, updatedAt: 4 },
      { id: 'urgent-low', title: '紧急不重要', listId: 'inbox', isDone: false, dueDate: noon(), tags: [], subTasks: [], priority: 3, important: false, urgentOverride: true, createdAt: 1, updatedAt: 1 },
      { id: 'manual-b', title: '手动顺序后', listId: 'inbox', isDone: false, dueDate: noon(5), tags: [], subTasks: [], priority: 0, important: true, urgentOverride: false, sortOrder: 2000, createdAt: 3, updatedAt: 3 },
      { id: 'manual-a', title: '手动顺序前', listId: 'inbox', isDone: false, dueDate: noon(5), tags: [], subTasks: [], priority: 0, important: true, urgentOverride: false, sortOrder: 1000, createdAt: 2, updatedAt: 2 },
      { id: 'high', title: '无顺序高优先', listId: 'inbox', isDone: false, dueDate: noon(3), tags: [], subTasks: [], priority: 3, important: true, urgentOverride: false, createdAt: 5, updatedAt: 5 }
    ];

    expect(sortMatrixTasks(tasks, now).map((task) => task.id)).toEqual(['manual-a', 'manual-b', 'high', 'later', 'urgent-low']);
    expect(getNextMatrixSortOrder(tasks.filter((task) => task.important), 'manual-b', now)).toBe(1500);
  });
});
