import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { uid, translateObject, type CanvasObject, type Page, type PenSettings, type Point, type Stroke, type Tool, type View } from '../document/model';
import { contains, editableObjects, hitsStroke, objectBounds, screenToWorld, zoomAt } from './geometry';
import { drawObject, drawPage, drawSelection } from './render';

type Props = {
  page: Page; tool: Tool; settings: PenSettings; layerId: string; view: View;
  setView: Dispatch<SetStateAction<View>>; selection: string | null;
  onSelect: (id: string | null) => void; onCommit: (update: (page: Page) => Page) => void;
  onText: (x: number, y: number) => void; onNotice: (message: string) => void;
  onSize: (width: number, height: number) => void; onPointer: (type: string) => void;
};
type Gesture =
  | { kind: 'stroke'; pointer: number; object: Stroke }
  | { kind: 'shape'; pointer: number; object: Extract<CanvasObject, { type: 'shape' }> }
  | { kind: 'pan'; pointer: number; x: number; y: number }
  | { kind: 'erase'; pointer: number; ids: Set<string> }
  | { kind: 'move'; pointer: number; object: CanvasObject; x: number; y: number; dx: number; dy: number };

export function Canvas(props: Props) {
  const container = useRef<HTMLDivElement>(null), base = useRef<HTMLCanvasElement>(null), overlay = useRef<HTMLCanvasElement>(null);
  const live = useRef(props); live.current = props;
  const [grabbing, setGrabbing] = useState(false);
  const redraw = useRef<() => void>(() => {});
  const cancel = useRef<() => void>(() => {});

  useEffect(() => {
    const host = container.current!, paper = base.current!, active = overlay.current!;
    let width = host.clientWidth, height = host.clientHeight, dpr = window.devicePixelRatio || 1;
    let frame = 0, dirtyBase = true, gesture: Gesture | null = null, space = false;
    const touches = new Map<number, { x: number; y: number }>();
    let pinch: { x: number; y: number; distance: number } | null = null;
    function schedule(full = false) {
      dirtyBase ||= full;
      if (!frame) frame = requestAnimationFrame(render);
    }
    function render() {
      frame = 0;
      const p = live.current, ctx = paper.getContext('2d')!, top = active.getContext('2d')!;
      if (dirtyBase) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const exclude = gesture?.kind === 'erase' ? gesture.ids : gesture?.kind === 'move' ? new Set([gesture.object.id]) : new Set<string>();
        drawPage(ctx, p.page, p.view, width, height, exclude); dirtyBase = false;
      }
      top.setTransform(dpr, 0, 0, dpr, 0, 0); top.clearRect(0, 0, width, height);
      top.save(); top.translate(p.view.x, p.view.y); top.scale(p.view.zoom, p.view.zoom);
      if (gesture?.kind === 'stroke' || gesture?.kind === 'shape') drawObject(top, gesture.object);
      let selected = editableObjects(p.page).find(o => o.id === p.selection);
      if (gesture?.kind === 'move') { selected = translateObject(gesture.object, gesture.dx, gesture.dy); drawObject(top, selected); }
      if (selected && p.tool === 'select') drawSelection(top, objectBounds(selected), p.view.zoom);
      top.restore();
    }
    function resize() {
      width = host.clientWidth; height = host.clientHeight; dpr = Math.min(window.devicePixelRatio || 1, 3);
      for (const canvas of [paper, active]) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
      live.current.onSize(width, height); schedule(true);
    }
    function local(event: PointerEvent | WheelEvent) {
      const rect = host.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    function world(event: PointerEvent) { const pos = local(event); return screenToWorld(pos.x, pos.y, live.current.view); }
    function pressure(event: PointerEvent) { return event.pointerType === 'pen' ? Math.max(0.05, event.pressure || 0.1) : 0.5; }
    function clear() { gesture = null; setGrabbing(false); schedule(true); }
    function touchState() {
      const [a, b] = [...touches.values()];
      return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) } : null;
    }
    function eraseAt(event: PointerEvent, ids: Set<string>) {
      const pos = world(event);
      for (const object of editableObjects(live.current.page)) if (hitsStroke(object, pos.x, pos.y, 10 / live.current.view.zoom)) ids.add(object.id);
      schedule(true);
    }
    function down(event: PointerEvent) {
      if (event.button > 1 && !(event.pointerType === 'pen' && event.button === 5)) return;
      const p = live.current, pos = local(event), point = world(event);
      if (event.pointerType === 'touch') {
        if (gesture && gesture.kind !== 'pan') return;
        touches.set(event.pointerId, pos); pinch = touchState();
        host.setPointerCapture(event.pointerId);
        if (pinch) { clear(); return; }
      } else if (gesture) return;
      event.preventDefault(); host.focus({ preventScroll: true }); host.setPointerCapture(event.pointerId);
      p.onPointer(event.pointerType);
      if (space || p.tool === 'hand' || event.button === 1 || event.pointerType === 'touch') {
        gesture = { kind: 'pan', pointer: event.pointerId, x: pos.x, y: pos.y }; setGrabbing(true); return;
      }
      if (p.settings.penOnly && event.pointerType !== 'pen' && p.tool !== 'select') { p.onNotice('Pen-only mode is on. Turn it off in Pen settings to draw with a mouse.'); return; }
      if (p.tool === 'select') {
        const object = editableObjects(p.page).reverse().find(o => contains(objectBounds(o), point.x, point.y, 5 / p.view.zoom));
        p.onSelect(object?.id ?? null);
        if (object) { gesture = { kind: 'move', pointer: event.pointerId, object, x: point.x, y: point.y, dx: 0, dy: 0 }; schedule(true); }
        return;
      }
      if (p.tool === 'eraser' || event.button === 5) {
        gesture = { kind: 'erase', pointer: event.pointerId, ids: new Set() }; eraseAt(event, gesture.ids); return;
      }
      const layer = p.page.layers.find(l => l.id === p.layerId);
      if (!layer || layer.locked || !layer.visible) { p.onNotice('Choose a visible, unlocked layer before writing.'); return; }
      if (p.tool === 'text') { p.onText(point.x, point.y); return; }
      if (p.tool === 'pen' || p.tool === 'highlighter') {
        gesture = { kind: 'stroke', pointer: event.pointerId, object: {
          id: uid(), layerId: p.layerId, type: 'stroke', color: p.settings.color,
          points: [[point.x, point.y, pressure(event)]], size: p.tool === 'highlighter' ? p.settings.size * 5 + 10 : p.settings.size,
          opacity: p.tool === 'highlighter' ? 0.3 : 1, pressure: p.settings.pressure && event.pointerType === 'pen', smoothing: p.settings.smoothing,
        } }; p.onSelect(null); schedule();
      } else {
        gesture = { kind: 'shape', pointer: event.pointerId, object: { id: uid(), layerId: p.layerId, type: 'shape', shape: p.tool, x: point.x, y: point.y, w: 0, h: 0, color: p.settings.color, size: p.settings.size } };
        schedule();
      }
    }
    function move(event: PointerEvent) {
      const pos = local(event);
      if (touches.has(event.pointerId)) {
        touches.set(event.pointerId, pos);
        const next = touchState();
        if (pinch && next) {
          const previous = pinch;
          live.current.setView(v => { const scaled = zoomAt(v, previous.x, previous.y, v.zoom * next.distance / previous.distance); return { ...scaled, x: scaled.x + next.x - previous.x, y: scaled.y + next.y - previous.y }; });
          pinch = next; return;
        }
      }
      if (!gesture || gesture.pointer !== event.pointerId) return;
      if (gesture.kind === 'pan') {
        const dx = pos.x - gesture.x, dy = pos.y - gesture.y;
        gesture.x = pos.x; gesture.y = pos.y;
        live.current.setView(v => ({ ...v, x: v.x + dx, y: v.y + dy })); return;
      }
      if (gesture.kind === 'stroke') {
        const events = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
        const points: Point[] = [...gesture.object.points];
        for (const sample of events.length ? events : [event]) {
          const point = world(sample), last = points.at(-1)!;
          if (Math.hypot(point.x - last[0], point.y - last[1]) > 0.1 && points.length < 40000) points.push([point.x, point.y, pressure(sample)]);
        }
        gesture.object = { ...gesture.object, points }; schedule();
      } else if (gesture.kind === 'shape') {
        const point = world(event); gesture.object = { ...gesture.object, w: point.x - gesture.object.x, h: point.y - gesture.object.y }; schedule();
      } else if (gesture.kind === 'erase') {
        const samples = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
        for (const sample of samples.length ? samples : [event]) eraseAt(sample, gesture.ids);
      } else {
        const point = world(event); gesture.dx = point.x - gesture.x; gesture.dy = point.y - gesture.y; schedule();
      }
    }
    function up(event: PointerEvent) {
      if (touches.has(event.pointerId)) {
        touches.delete(event.pointerId); pinch = null;
        if (touches.size) {
          const [pointer, pos] = [...touches.entries()][0];
          gesture = { kind: 'pan', pointer, x: pos.x, y: pos.y }; return;
        }
      }
      if (!gesture || gesture.pointer !== event.pointerId) return;
      move(event);
      const finished = gesture;
      clear();
      if (finished.kind === 'stroke' || finished.kind === 'shape') {
        if (finished.kind === 'shape' && Math.hypot(finished.object.w, finished.object.h) < 2) return;
        live.current.onCommit(page => ({ ...page, objects: [...page.objects, finished.object] }));
      } else if (finished.kind === 'erase' && finished.ids.size) {
        live.current.onCommit(page => ({ ...page, objects: page.objects.filter(o => !finished.ids.has(o.id)) }));
      } else if (finished.kind === 'move' && (Math.abs(finished.dx) + Math.abs(finished.dy) > 0.5)) {
        live.current.onCommit(page => ({ ...page, objects: page.objects.map(o => o.id === finished.object.id ? translateObject(o, finished.dx, finished.dy) : o) }));
      }
    }
    function cancelled(event: PointerEvent) {
      touches.delete(event.pointerId); pinch = null;
      if (gesture?.pointer === event.pointerId) clear();
    }
    function wheel(event: WheelEvent) {
      event.preventDefault();
      if (gesture) return;
      const point = local(event);
      if (event.ctrlKey || event.metaKey) live.current.setView(v => zoomAt(v, point.x, point.y, v.zoom * Math.exp(-event.deltaY * 0.003)));
      else live.current.setView(v => ({ ...v, x: v.x - event.deltaX - (event.shiftKey ? event.deltaY : 0), y: v.y - (event.shiftKey ? 0 : event.deltaY) }));
    }
    function keydown(event: KeyboardEvent) { if (event.code === 'Space' && !isInput(event.target)) { space = true; event.preventDefault(); } }
    function keyup(event: KeyboardEvent) { if (event.code === 'Space') space = false; }
    function blur() { space = false; touches.clear(); pinch = null; clear(); }
    redraw.current = () => schedule(true); cancel.current = clear;
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); resize();
    host.addEventListener('pointerdown', down); host.addEventListener('pointermove', move); host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', cancelled); host.addEventListener('lostpointercapture', cancelled);
    host.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    void document.fonts.ready.then(() => schedule(true));
    return () => {
      resizeObserver.disconnect(); cancelAnimationFrame(frame);
      host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move); host.removeEventListener('pointerup', up);
      host.removeEventListener('pointercancel', cancelled); host.removeEventListener('lostpointercapture', cancelled); host.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur);
    };
  }, []);
  useEffect(() => { redraw.current(); }, [props.page, props.view, props.selection, props.tool]);
  useEffect(() => { cancel.current(); }, [props.page.id, props.tool]);
  return <div ref={container} className={'writing-canvas ' + (grabbing ? 'grabbing' : '')} data-tool={props.tool} tabIndex={0} aria-label="Writing canvas. Use the pen to draw. Hold Space to pan." role="application">
    <canvas ref={base} aria-hidden="true" /><canvas ref={overlay} aria-hidden="true" />
  </div>;
}
export function isInput(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.matches('input, textarea, select, button') || target.isContentEditable || !!target.closest('dialog'));
}
