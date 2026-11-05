import { activeDocument, newPage, uid, WorkspaceSchema, type Page, type Workspace } from './model';
import { History } from './history';
import { seedWorkspace } from './seed';
import { ConflictError, type Repository } from '../storage/repository';

export type SaveStatus = 'loading' | 'unsaved' | 'saving' | 'saved' | 'error' | 'conflict';
export type Snapshot = { workspace: Workspace | null; status: SaveStatus; error: string; canUndo: boolean; canRedo: boolean };

export class Studio {
  private state: Snapshot = { workspace: null, status: 'loading', error: '', canUndo: false, canRedo: false };
  private listeners = new Set<() => void>();
  private histories = new Map<string, History<Page>>();
  private revision = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private saving = false;
  private initialized?: Promise<void>;
  constructor(private repository: Repository, private onSave?: (revision: number) => void) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private emit(update: Partial<Snapshot>) {
    this.state = { ...this.state, ...update };
    const history = this.state.workspace && this.histories.get(this.state.workspace.activePageId);
    this.state = { ...this.state, canUndo: history?.canUndo ?? false, canRedo: history?.canRedo ?? false };
    this.listeners.forEach(l => l());
  }
  initialize = () => this.initialized ??= this.load();
  private async load() {
    try {
      const record = await this.repository.read();
      this.revision = record?.revision ?? 0;
      this.emit({ workspace: record?.workspace ?? seedWorkspace(), status: record ? 'saved' : 'unsaved', error: '' });
      if (!record) await this.flush();
    } catch (error) {
      this.emit({ status: 'error', error: 'Could not open your local notes. Nothing has been overwritten. ' + errorText(error) });
    }
  }
  reload = async () => {
    if (this.saving) throw new Error('Wait for the current save to finish before reloading.');
    clearTimeout(this.timer);
    this.histories.clear();
    await this.load();
  };
  private change(workspace: Workspace) {
    const blocked = this.state.status === 'conflict';
    this.emit({ workspace, status: blocked ? 'conflict' : 'unsaved', error: blocked ? this.state.error : '' });
    clearTimeout(this.timer);
    if (!blocked) this.timer = setTimeout(() => void this.flush(), 250);
  }
  flush = async () => {
    clearTimeout(this.timer);
    if (this.saving || !this.state.workspace || this.state.status === 'saved' || this.state.status === 'conflict') return;
    const workspace = this.state.workspace;
    this.saving = true;
    this.emit({ status: 'saving', error: '' });
    try {
      this.revision = await this.repository.write(workspace, this.revision);
      if (this.getSnapshot().status !== 'conflict') this.emit({ status: this.state.workspace === workspace ? 'saved' : 'unsaved' });
      this.onSave?.(this.revision);
    } catch (error) {
      this.emit({ status: error instanceof ConflictError ? 'conflict' : 'error', error: errorText(error) });
    } finally {
      this.saving = false;
      if (this.state.status === 'unsaved') this.timer = setTimeout(() => void this.flush(), 0);
    }
  };
  externalSave = (revision: number) => {
    if (revision > this.revision && this.state.workspace) this.emit({ status: 'conflict', error: new ConflictError().message });
  };
  private history(id: string) {
    if (!this.histories.has(id)) this.histories.set(id, new History<Page>());
    return this.histories.get(id)!;
  }
  updatePage = (updater: (page: Page) => Page, record = true) => {
    const workspace = this.state.workspace;
    if (!workspace) return;
    const { notebook, page } = activeDocument(workspace);
    const next = updater(page);
    if (next === page) return;
    if (record) this.history(page.id).record(page);
    this.change({ ...workspace, notebooks: workspace.notebooks.map(b => b.id === notebook.id ? { ...b, pages: b.pages.map(p => p.id === page.id ? next : p) } : b) });
  };
  undo = () => {
    if (!this.state.workspace) return;
    const { page } = activeDocument(this.state.workspace);
    this.updatePage(() => this.history(page.id).undo(page), false);
  };
  redo = () => {
    if (!this.state.workspace) return;
    const { page } = activeDocument(this.state.workspace);
    this.updatePage(() => this.history(page.id).redo(page), false);
  };
  navigate = (notebookId: string, pageId?: string) => {
    const workspace = this.state.workspace!;
    const notebook = workspace.notebooks.find(b => b.id === notebookId);
    if (!notebook) return;
    this.change({ ...workspace, activeNotebookId: notebook.id, activePageId: notebook.pages.find(p => p.id === pageId)?.id ?? notebook.pages[0].id });
  };
  addPage = (title: string) => {
    const workspace = this.state.workspace!;
    const page = newPage(title);
    this.change({ ...workspace, activePageId: page.id, notebooks: workspace.notebooks.map(b => b.id === workspace.activeNotebookId ? { ...b, pages: [...b.pages, page] } : b) });
  };
  addNotebook = (title: string) => {
    const workspace = this.state.workspace!, page = newPage('First page'), id = uid();
    this.change({ ...workspace, activeNotebookId: id, activePageId: page.id, notebooks: [...workspace.notebooks, { id, title, pages: [page], sample: false, color: '#5aac9b' }] });
  };
  renameNotebook = (title: string) => {
    const workspace = this.state.workspace!;
    this.change({ ...workspace, notebooks: workspace.notebooks.map(b => b.id === workspace.activeNotebookId ? { ...b, title } : b) });
  };
  duplicatePage = () => {
    const workspace = this.state.workspace!, { page, notebook } = activeDocument(workspace);
    const duplicate: Page = { ...structuredClone(page), id: uid(), title: (page.title + ' (copy)').slice(0, 100), objects: page.objects.map(o => ({ ...structuredClone(o), id: uid() })) };
    const index = notebook.pages.findIndex(p => p.id === page.id);
    const pages = [...notebook.pages.slice(0, index + 1), duplicate, ...notebook.pages.slice(index + 1)];
    this.change({ ...workspace, activePageId: duplicate.id, notebooks: workspace.notebooks.map(b => b.id === notebook.id ? { ...b, pages } : b) });
  };
  deletePage = () => {
    const workspace = this.state.workspace!, { notebook, page } = activeDocument(workspace);
    const pages = notebook.pages.filter(p => p.id !== page.id);
    if (!pages.length) pages.push(newPage('First page'));
    this.histories.delete(page.id);
    this.change({ ...workspace, activePageId: pages[0].id, notebooks: workspace.notebooks.map(b => b.id === notebook.id ? { ...b, pages } : b) });
  };
  importWorkspace = (imported: Workspace) => {
    const workspace = this.state.workspace!;
    const notebooks = imported.notebooks.map(b => ({ ...b, id: uid(), title: b.title.slice(0, 88) + ' (imported)', sample: false, pages: b.pages.map(p => ({ ...p, id: uid(), objects: p.objects.map(o => ({ ...o, id: uid() })) })) }));
    const combined = { ...workspace, notebooks: [...workspace.notebooks, ...notebooks], activeNotebookId: notebooks[0].id, activePageId: notebooks[0].pages[0].id };
    if (!WorkspaceSchema.safeParse(combined).success) throw new Error('The combined workspace exceeds the supported size. Your existing notebooks have not changed.');
    this.change(combined);
  };
}
function errorText(error: unknown) { return error instanceof Error ? error.message : 'An unexpected storage error occurred.'; }
