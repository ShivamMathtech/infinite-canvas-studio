import { describe, expect, it, vi } from 'vitest';
import { activeDocument, newPage, parseBackup, translateObject, uid, WorkspaceSchema, type Stroke } from '../src/document/model';
import { seedWorkspace } from '../src/document/seed';
import { History } from '../src/document/history';
import { editableObjects, fitView, hitsStroke, objectBounds, pageBounds, screenToWorld, visibleObjects, zoomAt } from '../src/canvas/geometry';

describe('Document integrity and portable backups', () => {
  it('round-trips every sample notebook, page and stroke', () => {
    const workspace = seedWorkspace();
    expect(parseBackup(JSON.stringify(workspace))).toEqual(workspace);
    expect(activeDocument(workspace).page.title).toBe('Derivatives, made visual');
  });
  it('rejects duplicate IDs, missing layers and invalid active pages', () => {
    const workspace = seedWorkspace(), { page } = activeDocument(workspace);
    workspace.notebooks[0].pages.push(structuredClone(page));
    expect(WorkspaceSchema.safeParse(workspace).success).toBe(false);
    const missing = seedWorkspace(); activeDocument(missing).page.objects[0].layerId = 'missing';
    expect(() => parseBackup(JSON.stringify(missing))).toThrow('valid version 1');
    const badActive = seedWorkspace(); badActive.activePageId = 'unknown';
    expect(WorkspaceSchema.safeParse(badActive).success).toBe(false);
  });
  it('rejects unsupported versions and unsafe numeric values', () => {
    const workspace = seedWorkspace();
    expect(WorkspaceSchema.safeParse({ ...workspace, version: 2 }).success).toBe(false);
    const stroke = activeDocument(workspace).page.objects.find(o => o.type === 'stroke')!;
    stroke.points[0][0] = Infinity;
    expect(WorkspaceSchema.safeParse(workspace).success).toBe(false);
  });
  it('supports HTTP local previews without randomUUID', () => {
    const crypto = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    try { expect(uid()).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/); }
    finally { vi.unstubAllGlobals(); }
  });
});
describe('Page-scoped command history', () => {
  it('undoes and redoes a sequence without mutating prior states', () => {
    const history = new History<number>();
    history.record(0); history.record(1);
    expect(history.undo(2)).toBe(1);
    expect(history.undo(1)).toBe(0);
    expect(history.canUndo).toBe(false);
    expect(history.redo(0)).toBe(1);
    expect(history.redo(1)).toBe(2);
  });
  it('discards redo after a new edit and bounds retained history', () => {
    const history = new History<number>(2);
    history.record(0); history.record(1); history.record(2);
    expect(history.undo(3)).toBe(2);
    history.record(2); expect(history.canRedo).toBe(false);
    expect(history.undo(4)).toBe(2); expect(history.undo(2)).toBe(1); expect(history.canUndo).toBe(false);
  });
});
describe('Canvas geometry', () => {
  const stroke: Stroke = { id: 'stroke', layerId: 'ink', type: 'stroke', points: [[-20, -10, 0.5], [200, 100, 0.8]], size: 4, opacity: 1, color: '#302f38', pressure: true, smoothing: 0.3 };
  it('keeps the world point beneath the cursor stable while zooming', () => {
    const view = { x: -125, y: 37, zoom: 0.6 };
    const world = screenToWorld(430, 210, view);
    for (const zoom of [0.01, 0.2, 1, 2.5, 50]) {
      const next = zoomAt(view, 430, 210, zoom);
      expect(screenToWorld(430, 210, next).x).toBeCloseTo(world.x);
      expect(screenToWorld(430, 210, next).y).toBeCloseTo(world.y);
      expect(next.zoom).toBeGreaterThanOrEqual(0.15); expect(next.zoom).toBeLessThanOrEqual(4);
    }
  });
  it('moves strokes without changing pressure or the original data', () => {
    const moved = translateObject(stroke, 10, -5) as Stroke;
    expect(moved.points).toEqual([[-10, -15, 0.5], [210, 95, 0.8]]);
    expect(stroke.points[0]).toEqual([-20, -10, 0.5]);
  });
  it('erases strokes by segment distance, including one-point dots', () => {
    expect(hitsStroke(stroke, 90, 45, 5)).toBe(true);
    expect(hitsStroke(stroke, 90, 80, 5)).toBe(false);
    expect(hitsStroke({ ...stroke, points: [[5, 5, 0.5]] }, 6, 6, 3)).toBe(true);
  });
  it('excludes hidden layers from export and locked layers from editing', () => {
    const page = newPage();
    page.objects = [stroke, { ...stroke, id: 'hidden', layerId: 'graphs' }, { ...stroke, id: 'locked', layerId: 'notes' }];
    page.layers.find(l => l.id === 'graphs')!.visible = false;
    page.layers.find(l => l.id === 'notes')!.locked = true;
    expect(visibleObjects(page).map(o => o.id)).toEqual(['locked', 'stroke']);
    expect(editableObjects(page).map(o => o.id)).toEqual(['stroke']);
  });
  it('exports full content bounds, including negative and off-screen ink', () => {
    const page = newPage(); page.objects = [stroke, translateObject(stroke, 3000, 2000)];
    const bounds = pageBounds(page);
    expect(bounds.x).toBeLessThan(-20); expect(bounds.w).toBeGreaterThan(3200);
    expect(bounds.h).toBeGreaterThan(2100);
    const view = fitView(page, 1200, 900);
    expect(Number.isFinite(view.zoom)).toBe(true);
    expect(objectBounds({ id: 'shape', layerId: 'ink', type: 'shape', x: 100, y: 100, w: -50, h: -20, shape: 'rectangle', size: 2, color: '#302f38' })).toEqual({ x: 50, y: 80, w: 50, h: 20 });
  });
});
