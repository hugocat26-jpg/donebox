export const collapsedSidebarStyles = {
  aside: 'w-[60px]',
  toggleButton:
    'absolute left-1/2 top-[52px] flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-[7px] bg-slate-200/70 p-0 text-slate-500 opacity-100 transition-colors hover:bg-slate-200',
  nav: 'pt-[104px] px-1.5',
  settingsButton:
    'mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-[8px] px-0 py-0 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800'
} as const;

export function shouldRenderSidebarBrand(collapsed: boolean): boolean {
  return !collapsed;
}

export function getSidebarSectionClass(collapsed: boolean): string {
  return collapsed ? 'group mt-3' : 'group mt-8';
}

export function getSidebarButtonClass(collapsed: boolean, active: boolean): string {
  const state = active ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-200/70';

  if (collapsed) {
    return `group mx-auto mb-1 flex h-8 w-[44px] items-center justify-center rounded-[8px] px-0 text-left text-[15px] transition-colors ${state}`;
  }

  return `group mb-1 flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[15px] transition-colors ${state}`;
}

export function getCollapsedSidebarButtonClass(active: boolean): string {
  return getSidebarButtonClass(true, active);
}
