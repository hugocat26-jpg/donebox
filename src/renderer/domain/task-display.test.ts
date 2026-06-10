import { describe, expect, it } from 'vitest';
import { getDetailDateLabel, getPriorityDetailLabel, getRepeatDetailLabel } from './task-display';

describe('DoneBox 任务详情显示文案', () => {
  it('详情日期显示原版文案且不暴露原生日期输入占位', () => {
    const today = new Date('2026-06-10T09:00:00');
    const nextDay = new Date('2026-06-11T12:00:00').getTime();

    expect(getDetailDateLabel(null, today)).toBe('日期');
    expect(getDetailDateLabel(today.getTime(), today)).toBe('今天');
    expect(getDetailDateLabel(nextDay, today)).toBe('2026/6/11');
  });

  it('详情优先级显示原版短文案', () => {
    expect(getPriorityDetailLabel(0)).toBe('无优先级');
    expect(getPriorityDetailLabel(1)).toBe('低');
    expect(getPriorityDetailLabel(2)).toBe('中');
    expect(getPriorityDetailLabel(3)).toBe('高');
  });

  it('详情重复显示原版下拉文案', () => {
    expect(getRepeatDetailLabel(undefined)).toBe('不重复');
    expect(getRepeatDetailLabel('daily')).toBe('每天');
    expect(getRepeatDetailLabel('weekly')).toBe('每周');
    expect(getRepeatDetailLabel('monthly')).toBe('每月');
    expect(getRepeatDetailLabel('yearly')).toBe('每年');
    expect(getRepeatDetailLabel('workday')).toBe('工作日');
    expect(getRepeatDetailLabel('lunar')).toBe('农历');
  });
});
