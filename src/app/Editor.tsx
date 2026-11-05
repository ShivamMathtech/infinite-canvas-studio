import { useRef, useState } from 'react';
import { ArrowUpRight, Circle, Eraser, Hand, Highlighter, Maximize, Minus, MousePointer2, PenLine, Plus, RectangleHorizontal, Type, Undo2, Redo2, MoveUpRight } from 'lucide-react';
import { Canvas } from '../canvas/Canvas';
import { fitView, zoomAt } from '../canvas/geometry';
import type { Page, PenSettings, Tool, View } from '../document/model';
import { IconButton } from './components';
type Props = {
  page: Page; tool: Tool; setTool: (tool: Tool) => void; settings: PenSettings; setSettings: (settings: PenSettings) => void;
  layerId: string; selection: string | null; onSelect: (id: string | null) => void;
  onCommit: (update: (page: Page) => Page) => void; onText: (x: number, y: number) => void;
  onNotice: (message: string) => void; onPointer: (type: string) => void;
  canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void;
};
const tools = [
  { id: 'pen', name: 'Pen (P)', icon: PenLine },
  { id: 'highlighter', name: 'Highlighter (H)', icon: Highlighter },
  { id: 'eraser', name: 'Stroke eraser (E)', icon: Eraser },
  { id: 'select', name: 'Select & move (V)', icon: MousePointer2 },
  { id: 'rectangle', name: 'Rectangle (R)', icon: RectangleHorizontal },
  { id: 'ellipse', name: 'Ellipse (O)', icon: Circle },
  { id: 'arrow', name: 'Arrow (A)', icon: ArrowUpRight },
  { id: 'line', name: 'Line (L)', icon: MoveUpRight },
  { id: 'text', name: 'Text (T)', icon: Type },
  { id: 'hand', name: 'Hand (Space)', icon: Hand },
] as const;
export const colors = ['#302f38', '#9762d5', '#2b9a8e', '#e5a23b', '#dd6584'];
export function Editor(props: Props) {
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const size = useRef({ width: 1, height: 1 }), fitted = useRef(false);
  const onSize = (width: number, height: number) => {
    size.current = { width, height };
    if (!fitted.current && width > 20 && height > 20) { fitted.current = true; setView(fitView(props.page, width, height)); }
  };
  const zoom = (factor: number) => setView(v => zoomAt(v, size.current.width / 2, size.current.height / 2, v.zoom * factor));
  return <section className="editor" aria-label="Canvas editor">
    <div className="tool-shelf">
      <div className="toolbox" role="toolbar" aria-label="Drawing tools">
        {tools.map(({ id, name, icon: Icon }) => <IconButton key={id} label={name} active={props.tool === id} onClick={() => props.setTool(id)}><Icon size={19} strokeWidth={1.65} /></IconButton>)}
        <span className="tool-divider" />
        <div className="toolbar-colors">{colors.slice(0, 4).map(color => <button key={color} className={'color-dot ' + (color === props.settings.color ? 'selected' : '')} style={{ background: color }} aria-label={'Ink color ' + color} aria-pressed={color === props.settings.color} onClick={() => props.setSettings({ ...props.settings, color })} />)}</div>
        <label className="size-select"><span className="sr-only">Stroke width</span><select value={props.settings.size} onChange={e => props.setSettings({ ...props.settings, size: Number(e.target.value) })}>{[1, 2, 3, 4, 6, 8].map(value => <option key={value} value={value}>{value.toFixed(1)} px</option>)}</select></label>
      </div>
    </div>
    <div className="canvas-stage"><Canvas {...props} view={view} setView={setView} onSize={onSize} /></div>
    <div className="canvas-hint"><span className="tiny-key">Space</span> to pan <span className="hint-dot">·</span> <span className="tiny-key">Ctrl</span> + scroll to zoom</div>
    <div className="zoom-dock">
      <IconButton label="Undo" disabled={!props.canUndo} onClick={props.undo}><Undo2 size={16} /></IconButton>
      <IconButton label="Redo" disabled={!props.canRedo} onClick={props.redo}><Redo2 size={16} /></IconButton>
      <span className="tool-divider" />
      <IconButton label="Zoom out" onClick={() => zoom(1 / 1.2)}><Minus size={15} /></IconButton>
      <button className="zoom-number" title="Reset zoom to 100%" onClick={() => setView(v => zoomAt(v, size.current.width / 2, size.current.height / 2, 1))}>{Math.round(view.zoom * 100)}%</button>
      <IconButton label="Zoom in" onClick={() => zoom(1.2)}><Plus size={15} /></IconButton>
      <IconButton label="Fit page content" onClick={() => setView(fitView(props.page, size.current.width, size.current.height))}><Maximize size={15} /></IconButton>
    </div>
  </section>;
}
