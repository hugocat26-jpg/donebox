import { format, isSameDay } from 'date-fns';
import type { Priority, RepeatRule } from './types';

const priorityDetailLabels: Record<Priority, string> = {
  0: '无优先级',
  1: '低',
  2: '中',
  3: '高'
};

const repeatDetailLabels: Record<RepeatRule['type'], string> = {
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
  workday: '工作日',
  lunar: '农历'
};

export function getDetailDateLabel(value?: number | null, now = new Date()): string {
  if (!value) return '截止日期';
  if (isSameDay(value, now)) return '今天';
  return format(value, 'yyyy/M/d');
}

export function getPriorityDetailLabel(priority: Priority): string {
  return priorityDetailLabels[priority];
}

export function getRepeatDetailLabel(type?: RepeatRule['type']): string {
  return type ? repeatDetailLabels[type] : '不重复';
}
