import { describe, expect, it } from 'vitest';
import { getDatePickerDayClass, isDatePickerDayVisuallySelected } from './date-picker-styles';

describe('日期选择器视觉状态', () => {
  const today = new Date('2026-06-11T09:00:00');
  const selectedValue = new Date('2026-06-15T12:00:00').getTime();

  it('没有实际日期值时视觉选中当天，但不需要写入值', () => {
    expect(isDatePickerDayVisuallySelected(new Date('2026-06-11T00:00:00'), null, today)).toBe(true);
    expect(isDatePickerDayVisuallySelected(new Date('2026-06-12T00:00:00'), null, today)).toBe(false);
  });

  it('已有实际日期值时只视觉选中该日期，不额外选中当天', () => {
    expect(isDatePickerDayVisuallySelected(new Date('2026-06-15T00:00:00'), selectedValue, today)).toBe(true);
    expect(isDatePickerDayVisuallySelected(new Date('2026-06-11T00:00:00'), selectedValue, today)).toBe(false);
  });

  it('日期格 hover 和选中态使用圆形样式', () => {
    const day = new Date('2026-06-11T00:00:00');
    const visibleMonth = new Date('2026-06-01T00:00:00');
    const className = getDatePickerDayClass(day, visibleMonth, true);

    expect(className).toContain('rounded-full');
    expect(className).not.toContain('rounded-[2px]');
    expect(className).toContain('hover:bg-slate-100');
    expect(className).toContain('bg-slate-100');
  });
});
