import { addDays, startOfDay } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { getTimelineTaskSpan, parseLocalDate } from './timeline-span';

const day = (offset = 0): Date => addDays(startOfDay(new Date(2026, 5, 10)), offset);
const dates = Array.from({ length: 14 }, (_, index) => day(index));

describe('时间线任务跨度', () => {
  it('单日任务返回单列范围', () => {
    expect(getTimelineTaskSpan({ dueDate: day(2).getTime() }, dates)).toEqual({
      startIndex: 2,
      endIndex: 2,
      isClippedStart: false,
      isClippedEnd: false
    });
  });

  it('多天任务返回连续列范围', () => {
    expect(getTimelineTaskSpan({ startDate: day(1).getTime(), dueDate: day(5).getTime() }, dates)).toEqual({
      startIndex: 1,
      endIndex: 5,
      isClippedStart: false,
      isClippedEnd: false
    });
  });

  it('startDate 缺失时按 dueDate 单日显示', () => {
    expect(getTimelineTaskSpan({ dueDate: day(4).getTime() }, dates)).toMatchObject({ startIndex: 4, endIndex: 4 });
  });

  it('startDate 晚于 dueDate 时按 dueDate 单日显示', () => {
    expect(getTimelineTaskSpan({ startDate: day(8).getTime(), dueDate: day(4).getTime() }, dates)).toMatchObject({ startIndex: 4, endIndex: 4 });
  });

  it('无 dueDate 或完全不在窗口内时返回 null', () => {
    expect(getTimelineTaskSpan({ startDate: day(1).getTime() }, dates)).toBeNull();
    expect(getTimelineTaskSpan({ startDate: day(-5).getTime(), dueDate: day(-1).getTime() }, dates)).toBeNull();
    expect(getTimelineTaskSpan({ startDate: day(14).getTime(), dueDate: day(16).getTime() }, dates)).toBeNull();
  });

  it('左右超出窗口时正确裁剪', () => {
    expect(getTimelineTaskSpan({ startDate: day(-4).getTime(), dueDate: day(3).getTime() }, dates)).toEqual({
      startIndex: 0,
      endIndex: 3,
      isClippedStart: true,
      isClippedEnd: false
    });
    expect(getTimelineTaskSpan({ startDate: day(10).getTime(), dueDate: day(20).getTime() }, dates)).toEqual({
      startIndex: 10,
      endIndex: 13,
      isClippedStart: false,
      isClippedEnd: true
    });
  });

  it('YYYY-MM-DD 字符串按本地自然日解析', () => {
    expect(parseLocalDate('2026-06-10')).toEqual(new Date(2026, 5, 10));
    expect(getTimelineTaskSpan({ startDate: '2026-06-11', dueDate: '2026-06-13' }, dates)).toMatchObject({
      startIndex: 1,
      endIndex: 3
    });
  });
});
