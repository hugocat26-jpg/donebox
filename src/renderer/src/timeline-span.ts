import { startOfDay } from 'date-fns';

type TimelineDateValue = Date | number | string | null | undefined;

export type TimelineTaskSpan = {
  startIndex: number;
  endIndex: number;
  isClippedStart: boolean;
  isClippedEnd: boolean;
};

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toLocalDayTime(value: TimelineDateValue): number | null {
  if (value === null || value === undefined) return null;
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseLocalDate(value)
    : new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return null;
  return startOfDay(date).getTime();
}

export function getTimelineTaskSpan(
  task: { startDate?: TimelineDateValue; dueDate?: TimelineDateValue },
  dates: Date[]
): TimelineTaskSpan | null {
  const dueDate = toLocalDayTime(task.dueDate);
  if (dueDate === null || dates.length === 0) return null;

  const startDate = toLocalDayTime(task.startDate);
  const effectiveStart = startDate === null || startDate > dueDate ? dueDate : startDate;
  const dayTimes = dates.map((date) => toLocalDayTime(date)).filter((time): time is number => time !== null);
  const windowStart = dayTimes[0];
  const windowEnd = dayTimes[dayTimes.length - 1];
  if (windowStart === undefined || windowEnd === undefined || dueDate < windowStart || effectiveStart > windowEnd) return null;

  const visibleStart = Math.max(effectiveStart, windowStart);
  const visibleEnd = Math.min(dueDate, windowEnd);
  const startIndex = dayTimes.findIndex((time) => time >= visibleStart);
  let endIndex = -1;
  for (let index = dayTimes.length - 1; index >= 0; index -= 1) {
    if (dayTimes[index] <= visibleEnd) {
      endIndex = index;
      break;
    }
  }
  if (startIndex < 0 || endIndex < startIndex) return null;

  return {
    startIndex,
    endIndex,
    isClippedStart: effectiveStart < windowStart,
    isClippedEnd: dueDate > windowEnd
  };
}
