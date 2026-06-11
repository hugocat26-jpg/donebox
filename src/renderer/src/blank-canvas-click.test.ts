import { describe, expect, it } from 'vitest';
import { shouldCloseDetailFromOutsideClick } from './blank-canvas-click';

function targetWithClosest(matchSelector: string | null): EventTarget {
  return {
    closest(selector: string) {
      return selector === matchSelector ? ({} as Element) : null;
    }
  } as unknown as EventTarget;
}

describe('任务详情外部点击', () => {
  it('左键点击详情栏外非任务区域时关闭详情', () => {
    expect(shouldCloseDetailFromOutsideClick({ button: 0, target: targetWithClosest(null) })).toBe(true);
  });

  it('点击详情栏内部时不关闭详情', () => {
    expect(shouldCloseDetailFromOutsideClick({ button: 0, target: targetWithClosest('[data-testid="task-detail-panel"]') })).toBe(false);
  });

  it('点击任务事项时不由外部点击逻辑关闭详情', () => {
    expect(shouldCloseDetailFromOutsideClick({ button: 0, target: targetWithClosest('[data-task-id]') })).toBe(false);
  });

  it('非左键点击不关闭详情', () => {
    expect(shouldCloseDetailFromOutsideClick({ button: 2, target: targetWithClosest(null) })).toBe(false);
  });
});
