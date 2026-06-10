import { describe, expect, it } from 'vitest';
import {
  collapsedSidebarStyles,
  getCollapsedSidebarButtonClass,
  getSidebarSectionClass,
  shouldRenderSidebarBrand
} from './sidebar-styles';

describe('折叠侧栏样式契约', () => {
  it('折叠态侧栏宽度和导航间距贴近原版窄栏', () => {
    expect(collapsedSidebarStyles.aside).toContain('w-[60px]');
    expect(collapsedSidebarStyles.nav).toContain('pt-[104px]');
    expect(collapsedSidebarStyles.nav).toContain('px-1.5');
    expect(collapsedSidebarStyles.nav).not.toContain('mt-8');
    expect(collapsedSidebarStyles.nav).not.toContain('mt-7');
  });

  it('展开按钮居中且为小方形浅灰按钮', () => {
    expect(collapsedSidebarStyles.toggleButton).toContain('left-1/2');
    expect(collapsedSidebarStyles.toggleButton).toContain('top-[52px]');
    expect(collapsedSidebarStyles.toggleButton).toContain('-translate-x-1/2');
    expect(collapsedSidebarStyles.toggleButton).toContain('h-7');
    expect(collapsedSidebarStyles.toggleButton).toContain('w-7');
    expect(collapsedSidebarStyles.toggleButton).toContain('bg-slate-200/70');
  });

  it('折叠态不渲染侧栏品牌区，展开态保留品牌区', () => {
    expect(shouldRenderSidebarBrand(true)).toBe(false);
    expect(shouldRenderSidebarBrand(false)).toBe(true);
  });

  it('折叠态菜单项使用窄 pill，选中态仍保持白色图标或圆点', () => {
    const inactive = getCollapsedSidebarButtonClass(false);
    const active = getCollapsedSidebarButtonClass(true);

    expect(inactive).toContain('w-[44px]');
    expect(inactive).toContain('h-8');
    expect(inactive).not.toContain('w-full');
    expect(active).toContain('bg-blue-500');
    expect(active).toContain('shadow-sm');
  });

  it('折叠态分组间距压缩，不沿用展开态大分组间距', () => {
    expect(getSidebarSectionClass(true)).toContain('mt-3');
    expect(getSidebarSectionClass(true)).not.toContain('mt-8');
    expect(getSidebarSectionClass(false)).toContain('mt-8');
  });
});
