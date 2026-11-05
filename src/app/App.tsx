import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Copy, Download, Ellipsis, Eye, EyeOff, FileDown, FileImage, FileJson, FilePlus2, Focus, Infinity as InfinityIcon, Layers, LockKeyhole, Maximize2, PanelLeftClose, PanelRightClose, PenLine, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, SquarePen, StickyNote, Trash2, Type, UnlockKeyhole, Upload, WifiOff, X, ChartSpline, ArrowUp, ArrowDown } from 'lucide-react';
import { Studio } from '../document/studio';
import { LocalRepository } from '../storage/repository';
import { activeDocument, parseBackup, translateObject, uid, type CanvasObject, type PenSettings, type Tool } from '../document/model';
import { editableObjects } from '../canvas/geometry';
import { isInput } from '../canvas/Canvas';
import { exportBackup, exportPDF, exportPNG } from '../features/export';
import { Dialog, IconButton, PageThumbnail, type DialogSpec } from './components';
import { colors, Editor } from './Editor';

let channel: BroadcastChannel | undefined;
const studio = new Studio(new LocalRepository(), revision => channel?.postMessage(revision));
const defaultSettings: PenSettings = { color: '#302f38', size: 2, smoothing: 0.35, pressure: true, penOnly: false };
function initialSettings() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('ics-pen') ?? 'null');
    if (value && typeof value === 'object') {
      const candidate = value as PenSettings;
      if (/^#[a-fA-F0-9]{6}$/.test(candidate.color) && [1, 2, 3, 4, 6, 8].includes(candidate.size) && candidate.smoothing >= 0 && candidate.smoothing <= 1 && typeof candidate.pressure === 'boolean' && typeof candidate.penOnly === 'boolean') return candidate;
    }
  } catch { /* Preferences can be unavailable while IndexedDB remains usable. */ }
  return defaultSettings;
}
export default function App() {
  const state = useSyncExternalStore(studio.subscribe, studio.getSnapshot);
  const [tool, setTool] = useState<Tool>('pen'), [settings, setSettings] = useState(initialSettings);
  const [layerId, setLayerId] = useState('ink'), [selection, setSelection] = useState<string | null>(null);
  const [panel, setPanel] = useState<'pen' | 'layers' | 'page'>('pen');
  const [focus, setFocus] = useState(false), [leftOpen, setLeftOpen] = useState(() => window.innerWidth > 760), [rightOpen, setRightOpen] = useState(() => window.innerWidth > 1020);
  const [dialog, setDialog] = useState<DialogSpec | null>(null), [exportOpen, setExportOpen] = useState(false);
  const [pageMenu, setPageMenu] = useState(false), [help, setHelp] = useState(false);
  const [search, setSearch] = useState(''), [toast, setToast] = useState(''), [busy, setBusy] = useState('');
  const [preparedDownload, setPreparedDownload] = useState<{ url: string; name: string } | null>(null);
  const [pointer, setPointer] = useState('mouse'), [online, setOnline] = useState(navigator.onLine);
  const input = useRef<HTMLInputElement>(null), toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notice = useCallback((message: string) => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 4500); }, []);
  const workspace = state.workspace;
  const current = workspace ? activeDocument(workspace) : null;
  const page = current?.page, notebook = current?.notebook;
  const selected = page ? editableObjects(page).find(o => o.id === selection) : undefined;

  useEffect(() => {
    void studio.initialize();
    if ('BroadcastChannel' in window) { channel = new BroadcastChannel('ics-revisions'); channel.onmessage = event => { if (typeof event.data === 'number') studio.externalSave(event.data); }; }
    const save = () => { if (document.visibilityState === 'hidden') void studio.flush(); };
    const beforeUnload = (event: BeforeUnloadEvent) => { const status = studio.getSnapshot().status; if (status !== 'saved' && status !== 'loading') { event.preventDefault(); event.returnValue = ''; } };
    const connection = () => setOnline(navigator.onLine);
    document.addEventListener('visibilitychange', save); window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('online', connection); window.addEventListener('offline', connection);
    return () => { channel?.close(); channel = undefined; document.removeEventListener('visibilitychange', save); window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('online', connection); window.removeEventListener('offline', connection); clearTimeout(toastTimer.current); };
  }, []);
  useEffect(() => { try { localStorage.setItem('ics-pen', JSON.stringify(settings)); } catch { /* Non-essential preference. */ } }, [settings]);
  useEffect(() => () => { if (preparedDownload) URL.revokeObjectURL(preparedDownload.url); }, [preparedDownload]);
  useEffect(() => { setSelection(null); setLayerId('ink'); setPageMenu(false); }, [page?.id]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isInput(event.target) || dialog || help) return;
      const key = event.key.toLowerCase();
      if (event.ctrlKey || event.metaKey) {
        if (key === 'z') { event.preventDefault(); if (event.shiftKey) studio.redo(); else studio.undo(); }
        if (key === 'y') { event.preventDefault(); studio.redo(); }
        if (key === 's') { event.preventDefault(); void studio.flush(); }
        return;
      }
      const keys: Record<string, Tool> = { p: 'pen', h: 'highlighter', e: 'eraser', v: 'select', r: 'rectangle', o: 'ellipse', a: 'arrow', l: 'line', t: 'text' };
      if (keys[key]) setTool(keys[key]);
      if (key === '/') { event.preventDefault(); setFocus(false); setLeftOpen(true); requestAnimationFrame(() => document.getElementById('notebook-search')?.focus()); }
      if (key === 'f') setFocus(value => !value);
      if (key === 'escape') { setSelection(null); setFocus(false); setExportOpen(false); setPageMenu(false); }
      if ((key === 'delete' || key === 'backspace') && selected) { event.preventDefault(); studio.updatePage(p => ({ ...p, objects: p.objects.filter(o => o.id !== selected.id) })); setSelection(null); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [dialog, help, selected]);

  const renamePage = () => setDialog({ title: 'Rename page', initial: page!.title, onSubmit: title => studio.updatePage(p => ({ ...p, title })) });
  const addPage = () => setDialog({ title: 'A fresh page', initial: 'Untitled page', submit: 'Create page', onSubmit: studio.addPage });
  const addNotebook = () => setDialog({ title: 'Create a notebook', initial: 'Untitled notebook', submit: 'Create notebook', onSubmit: studio.addNotebook });
  const writableLayer = () => {
    const layer = page?.layers.find(l => l.id === layerId);
    if (!layer || !layer.visible || layer.locked) { notice('Choose a visible, unlocked layer first.'); return false; }
    return true;
  };
  const addObject = (object: CanvasObject) => {
    if (!writableLayer()) return;
    studio.updatePage(p => ({ ...p, objects: [...p.objects, object] })); setSelection(object.id); setTool('select');
  };
  const addText = (x: number, y: number) => {
    if (!writableLayer()) return;
    setDialog({ title: 'Add text', multiline: true, submit: 'Place text', maxLength: 3000, onSubmit: text => addObject({ id: uid(), layerId, type: 'text', x, y, text, fontSize: 28, color: settings.color, handwritten: false }) });
  };
  const editSelected = () => {
    if (!selected || !('text' in selected)) return;
    const id = selected.id;
    setDialog({ title: selected.type === 'note' ? 'Edit sticky note' : 'Edit text', initial: selected.text, multiline: true, maxLength: selected.type === 'note' ? 1000 : 3000, onSubmit: text => studio.updatePage(p => ({ ...p, objects: p.objects.map(o => o.id === id && 'text' in o ? { ...o, text } : o) })) });
  };
  const exportFile = async (kind: 'backup' | 'png' | 'pdf') => {
    setExportOpen(false);
    if (!workspace || !notebook || !page) return;
    try {
      setBusy('Preparing export…');
      if (kind === 'backup') {
        setPreparedDownload({ url: URL.createObjectURL(new Blob([JSON.stringify(workspace)], { type: 'application/json' })), name: 'infinite-canvas-backup.json' });
      } else {
        const file = kind === 'png' ? await exportPNG(page) : await exportPDF(notebook.pages, notebook.title, setBusy);
        setPreparedDownload({ url: URL.createObjectURL(file.blob), name: file.name });
      }
    } catch (error) { notice(error instanceof Error ? error.message : 'Export failed.'); }
    finally { setBusy(''); }
  };
  if (!workspace || !page || !notebook) return <div className="loading-screen"><InfinityIcon size={52} /><h1>Infinite Canvas</h1><p>{state.error || 'Opening a little room to think…'}</p>{state.error && <button className="button primary" onClick={() => void studio.reload()}>Try again</button>}</div>;
  const status = { loading: 'Opening', unsaved: 'Changes pending', saving: 'Saving…', saved: 'Saved on this device', error: 'Could not save', conflict: 'Another tab has changes' }[state.status];
  return <div className={'studio ' + (focus ? 'focus-mode ' : '') + (!leftOpen ? 'left-closed ' : '') + (!rightOpen ? 'right-closed' : '')}>
    <header className="app-header">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setFocus(false); setLeftOpen(true); }}><InfinityIcon size={34} strokeWidth={1.7} /><span>Infinite Canvas<small>STUDIO</small></span></a>
      <span className="header-divider" />
      <button className="document-title" onClick={() => setDialog({ title: 'Rename notebook', initial: notebook.title, onSubmit: studio.renameNotebook })}><BookOpen size={16} /><span>{notebook.title}</span><ChevronDown size={13} /></button>
      <div className={'save-indicator ' + state.status} aria-live="polite"><span className="status-dot" />{status}</div>
      <div className="header-actions">
        <IconButton label={leftOpen ? 'Hide notebooks' : 'Show notebooks'} onClick={() => { setLeftOpen(v => !v); setFocus(false); }}><PanelLeftClose size={17} /></IconButton>
        <button className={'focus-button ' + (focus ? 'on' : '')} onClick={() => setFocus(v => !v)} title="Focus mode (F)"><Focus size={16} /><span>{focus ? 'Exit focus' : 'Focus'}</span></button>
        <div className="dropdown-wrap">
          <button className="button primary export-button" disabled={!!busy} aria-expanded={exportOpen} onClick={() => setExportOpen(v => !v)}><Upload size={15} />Export<ChevronDown size={12} /></button>
          {exportOpen && <><div className="dismiss-layer" onClick={() => setExportOpen(false)} /><div className="dropdown export-menu"><span className="menu-heading">TAKE YOUR IDEAS WITH YOU</span><button onClick={() => void exportFile('pdf')}><FileDown /><span>Notebook PDF<small>All {notebook.pages.length} pages · fitted to A4</small></span></button><button onClick={() => void exportFile('png')}><FileImage /><span>Current page PNG<small>Full content, beyond the viewport</small></span></button><button onClick={() => void exportFile('backup')}><FileJson /><span>Workspace backup<small>All notebooks · editable JSON</small></span></button></div></>}
        </div>
        <span className="avatar" aria-label="Local workspace">S</span>
      </div>
    </header>
    <div className="tab-strip">
      <div className="workspace-label"><span className="workspace-dot" />PERSONAL WORKSPACE</div>
      <div className="notebook-tabs">{workspace.notebooks.map(book => <button key={book.id} className={'notebook-tab ' + (book.id === notebook.id ? 'selected' : '')} onClick={() => studio.navigate(book.id, book.id === notebook.id ? page.id : undefined)}><BookOpen size={14} /><span>{book.title}</span>{book.sample && <small>Sample</small>}</button>)}<IconButton label="New notebook" onClick={addNotebook}><Plus size={16} /></IconButton></div>
      <IconButton className="inspector-toggle" label={rightOpen ? 'Hide inspector' : 'Show inspector'} onClick={() => { setRightOpen(v => !v); setFocus(false); }}><PanelRightClose size={17} /></IconButton>
    </div>
    {(state.status === 'error' || state.status === 'conflict') && <div className="storage-banner" role="alert"><span>{state.error}</span><button onClick={() => exportBackup(workspace)}>Download backup</button>{state.status === 'conflict' ? <button onClick={() => setDialog({ title: 'Load the latest saved notes?', description: 'Unsaved changes in this tab will be discarded. Download a backup first if you need to keep them.', confirm: true, submit: 'Load latest', onSubmit: () => { void studio.reload().catch(error => notice(String(error))); } })}>Load latest</button> : <button onClick={() => void studio.flush()}>Retry save</button>}</div>}
    <main className="workspace">
      <aside className="sidebar">
        <div className="sidebar-top"><div className="section-heading"><span>MY NOTEBOOKS</span><IconButton label="Create notebook" onClick={addNotebook}><Plus size={14} /></IconButton></div><div className="search-field"><Search size={14} /><input id="notebook-search" aria-label="Search notebooks and pages" placeholder="Find a thought…" value={search} onChange={e => setSearch(e.target.value)} /><kbd>/</kbd></div>
          <nav className="notebook-list" aria-label="Notebooks">{workspace.notebooks.filter(book => book.title.toLowerCase().includes(search.toLowerCase()) || book.pages.some(p => p.title.toLowerCase().includes(search.toLowerCase()))).map(book => <button key={book.id} className={book.id === notebook.id ? 'selected' : ''} onClick={() => studio.navigate(book.id, book.id === notebook.id ? page.id : undefined)}><BookOpen size={17} style={{ color: book.color }} /><span>{book.title}</span><small>{book.pages.length}</small></button>)}</nav></div>
        <div className="pages-heading"><span>PAGES</span><span>{notebook.pages.length.toString().padStart(2, '0')}</span></div>
        <div className="page-list">{notebook.pages.filter(p => p.title.toLowerCase().includes(search.toLowerCase()) || notebook.title.toLowerCase().includes(search.toLowerCase())).map(p => <button key={p.id} className={'page-card ' + (p.id === page.id ? 'selected' : '')} onClick={() => studio.navigate(notebook.id, p.id)} onDoubleClick={p.id === page.id ? renamePage : undefined}><div className="thumbnail-wrap"><PageThumbnail page={p} />{p.id === page.id && <span className="page-selected-dot" />}</div><span className="page-caption"><span>{(notebook.pages.indexOf(p) + 1).toString().padStart(2, '0')}</span><strong>{p.title}</strong></span></button>)}</div>
        <div className="sidebar-bottom"><button className="new-page-button" onClick={addPage}><Plus size={17} />New page</button><button className="import-button" onClick={() => input.current?.click()}><Download size={15} />Import backup</button><div className="local-note"><ShieldCheck size={12} />Your notes stay on this device</div></div>
      </aside>
      <div className="canvas-column"><div className="page-breadcrumb"><div><span>{notebook.sample ? 'SAMPLE NOTEBOOK' : 'YOUR NOTEBOOK'}</span><ChevronRight size={13} /><button onClick={renamePage}>{page.title}</button></div><div className="dropdown-wrap"><IconButton label="Page actions" onClick={() => setPageMenu(v => !v)}><Ellipsis size={19} /></IconButton>{pageMenu && <><div className="dismiss-layer" onClick={() => setPageMenu(false)} /><div className="dropdown page-menu"><button onClick={() => { setPageMenu(false); renamePage(); }}><SquarePen />Rename page</button><button onClick={() => { setPageMenu(false); studio.duplicatePage(); }}><Copy />Duplicate page</button><button className="danger-text" onClick={() => { setPageMenu(false); setDialog({ title: 'Delete this page?', description: 'This removes “' + page.title + '”. This action cannot be undone. You can export a backup first.', confirm: true, danger: true, submit: 'Delete page', onSubmit: studio.deletePage }); }}><Trash2 />Delete page</button></div></>}</div></div>
        <Editor key={page.id} page={page} tool={tool} setTool={setTool} settings={settings} setSettings={setSettings} layerId={layerId} selection={selection} onSelect={setSelection} onCommit={studio.updatePage} onText={addText} onNotice={notice} onPointer={setPointer} canUndo={state.canUndo} canRedo={state.canRedo} undo={studio.undo} redo={studio.redo} />
      </div>
      <aside className="inspector">
        <div className="inspector-tabs" role="tablist" aria-label="Canvas settings">{([{ id: 'pen', name: 'Pen', icon: PenLine }, { id: 'layers', name: 'Layers', icon: Layers }, { id: 'page', name: 'Page', icon: SlidersHorizontal }] as const).map(({ id, name, icon: Icon }) => <button key={id} role="tab" aria-selected={panel === id} onClick={() => setPanel(id)}><Icon size={15} />{name}</button>)}</div>
        <div className="inspector-content">
          {panel === 'pen' && <>
            <div className="panel-heading"><span className="eyebrow">MAKE YOUR MARK</span><h2>A pen that feels like you.</h2><p>Fine-tune your ink. Find your flow.</p></div>
            <div className="pen-preview"><svg viewBox="0 0 236 100" aria-label="Pen stroke preview"><path d="M16 72 C 44 55, 63 31, 93 48 S 132 81, 160 57 S 199 21, 220 34" fill="none" stroke={settings.color} strokeWidth={settings.size * 1.3 + 1} strokeLinecap="round" /></svg><span>{tool === 'highlighter' ? 'HIGHLIGHTER' : 'FINELINER'}<span>{settings.size.toFixed(1)} px</span></span></div>
            <div className="control-section"><div className="control-label"><label htmlFor="ink-color">Ink color</label><span>{settings.color.toUpperCase()}</span></div><div className="color-palette">{colors.map(color => <button key={color} className={'palette-color ' + (settings.color === color ? 'selected' : '')} style={{ background: color }} aria-label={'Choose ' + color} aria-pressed={settings.color === color} onClick={() => setSettings({ ...settings, color })}>{settings.color === color && <Check size={13} />}</button>)}<label className="custom-color" title="Custom ink color"><Plus size={14} /><input id="ink-color" type="color" value={settings.color} onChange={e => setSettings({ ...settings, color: e.target.value })} /></label></div></div>
            <div className="control-section"><div className="control-label"><label htmlFor="smoothing">Stabilization</label><strong>{Math.round(settings.smoothing * 100)}%</strong></div><input id="smoothing" type="range" min="0" max="1" step="0.05" value={settings.smoothing} onChange={e => setSettings({ ...settings, smoothing: Number(e.target.value) })} /><div className="range-caption"><span>Natural</span><span>Steady</span></div></div>
            <label className="toggle-row"><span>Pressure sensitivity<small>For supported pen tablets</small></span><input type="checkbox" checked={settings.pressure} onChange={e => setSettings({ ...settings, pressure: e.target.checked })} role="switch" /></label>
            <label className="toggle-row"><span>Pen-only drawing<small>Touch always pans the canvas</small></span><input type="checkbox" checked={settings.penOnly} onChange={e => setSettings({ ...settings, penOnly: e.target.checked })} role="switch" /></label>
            <div className="quiet-card"><span className="card-icon"><Sparkles size={17} /></span><strong>Space to think.</strong><p>Press <kbd>F</kbd> to hide the panels and let your ideas take the whole canvas.</p><button onClick={() => setFocus(true)}>Enter focus mode <Maximize2 size={13} /></button></div>
          </>}
          {panel === 'layers' && <>
            <div className="panel-heading"><span className="eyebrow">A PLACE FOR EVERYTHING</span><h2>Build your ideas in layers.</h2><p>Select a layer to write on it.</p></div>
            <div className="layer-list">{[...page.layers].reverse().map(layer => <div key={layer.id} className={'layer-row ' + (layer.id === layerId ? 'selected' : '')}><IconButton label={(layer.visible ? 'Hide ' : 'Show ') + layer.name} onClick={() => studio.updatePage(p => ({ ...p, layers: p.layers.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l) }))}>{layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}</IconButton><button className="layer-name" onClick={() => setLayerId(layer.id)}><span>{layer.name}</span><small>{page.objects.filter(o => o.layerId === layer.id).length} objects</small></button><IconButton label={(layer.locked ? 'Unlock ' : 'Lock ') + layer.name} onClick={() => studio.updatePage(p => ({ ...p, layers: p.layers.map(l => l.id === layer.id ? { ...l, locked: !l.locked } : l) }))}>{layer.locked ? <LockKeyhole size={14} /> : <UnlockKeyhole size={14} />}</IconButton></div>)}</div>
            <div className="layer-actions"><button className="button secondary" onClick={() => setDialog({ title: 'Add a layer', initial: 'New layer', maxLength: 60, onSubmit: name => { const id = uid(); studio.updatePage(p => ({ ...p, layers: [...p.layers, { id, name, visible: true, locked: false }] })); setLayerId(id); } })}><Plus size={14} />New layer</button>{[-1, 1].map(direction => <IconButton key={direction} label={direction === 1 ? 'Move layer forward' : 'Move layer backward'} disabled={page.layers.findIndex(l => l.id === layerId) + direction < 0 || page.layers.findIndex(l => l.id === layerId) + direction >= page.layers.length} onClick={() => studio.updatePage(p => { const layers = [...p.layers], index = layers.findIndex(l => l.id === layerId); [layers[index], layers[index + direction]] = [layers[index + direction], layers[index]]; return { ...p, layers }; })}>{direction === 1 ? <ArrowUp size={15} /> : <ArrowDown size={15} />}</IconButton>)}</div>
            <p className="panel-caption">Locked and hidden layers are protected from drawing, selection, and erasing.</p>
          </>}
          {panel === 'page' && <>
            <div className="panel-heading"><span className="eyebrow">SET THE SCENE</span><h2>Your page. Your way.</h2><p>A little structure for a big idea.</p></div>
            <div className="control-label"><span>Paper style</span><span>Infinite</span></div><div className="paper-options">{(['dots', 'ruled', 'grid', 'plain'] as const).map(background => <button key={background} className={page.background === background ? 'selected' : ''} onClick={() => studio.updatePage(p => ({ ...p, background }))}><span className={'paper-swatch ' + background} /><span>{background}</span></button>)}</div>
            <div className="section-label">ADD TO YOUR CANVAS</div><div className="insert-grid"><button onClick={() => addText(100, 100)}><Type size={19} /><span>Text</span></button><button onClick={() => { if (writableLayer()) setDialog({ title: 'A note to remember', multiline: true, submit: 'Add note', onSubmit: text => addObject({ id: uid(), layerId, type: 'note', x: 100, y: 150, w: 320, h: 180, color: '#fff0b8', text }) }); }}><StickyNote size={19} /><span>Sticky note</span></button><button onClick={() => addObject({ id: uid(), layerId, type: 'graph', x: 120, y: 180, w: 390, h: 340, curve: 'quadratic', a: 1 })}><ChartSpline size={19} /><span>2D graph</span></button><button onClick={addPage}><FilePlus2 size={19} /><span>New page</span></button></div>
            <div className="quiet-card"><ShieldCheck size={20} /><strong>Keep a copy of your thinking.</strong><p>Download a workspace backup to move your notebooks between devices.</p><button onClick={() => exportBackup(workspace)}>Download backup <Download size={13} /></button></div>
          </>}
          {selected && <div className="selection-panel"><span className="eyebrow">SELECTED OBJECT</span><h3>{selected.type === 'graph' ? 'Function explorer' : selected.type === 'stroke' ? 'Handwritten stroke' : selected.type === 'note' ? 'Sticky note' : selected.type === 'shape' ? selected.shape : 'Text'}</h3>
            {selected.type === 'graph' && <><label className="field-label">Function<select value={selected.curve} onChange={e => studio.updatePage(p => ({ ...p, objects: p.objects.map(o => o.id === selected.id && o.type === 'graph' ? { ...o, curve: e.target.value as 'quadratic' | 'sine' | 'linear' } : o) }))}><option value="quadratic">y = ax²</option><option value="sine">y = a sin(x)</option><option value="linear">y = ax</option></select></label><label className="field-label">Parameter a = {selected.a.toFixed(1)}<input type="range" min="-3" max="3" step="0.1" value={selected.a} onChange={e => studio.updatePage(p => ({ ...p, objects: p.objects.map(o => o.id === selected.id && o.type === 'graph' ? { ...o, a: Number(e.target.value) } : o) }))} /></label></>}
            <div className="selection-actions">{'text' in selected && <button className="button secondary" onClick={editSelected}><SquarePen size={14} />Edit</button>}<IconButton label="Duplicate selected object" onClick={() => { const copy = { ...translateObject(selected, 24, 24), id: uid() }; studio.updatePage(p => ({ ...p, objects: [...p.objects, copy] })); setSelection(copy.id); }}><Copy size={15} /></IconButton><IconButton label="Delete selected object" onClick={() => { studio.updatePage(p => ({ ...p, objects: p.objects.filter(o => o.id !== selected.id) })); setSelection(null); }}><Trash2 size={15} /></IconButton></div>
          </div>}
        </div><div className="inspector-bottom"><button onClick={() => setHelp(true)}><CircleHelp size={15} />A few helpful shortcuts<ChevronRight size={13} /></button></div>
      </aside>
    </main>
    <footer className="status-bar"><div><span className="status-dot" />{pointer === 'pen' ? 'Pen input detected' : 'Pen & mouse ready'}<span className="footer-divider" /><InfinityIcon size={14} /><span>Infinite canvas</span></div><div className="footer-center">{page.objects.length} objects<span>·</span>{page.layers.find(l => l.id === layerId)?.name ?? 'Select a layer'}</div><div>{!online && <><WifiOff size={12} />Offline<span className="footer-divider" /></>}<span>LOCAL WORKSPACE</span><IconButton label="Keyboard shortcuts" onClick={() => setHelp(true)}><CircleHelp size={14} /></IconButton></div></footer>
    <input type="file" ref={input} className="sr-only" accept=".json,application/json" aria-label="Import workspace backup" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      if (file.size > 20 * 1024 * 1024) { notice('Choose a backup smaller than 20 MB.'); return; }
      void file.text().then(text => { const imported = parseBackup(text); studio.importWorkspace(imported); notice('Notebooks imported. Existing notes were kept.'); }).catch(error => notice(error instanceof Error ? error.message : 'Import failed.'));
    }} />
    {preparedDownload && <div className="download-card" role="status"><FileDown size={23} /><div><strong>Your export is ready</strong><span>{preparedDownload.name}</span></div><a className="button primary" href={preparedDownload.url} download={preparedDownload.name}>Download file</a><IconButton label="Dismiss export" onClick={() => setPreparedDownload(null)}><X size={15} /></IconButton></div>}
    {toast && <div className="toast" role="status"><Check size={16} />{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={14} /></button></div>}
    {busy && <div className="busy-overlay" role="status"><div className="busy-card"><div className="spinner" /><strong>{busy}</strong></div></div>}
    {dialog && <Dialog spec={dialog} close={() => setDialog(null)} />}
    {help && <Help close={() => setHelp(false)} />}
  </div>;
}
function Help({ close }: { close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="dialog help-dialog" aria-label="Keyboard shortcuts" onCancel={close}><div className="dialog-top"><h2>A little less clicking.</h2><IconButton label="Close shortcuts" onClick={close}><X size={19} /></IconButton></div><p>Give your ideas the right of way.</p><div className="shortcut-list">{[['Pen / Highlighter / Eraser', 'P / H / E'], ['Select & move', 'V'], ['Rectangle / Ellipse / Arrow / Line', 'R / O / A / L'], ['Text', 'T'], ['Pan', 'Space + drag'], ['Zoom', 'Ctrl / Cmd + scroll'], ['Undo / Redo', 'Ctrl / Cmd + Z / Shift + Z'], ['Focus mode', 'F'], ['Delete selected object', 'Delete'], ['Save now', 'Ctrl / Cmd + S']].map(([name, key]) => <div key={name}><span>{name}</span><kbd>{key}</kbd></div>)}</div><p className="help-note">Notes are saved in this browser. Clearing site data removes them. Export a backup to keep a separate copy. Handwriting recognition, PDF import, 3D graphs, and cloud sync are planned for later milestones.</p><button className="button primary" onClick={close}>Back to thinking</button></dialog>;
}
