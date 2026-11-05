import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { ConflictError, LocalRepository, type Repository } from '../src/storage/repository';
import { Studio } from '../src/document/studio';
import { activeDocument, uid, type Workspace } from '../src/document/model';
import { seedWorkspace } from '../src/document/seed';

describe('Transactional persistence', () => {
  it('round-trips documents and rejects an older tab atomically', async () => {
    const repository = new LocalRepository('test-' + uid()), original = seedWorkspace();
    expect(await repository.write(original, 0)).toBe(1);
    const a = structuredClone(original), b = structuredClone(original);
    a.notebooks[0].title = 'Tab A'; b.notebooks[0].title = 'Tab B';
    const results = await Promise.allSettled([repository.write(a, 1), repository.write(b, 1)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect((await repository.read())?.revision).toBe(2);
    expect((await repository.read())?.workspace.notebooks[0].title).toBe('Tab A');
    await expect(repository.write(b, 1)).rejects.toBeInstanceOf(ConflictError);
  });
  it('preserves pages, undo/redo edits, and imports without replacing notes', async () => {
    const repository = new LocalRepository('test-' + uid()), studio = new Studio(repository);
    await studio.initialize();
    const first = activeDocument(studio.getSnapshot().workspace!).page;
    studio.updatePage(page => ({ ...page, title: 'Changed title' }));
    studio.undo(); expect(activeDocument(studio.getSnapshot().workspace!).page.title).toBe(first.title);
    studio.redo(); expect(activeDocument(studio.getSnapshot().workspace!).page.title).toBe('Changed title');
    studio.addPage('Second page');
    expect(studio.getSnapshot().canUndo).toBe(false);
    await studio.flush();
    const restored = new Studio(repository); await restored.initialize();
    expect(activeDocument(restored.getSnapshot().workspace!).page.title).toBe('Second page');
    const count = restored.getSnapshot().workspace!.notebooks.length;
    restored.importWorkspace(seedWorkspace());
    expect(restored.getSnapshot().workspace!.notebooks.length).toBe(count + 2);
    await restored.flush();
  });
  it('retains one page after removing the last page', async () => {
    const studio = new Studio(new LocalRepository('test-' + uid())); await studio.initialize();
    studio.addNotebook('Single page');
    studio.deletePage();
    expect(activeDocument(studio.getSnapshot().workspace!).notebook.pages).toHaveLength(1);
    expect(activeDocument(studio.getSnapshot().workspace!).page.title).toBe('First page');
    await studio.flush();
  });
});
describe('Save status and races', () => {
  function mockRepository() {
    let record = { revision: 1, workspace: seedWorkspace() };
    const repository: Repository = {
      read: vi.fn(async () => structuredClone(record)),
      write: vi.fn(async (workspace, revision) => { record = { revision: revision + 1, workspace: structuredClone(workspace) }; return record.revision; }),
    };
    return repository;
  }
  it('does not report saved when newer changes are waiting behind an in-flight save', async () => {
    const repository = mockRepository(), studio = new Studio(repository); await studio.initialize();
    let complete!: (revision: number) => void;
    vi.mocked(repository.write).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    studio.updatePage(p => ({ ...p, title: 'First edit' }));
    const saving = studio.flush();
    studio.updatePage(p => ({ ...p, title: 'Newer edit' }));
    complete(2); await saving;
    expect(studio.getSnapshot().status).toBe('unsaved');
    await studio.flush();
    expect(studio.getSnapshot().status).toBe('saved');
    expect(activeDocument((await repository.read())!.workspace).page.title).toBe('Newer edit');
  });
  it('never marks a failed save as saved and allows retry', async () => {
    const repository = mockRepository(), studio = new Studio(repository); await studio.initialize();
    vi.mocked(repository.write).mockRejectedValueOnce(new Error('Storage quota exceeded'));
    studio.updatePage(p => ({ ...p, title: 'Keep this change' })); await studio.flush();
    expect(studio.getSnapshot().status).toBe('error');
    expect(studio.getSnapshot().error).toContain('quota');
    expect(activeDocument(studio.getSnapshot().workspace!).page.title).toBe('Keep this change');
    await studio.flush(); expect(studio.getSnapshot().status).toBe('saved');
  });
  it('keeps unsaved work available after a revision conflict', async () => {
    const repository = mockRepository(), studio = new Studio(repository); await studio.initialize();
    vi.mocked(repository.write).mockRejectedValueOnce(new ConflictError());
    studio.updatePage(p => ({ ...p, title: 'Unsaved local idea' })); await studio.flush();
    expect(studio.getSnapshot().status).toBe('conflict');
    const before = vi.mocked(repository.write).mock.calls.length;
    await studio.flush(); expect(repository.write).toHaveBeenCalledTimes(before);
    expect(activeDocument(studio.getSnapshot().workspace!).page.title).toBe('Unsaved local idea');
  });
  it('preserves a conflict notification that arrives during a save', async () => {
    const repository = mockRepository(), studio = new Studio(repository); await studio.initialize();
    let complete!: (revision: number) => void;
    vi.mocked(repository.write).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    studio.updatePage(p => ({ ...p, title: 'In flight' })); const saving = studio.flush();
    studio.externalSave(3); complete(2); await saving;
    expect(studio.getSnapshot().status).toBe('conflict');
  });
  it('does not seed over unreadable existing storage', async () => {
    const repository: Repository = { read: vi.fn(async () => { throw new Error('Read failed'); }), write: vi.fn(async (_w: Workspace, r: number) => r + 1) };
    const studio = new Studio(repository); await studio.initialize();
    expect(studio.getSnapshot().workspace).toBeNull();
    expect(repository.write).not.toHaveBeenCalled();
    expect(studio.getSnapshot().status).toBe('error');
  });
});
