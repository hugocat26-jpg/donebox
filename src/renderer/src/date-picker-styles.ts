import { isSameDay, isSameMonth } from 'date-fns';

export function isDatePickerDayVisuallySelected(day: Date, value?: number | null, referenceDate = new Date()): boolean {
  return value ? isSameDay(value, day) : isSameDay(referenceDate, day);
}

export function getDatePickerDayClass(day: Date, visibleMonth: Date, selected: boolean): string {
  const classes = [
    'flex h-6 w-6 items-center justify-center rounded-full text-[12px] leading-none hover:bg-slate-100',
    !isSameMonth(day, visibleMonth) ? 'text-slate-400' : '',
    selected ? 'bg-slate-100 text-slate-700 hover:bg-slate-100' : ''
  ];

  return classes.filter(Boolean).join(' ');
}
