import { getStroke } from 'perfect-freehand';
import type { CanvasObject, Page, Stroke, View } from '../document/model';
import { objectBounds, visibleObjects, type Bounds } from './geometry';

const paths = new WeakMap<Stroke, Path2D>();
function strokePath(stroke: Stroke) {
  let path = paths.get(stroke);
  if (path) return path;
  const outline = getStroke(stroke.points, {
    size: stroke.size, thinning: stroke.pressure ? 0.65 : 0.15,
    smoothing: 0.5, streamline: stroke.smoothing, simulatePressure: !stroke.pressure,
    last: true,
  });
  path = new Path2D();
  if (outline.length) {
    path.moveTo(outline[0][0], outline[0][1]);
    for (let i = 0; i < outline.length; i++) {
      const current = outline[i], next = outline[(i + 1) % outline.length];
      path.quadraticCurveTo(current[0], current[1], (current[0] + next[0]) / 2, (current[1] + next[1]) / 2);
    }
    path.closePath();
  }
  paths.set(stroke, path);
  return path;
}
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius = 12) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius);
}
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  return text.split('\n').flatMap(paragraph => {
    const lines: string[] = []; let line = '';
    for (const word of paragraph.split(' ')) {
      if (ctx.measureText(line + word).width > width && line) { lines.push(line.trim()); line = ''; }
      line += word + ' ';
    }
    lines.push(line.trim()); return lines;
  });
}
export function drawObject(ctx: CanvasRenderingContext2D, object: CanvasObject) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (object.type === 'stroke') {
    ctx.globalAlpha = object.opacity; ctx.fillStyle = object.color; ctx.fill(strokePath(object));
  } else if (object.type === 'text') {
    ctx.fillStyle = object.color;
    ctx.font = (object.handwritten ? '500 ' : '400 ') + object.fontSize + 'px "' + (object.handwritten ? 'Caveat' : 'DM Sans') + '", sans-serif';
    ctx.textBaseline = 'top';
    object.text.split('\n').forEach((line, i) => ctx.fillText(line, object.x, object.y + i * object.fontSize * 1.4));
  } else if (object.type === 'note') {
    ctx.fillStyle = object.color;
    ctx.shadowColor = '#3d293d0c'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
    rounded(ctx, object.x, object.y, object.w, object.h, 4); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#5b4c32'; ctx.font = '500 26px "Caveat", cursive'; ctx.textBaseline = 'top';
    ctx.save(); ctx.beginPath(); ctx.rect(object.x + 16, object.y + 12, object.w - 32, object.h - 24); ctx.clip();
    wrap(ctx, object.text, object.w - 40).forEach((line, i) => ctx.fillText(line, object.x + 20, object.y + 20 + i * 32));
    ctx.restore();
  } else if (object.type === 'shape') {
    ctx.strokeStyle = object.color; ctx.lineWidth = object.size; ctx.beginPath();
    if (object.shape === 'rectangle') ctx.rect(object.x, object.y, object.w, object.h);
    else if (object.shape === 'ellipse') ctx.ellipse(object.x + object.w / 2, object.y + object.h / 2, Math.abs(object.w / 2), Math.abs(object.h / 2), 0, 0, Math.PI * 2);
    else {
      ctx.moveTo(object.x, object.y); ctx.lineTo(object.x + object.w, object.y + object.h);
      if (object.shape === 'arrow') {
        const angle = Math.atan2(object.h, object.w), size = Math.max(12, object.size * 4);
        for (const side of [-1, 1]) { ctx.moveTo(object.x + object.w, object.y + object.h); ctx.lineTo(object.x + object.w - size * Math.cos(angle + side * 0.45), object.y + object.h - size * Math.sin(angle + side * 0.45)); }
      }
    }
    ctx.stroke();
  } else drawGraph(ctx, object);
  ctx.restore();
}
function drawGraph(ctx: CanvasRenderingContext2D, graph: Extract<CanvasObject, { type: 'graph' }>) {
  const { x, y, w, h, a, curve } = graph;
  rounded(ctx, x, y, w, h, 12); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#e4dfe9'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.font = '500 12px "DM Sans", sans-serif'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#7b7285';
  ctx.fillText('FUNCTION EXPLORER', x + 22, y + 25);
  ctx.fillStyle = '#8153c7'; ctx.font = '500 23px "Caveat", cursive';
  const formula = curve === 'quadratic' ? 'y = ' + a + 'x²' : curve === 'sine' ? 'y = ' + a + ' sin(x)' : 'y = ' + a + 'x';
  ctx.fillText(formula, x + 22, y + 60);
  const left = x + 45, top = y + 100, width = w - 75, height = h - 147;
  const px = (v: number) => left + (v + 2.5) / 5 * width;
  const py = (v: number) => top + (5 - v) / 6 * height;
  ctx.save(); ctx.beginPath(); ctx.rect(left, top, width, height); ctx.clip();
  ctx.lineWidth = 1; ctx.strokeStyle = '#f0edf3';
  for (let i = -2; i <= 5; i++) {
    ctx.beginPath(); ctx.moveTo(px(i), top); ctx.lineTo(px(i), top + height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(left, py(i)); ctx.lineTo(left + width, py(i)); ctx.stroke();
  }
  ctx.strokeStyle = '#b7afc0';
  ctx.beginPath(); ctx.moveTo(px(0), top); ctx.lineTo(px(0), top + height); ctx.moveTo(left, py(0)); ctx.lineTo(left + width, py(0)); ctx.stroke();
  ctx.strokeStyle = '#9b6ade'; ctx.lineWidth = 2.8; ctx.beginPath();
  for (let i = 0; i <= 240; i++) {
    const xv = -2.5 + i / 240 * 5;
    const yv = curve === 'quadratic' ? a * xv * xv : curve === 'sine' ? a * Math.sin(xv) : a * xv;
    if (i === 0) ctx.moveTo(px(xv), py(yv)); else ctx.lineTo(px(xv), py(yv));
  }
  ctx.stroke();
  if (curve === 'quadratic') {
    ctx.strokeStyle = '#329b8d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px(-2.5), py(-6 * a)); ctx.lineTo(px(2.5), py(4 * a)); ctx.stroke();
    ctx.beginPath(); ctx.arc(px(1), py(a), 4.5, 0, Math.PI * 2); ctx.fillStyle = '#329b8d'; ctx.fill();
  }
  ctx.restore();
  ctx.font = '11px "DM Sans", sans-serif'; ctx.fillStyle = '#9b92a4';
  for (let i = -2; i <= 2; i++) ctx.fillText(String(i), px(i) - 3, top + height + 14);
  ctx.fillStyle = '#7e7588'; ctx.font = '11px "DM Sans", sans-serif';
  ctx.fillText(curve === 'quadratic' ? 'Tangent at x = 1  ·  slope = ' + (2 * a).toFixed(1) : 'Select graph to change its parameters', x + 22, y + h - 18);
}
export function drawBackground(ctx: CanvasRenderingContext2D, background: Page['background'], view: View, width: number, height: number) {
  ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, width, height);
  if (background === 'plain') return;
  const spacing = 24 * Math.max(1, Math.ceil(0.4 / view.zoom)) * view.zoom;
  const ox = ((view.x % spacing) + spacing) % spacing, oy = ((view.y % spacing) + spacing) % spacing;
  ctx.fillStyle = '#d9d3dd'; ctx.strokeStyle = '#e5dfe7'; ctx.lineWidth = 0.7;
  ctx.beginPath();
  if (background === 'dots') {
    for (let x = ox; x < width; x += spacing) for (let y = oy; y < height; y += spacing) { ctx.moveTo(x + 0.7, y); ctx.arc(x, y, 0.7, 0, Math.PI * 2); }
    ctx.fill();
  } else {
    for (let y = oy; y < height; y += spacing) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    if (background === 'grid') for (let x = ox; x < width; x += spacing) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    ctx.stroke();
  }
}
export function drawPage(ctx: CanvasRenderingContext2D, page: Page, view: View, width: number, height: number, exclude = new Set<string>()) {
  drawBackground(ctx, page.background, view, width, height);
  ctx.save(); ctx.translate(view.x, view.y); ctx.scale(view.zoom, view.zoom);
  for (const object of visibleObjects(page)) {
    if (exclude.has(object.id)) continue;
    const box = objectBounds(object);
    if ((box.x + box.w) * view.zoom + view.x < 0 || box.x * view.zoom + view.x > width || (box.y + box.h) * view.zoom + view.y < 0 || box.y * view.zoom + view.y > height) continue;
    drawObject(ctx, object);
  }
  ctx.restore();
}
export function drawSelection(ctx: CanvasRenderingContext2D, bounds: Bounds, zoom: number) {
  ctx.strokeStyle = '#8d60cd'; ctx.lineWidth = 1.3 / zoom; ctx.setLineDash([5 / zoom, 4 / zoom]);
  ctx.strokeRect(bounds.x - 6 / zoom, bounds.y - 6 / zoom, bounds.w + 12 / zoom, bounds.h + 12 / zoom);
  ctx.setLineDash([]);
}
