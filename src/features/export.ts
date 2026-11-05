import type { Page, Workspace } from '../document/model';
import { pageBounds } from '../canvas/geometry';
import { drawPage } from '../canvas/render';

export function filename(name: string) { return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').slice(0, 80) || 'infinite-canvas'; }
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function exportBackup(workspace: Workspace) {
  download(new Blob([JSON.stringify(workspace)], { type: 'application/json' }), 'infinite-canvas-backup.json');
}
async function pageImage(page: Page) {
  await document.fonts.ready;
  const bounds = pageBounds(page);
  const scale = Math.min(2, 4096 / bounds.w, 4096 / bounds.h, Math.sqrt(12000000 / (bounds.w * bounds.h)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(bounds.w * scale)); canvas.height = Math.max(1, Math.ceil(bounds.h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create an export canvas.');
  drawPage(ctx, page, { x: -bounds.x * scale, y: -bounds.y * scale, zoom: scale }, canvas.width, canvas.height);
  return canvas;
}
export async function exportPNG(page: Page) {
  const canvas = await pageImage(page);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png'));
  return { blob, name: filename(page.title) + '.png' };
}
export async function exportPDF(pages: Page[], title: string, progress: (message: string) => void) {
  const { assemblePDF } = await import('./pdfDocument');
  const bytes = await assemblePDF(pages, title, async page => (await pageImage(page)).toDataURL('image/png'), progress);
  return { blob: new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), name: filename(title) + '.pdf' };
}
