import type { CanvasObject, Page, Point, View } from '../document/model';
export type Bounds = { x: number; y: number; w: number; h: number };
export const screenToWorld = (x: number, y: number, view: View) => ({ x: (x - view.x) / view.zoom, y: (y - view.y) / view.zoom });
export function zoomAt(view: View, x: number, y: number, zoom: number): View {
  const world = screenToWorld(x, y, view);
  zoom = Math.max(0.15, Math.min(4, zoom));
  return { x: x - world.x * zoom, y: y - world.y * zoom, zoom };
}
export function objectBounds(object: CanvasObject): Bounds {
  if (object.type === 'stroke') {
    let x = Infinity, y = Infinity, right = -Infinity, bottom = -Infinity;
    for (const point of object.points) { x = Math.min(x, point[0]); y = Math.min(y, point[1]); right = Math.max(right, point[0]); bottom = Math.max(bottom, point[1]); }
    return { x: x - object.size, y: y - object.size, w: right - x + object.size * 2, h: bottom - y + object.size * 2 };
  }
  if (object.type === 'text') {
    const lines = object.text.split('\n');
    return { x: object.x, y: object.y, w: Math.max(...lines.map(l => l.length), 1) * object.fontSize * 0.65, h: lines.length * object.fontSize * 1.4 };
  }
  return { x: Math.min(object.x, object.x + object.w), y: Math.min(object.y, object.y + object.h), w: Math.abs(object.w), h: Math.abs(object.h) };
}
export function contains(b: Bounds, x: number, y: number, padding = 0) {
  return x >= b.x - padding && x <= b.x + b.w + padding && y >= b.y - padding && y <= b.y + b.h + padding;
}
export function visibleObjects(page: Page) {
  return page.layers.flatMap(l => l.visible ? page.objects.filter(o => o.layerId === l.id) : []);
}
export function editableObjects(page: Page) {
  return visibleObjects(page).filter(o => !page.layers.find(l => l.id === o.layerId)?.locked);
}
export function pageBounds(page: Page, margin = 48): Bounds {
  const objects = visibleObjects(page);
  if (!objects.length) return { x: 0, y: 0, w: 1000, h: 760 };
  const boxes = objects.map(objectBounds);
  const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
  return { x: x - margin, y: y - margin, w: Math.max(...boxes.map(b => b.x + b.w)) - x + margin * 2, h: Math.max(...boxes.map(b => b.y + b.h)) - y + margin * 2 };
}
export function fitView(page: Page, width: number, height: number): View {
  const bounds = pageBounds(page, 60);
  const zoom = Math.max(0.15, Math.min(1.1, width / bounds.w, height / bounds.h));
  return { x: (width - bounds.w * zoom) / 2 - bounds.x * zoom, y: (height - bounds.h * zoom) / 2 - bounds.y * zoom, zoom };
}
export function distanceToSegment(x: number, y: number, a: Point, b: Point) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
export function hitsStroke(object: CanvasObject, x: number, y: number, radius: number): boolean {
  if (object.type !== 'stroke' || !contains(objectBounds(object), x, y, radius)) return false;
  const points = object.points;
  if (points.length === 1) return Math.hypot(points[0][0] - x, points[0][1] - y) <= radius + object.size;
  return points.some((point, i) => i > 0 && distanceToSegment(x, y, points[i - 1], point) <= radius + object.size / 2);
}
