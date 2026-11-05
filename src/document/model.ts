import { z } from 'zod';

const id = z.string().min(1).max(100);
const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const base = { id, layerId: id };
export const PointSchema = z.tuple([coordinate, coordinate, z.number().min(0).max(1)]);
const StrokeSchema = z.object({
  ...base, type: z.literal('stroke'), points: z.array(PointSchema).min(1).max(40000),
  color, size: z.number().min(0.1).max(100), opacity: z.number().min(0).max(1),
  pressure: z.boolean(), smoothing: z.number().min(0).max(1),
});
const ShapeSchema = z.object({
  ...base, type: z.literal('shape'), shape: z.enum(['rectangle', 'ellipse', 'line', 'arrow']),
  x: coordinate, y: coordinate, w: coordinate, h: coordinate,
  color, size: z.number().min(0.1).max(100),
});
const TextSchema = z.object({
  ...base, type: z.literal('text'), x: coordinate, y: coordinate,
  text: z.string().min(1).max(3000), fontSize: z.number().min(8).max(180),
  color, handwritten: z.boolean(),
});
const NoteSchema = z.object({
  ...base, type: z.literal('note'), x: coordinate, y: coordinate,
  w: z.number().min(80).max(1000), h: z.number().min(60).max(1000),
  text: z.string().max(1000), color,
});
const GraphSchema = z.object({
  ...base, type: z.literal('graph'), x: coordinate, y: coordinate,
  w: z.number().min(220).max(1200), h: z.number().min(180).max(1000),
  curve: z.enum(['quadratic', 'sine', 'linear']), a: z.number().min(-3).max(3),
});
export const ObjectSchema = z.discriminatedUnion('type', [StrokeSchema, ShapeSchema, TextSchema, NoteSchema, GraphSchema]);
export const PageSchema = z.object({
  id, title: z.string().min(1).max(100), background: z.enum(['dots', 'ruled', 'grid', 'plain']),
  layers: z.array(z.object({ id, name: z.string().min(1).max(60), visible: z.boolean(), locked: z.boolean() })).min(1).max(30),
  objects: z.array(ObjectSchema).max(10000),
});
export const NotebookSchema = z.object({
  id, title: z.string().min(1).max(100), color, sample: z.boolean(),
  pages: z.array(PageSchema).min(1).max(500),
});
export const WorkspaceSchema = z.object({
  version: z.literal(1), activeNotebookId: id, activePageId: id,
  notebooks: z.array(NotebookSchema).min(1).max(100),
}).superRefine((workspace, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  const notebooks = new Set<string>(), pages = new Set<string>();
  let count = 0, points = 0;
  for (const book of workspace.notebooks) {
    if (notebooks.has(book.id)) fail('Duplicate notebook ID');
    notebooks.add(book.id);
    for (const page of book.pages) {
      if (pages.has(page.id)) fail('Duplicate page ID');
      pages.add(page.id);
      const layers = new Set(page.layers.map(l => l.id));
      if (layers.size !== page.layers.length) fail('Duplicate layer ID');
      const objects = new Set<string>();
      for (const object of page.objects) {
        count++;
        if (objects.has(object.id)) fail('Duplicate object ID');
        objects.add(object.id);
        if (!layers.has(object.layerId)) fail('Object references a missing layer');
        if (object.type === 'stroke') points += object.points.length;
      }
    }
  }
  const active = workspace.notebooks.find(b => b.id === workspace.activeNotebookId);
  if (!active?.pages.some(p => p.id === workspace.activePageId)) fail('Active page is missing');
  if (count > 50000 || points > 500000) fail('Backup exceeds the supported import size');
});

export type Point = z.infer<typeof PointSchema>;
export type CanvasObject = z.infer<typeof ObjectSchema>;
export type Stroke = z.infer<typeof StrokeSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Notebook = z.infer<typeof NotebookSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type View = { x: number; y: number; zoom: number };
export type Tool = 'pen' | 'highlighter' | 'eraser' | 'select' | 'hand' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'text';
export type PenSettings = { color: string; size: number; smoothing: number; pressure: boolean; penOnly: boolean };

export const uid = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
};
export function newPage(title = 'Untitled page'): Page {
  return {
    id: uid(), title, background: 'dots',
    layers: [
      { id: 'notes', name: 'Notes & objects', visible: true, locked: false },
      { id: 'graphs', name: 'Graphs', visible: true, locked: false },
      { id: 'ink', name: 'Handwriting', visible: true, locked: false },
    ], objects: [],
  };
}
export function activeDocument(workspace: Workspace) {
  const notebook = workspace.notebooks.find(b => b.id === workspace.activeNotebookId)!;
  return { notebook, page: notebook.pages.find(p => p.id === workspace.activePageId)! };
}
export function parseBackup(text: string): Workspace {
  if (new TextEncoder().encode(text).length > 20 * 1024 * 1024) throw new Error('Backups must be smaller than 20 MB.');
  const result = WorkspaceSchema.safeParse(JSON.parse(text));
  if (!result.success) throw new Error('This is not a valid version 1 Infinite Canvas backup. Your notes have not changed.');
  return result.data;
}
export function translateObject(object: CanvasObject, dx: number, dy: number): CanvasObject {
  if (object.type === 'stroke') return { ...object, points: object.points.map(([x, y, p]) => [x + dx, y + dy, p]) };
  return { ...object, x: object.x + dx, y: object.y + dy };
}
