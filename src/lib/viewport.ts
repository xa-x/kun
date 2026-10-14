/**
 * Where the canvas opens. Fitting a long pipeline into view can shrink node
 * text past reading (a six-node flow lands near 30%), so below a readable
 * zoom the view starts at the beginning of the pipeline instead, and the Fit
 * control still gives the overview.
 */
export const READABLE_ZOOM = 0.6;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function readableViewport(
  bounds: Rect,
  size: { width: number; height: number },
  margin = 0.12,
): { x: number; y: number; zoom: number } {
  const w = Math.max(bounds.width, 1);
  const h = Math.max(bounds.height, 1);
  const fit = Math.min(
    (size.width * (1 - 2 * margin)) / w,
    (size.height * (1 - 2 * margin)) / h,
    1,
  );
  const cy = bounds.y + h / 2;
  if (fit >= READABLE_ZOOM) {
    const cx = bounds.x + w / 2;
    return {
      x: size.width / 2 - cx * fit,
      y: size.height / 2 - cy * fit,
      zoom: fit,
    };
  }
  return {
    x: 32 - bounds.x * READABLE_ZOOM,
    y: size.height / 2 - cy * READABLE_ZOOM,
    zoom: READABLE_ZOOM,
  };
}
