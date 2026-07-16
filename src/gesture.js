export function bindPressZone(element, { onPress, onRelease } = {}) {
  const press = (event) => {
    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    onPress?.(event);
  };

  const release = (event) => {
    onRelease?.(event);
  };

  element.addEventListener('pointerdown', press);
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);

  return () => {
    element.removeEventListener('pointerdown', press);
    element.removeEventListener('pointerup', release);
    element.removeEventListener('pointercancel', release);
  };
}
