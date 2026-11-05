import { PDFDocument, rgb } from 'pdf-lib';
import type { Page } from '../document/model';

/** The rasterizer is injected so page ordering and PDF structure can be tested without a browser. */
export async function assemblePDF(pages: Page[], title: string, rasterize: (page: Page) => Promise<string>, progress: (message: string) => void) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title); pdf.setCreator('Infinite Canvas Studio');
  for (let index = 0; index < pages.length; index++) {
    progress('Preparing page ' + (index + 1) + ' of ' + pages.length + '…');
    const image = await pdf.embedPng(await rasterize(pages[index]));
    const landscape = image.width > image.height;
    const width = landscape ? 841.89 : 595.28, height = landscape ? 595.28 : 841.89;
    const page = pdf.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.984, 0.980, 0.968) });
    const scale = Math.min((width - 40) / image.width, (height - 40) / image.height);
    page.drawImage(image, { x: (width - image.width * scale) / 2, y: (height - image.height * scale) / 2, width: image.width * scale, height: image.height * scale });
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return pdf.save();
}
