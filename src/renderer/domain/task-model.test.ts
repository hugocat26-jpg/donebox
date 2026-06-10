import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TAGS,
  INITIAL_LISTS,
  exportToObsidian,
  filterTasks,
  generateSampleTasks,
  getMatrixPatchForQuadrant,
  getMatrixQuadrant,
  getNextSelectedTaskId,
  getVisibleTasksForMenu,
  importFromObsidian,
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

  it('四象限拖拽能生成目标象限所需的任务字段变化', () => {
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

    const urgentPatch = getMatrixPatchForQuadrant(baseTask, 'important-urgent', now);
    expect(getMatrixQuadrant({ ...baseTask, ...urgentPatch }, now)).toBe('important-urgent');
    expect(urgentPatch.priority).toBe(3);
    expect(urgentPatch.dueDate).toBe(noon());

    const urgentSourceTask: Task = { ...baseTask, dueDate: noon(), priority: 3 };
    const plannedPatch = getMatrixPatchForQuadrant(urgentSourceTask, 'important-not-urgent', now);
    expect(getMatrixQuadrant({ ...urgentSourceTask, ...plannedPatch }, now)).toBe('important-not-urgent');
    expect(plannedPatch.priority).toBe(2);
    expect(plannedPatch.dueDate).toBeNull();

    const lowUrgentPatch = getMatrixPatchForQuadrant(baseTask, 'not-important-urgent', now);
    expect(getMatrixQuadrant({ ...baseTask, ...lowUrgentPatch }, now)).toBe('not-important-urgent');
    expect(lowUrgentPatch.priority).toBe(1);
  });
});
