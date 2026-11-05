import { newPage, uid, type CanvasObject, type Page, type Stroke, type Workspace } from './model';

function text(x: number, y: number, value: string, size = 30, color = '#302f38', handwritten = true): CanvasObject {
  return { id: uid(), layerId: 'notes', type: 'text', x, y, text: value, fontSize: size, color, handwritten };
}
function ink(points: number[][], color = '#8b5cda', size = 3): Stroke {
  return { id: uid(), layerId: 'ink', type: 'stroke', points: points.map(p => [p[0], p[1], 0.5]), color, size, opacity: 1, pressure: false, smoothing: 0.5 };
}
function overview(): Page {
  const page = newPage('A little room to think');
  page.objects = [
    text(64, 50, 'A little room to think.', 54),
    text(66, 142, 'Welcome to your infinite canvas', 18, '#787480', false),
    ink([[65, 123], [200, 117], [410, 121], [517, 116]]),
    text(70, 216, 'Write naturally. Follow the idea.', 32),
    text(70, 280, 'P   Pen     H   Highlight     E   Erase', 19, '#6f657e', false),
    text(70, 320, 'V   Select & move     Space + drag   Pan', 19, '#6f657e', false),
    text(70, 360, 'Ctrl / Cmd + Z   Undo', 19, '#6f657e', false),
    { id: uid(), layerId: 'notes', type: 'note', x: 90, y: 430, w: 340, h: 140, text: 'These sample pages are editable.\nMake a new notebook for your own ideas.', color: '#fff0b8' },
  ];
  return page;
}
function derivatives(): Page {
  const page = newPage('Derivatives, made visual');
  page.objects = [
    text(58, 42, 'Derivatives, made visual', 52),
    ink([[60, 113], [193, 108], [345, 112], [529, 108]], '#9b6ce0', 3),
    text(62, 154, '01   Start with a function', 29),
    text(94, 219, 'f(x) = x²', 47),
    text(100, 310, 'f\u2032(x) = 2x', 47),
    ink(Array.from({ length: 80 }, (_, i) => { const t = i / 79 * Math.PI * 2; return [222 + 145 * Math.cos(t), 342 + 42 * Math.sin(t)]; }), '#a580e4', 2.2),
    text(68, 402, 'At x = 1, the slope is 2.', 31),
    { id: uid(), layerId: 'graphs', type: 'graph', x: 514, y: 175, w: 390, h: 340, curve: 'quadratic', a: 1 },
    text(64, 502, 'A small change. A new perspective.', 27, '#7b6a91'),
    { id: uid(), layerId: 'notes', type: 'note', x: 67, y: 558, w: 355, h: 137, text: 'A derivative tells us how fast\na function changes.', color: '#fff0b8' },
    text(520, 560, 'Try it yourself', 28),
    text(520, 612, 'Sketch the tangent at x = 2.', 26, '#79717f'),
    ink([[530, 667], [641, 665], [762, 668], [867, 665]], '#c9c0d7', 1),
  ];
  return page;
}
function practice(): Page {
  const page = newPage('Your turn');
  page.objects = [
    text(65, 55, 'Your turn.', 54), text(68, 148, 'Take a breath. Work it out.', 30, '#817489'),
    text(70, 240, '1.   Differentiate f(x) = x³.', 32),
    text(70, 410, '2.   Sketch the slope at x = 2.', 32),
    text(70, 585, '3.   What does the derivative tell you?', 32),
  ];
  return page;
}
export function seedWorkspace(): Workspace {
  const pages = [overview(), derivatives(), practice()], blank = newPage('First thoughts');
  const sampleId = uid();
  return {
    version: 1, activeNotebookId: sampleId, activePageId: pages[1].id,
    notebooks: [
      { id: sampleId, title: 'Calculus notebook', color: '#a58be5', sample: true, pages },
      { id: uid(), title: 'My notebook', color: '#5aac9b', sample: false, pages: [blank] },
    ],
  };
}
