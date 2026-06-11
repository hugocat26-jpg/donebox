export type DetailOutsideMouseEvent = {
  button: number;
  target: EventTarget | null;
};

function closestFromTarget(target: EventTarget | null, selector: string): Element | null {
  const maybeElement = target as { closest?: unknown } | null;
  if (typeof maybeElement?.closest !== 'function') return null;
  return maybeElement.closest(selector) as Element | null;
}

export function shouldCloseDetailFromOutsideClick(event: DetailOutsideMouseEvent): boolean {
  if (event.button !== 0) return false;
  if (closestFromTarget(event.target, '[data-testid="task-detail-panel"]')) return false;
  if (closestFromTarget(event.target, '[data-task-id]')) return false;
  return true;
}
