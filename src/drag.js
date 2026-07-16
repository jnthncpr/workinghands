// Generic pointer-drag tracking: reports movement deltas relative to the
// drag's start and a final delta on release. This owns no visual movement
// or drop-zone logic — callers decide what "dragging" looks like and what
// counts as a valid drop.
export function bindDraggable(element, { onDragStart, onDragMove, onDragEnd } = {}) {
  let active = false;
  let startX = 0;
  let startY = 0;

  const press = (event) => {
    active = true;
    startX = event.clientX;
    startY = event.clientY;
    element.setPointerCapture(event.pointerId);
    onDragStart?.(event);
  };

  const move = (event) => {
    if (!active) return;
    onDragMove?.(event, event.clientX - startX, event.clientY - startY);
  };

  const release = (event) => {
    if (!active) return;
    active = false;
    onDragEnd?.(event, event.clientX - startX, event.clientY - startY);
  };

  element.addEventListener('pointerdown', press);
  element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);

  return () => {
    element.removeEventListener('pointerdown', press);
    element.removeEventListener('pointermove', move);
    element.removeEventListener('pointerup', release);
    element.removeEventListener('pointercancel', release);
  };
}
