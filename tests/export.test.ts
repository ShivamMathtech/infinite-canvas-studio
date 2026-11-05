import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { assemblePDF } from '../src/features/pdfDocument';
import { newPage } from '../src/document/model';
import { filename } from '../src/features/export';

describe('Notebook PDF export', () => {
  it('writes every requested page in order and creates a readable PDF', async () => {
    const pages = [newPage('First'), newPage('Second'), newPage('Third')];
    const rendered: string[] = [], progress: string[] = [];
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j/WQAAAAASUVORK5CYII=';
    const bytes = await assemblePDF(pages, 'Complete notebook', async page => { rendered.push(page.title); return png; }, message => progress.push(message));
    const document = await PDFDocument.load(bytes);
    expect(rendered).toEqual(['First', 'Second', 'Third']);
    expect(document.getPageCount()).toBe(3);
    expect(document.getTitle()).toBe('Complete notebook');
    expect(progress.at(-1)).toBe('Preparing page 3 of 3…');
    expect(document.getPages().every(page => page.getWidth() > 500 && page.getHeight() > 800)).toBe(true);
  });
  it('sanitizes filenames for Windows', () => {
    expect(filename('Math: x/y? <notes>')).toBe('Math- x-y- -notes-');
    expect(filename('')).toBe('infinite-canvas');
  });
});
