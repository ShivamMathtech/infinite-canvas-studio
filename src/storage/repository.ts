import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { WorkspaceSchema, type Workspace } from '../document/model';
export type RecordData = { revision: number; workspace: Workspace };
interface CanvasDB extends DBSchema { workspace: { key: string; value: RecordData } }
export class ConflictError extends Error {
  constructor() { super('Another tab saved newer notes. Export your work, then load the latest version.'); }
}
export interface Repository {
  read(): Promise<RecordData | undefined>;
  write(workspace: Workspace, expectedRevision: number): Promise<number>;
}
export class LocalRepository implements Repository {
  private database?: Promise<IDBPDatabase<CanvasDB>>;
  constructor(private name = 'infinite-canvas-studio-v1') {}
  private db() {
    return this.database ??= openDB<CanvasDB>(this.name, 1, { upgrade(db) { db.createObjectStore('workspace'); } });
  }
  async read() {
    const record = await (await this.db()).get('workspace', 'current');
    if (record) return { ...record, workspace: WorkspaceSchema.parse(record.workspace) };
  }
  async write(workspace: Workspace, expectedRevision: number) {
    const db = await this.db();
    const tx = db.transaction('workspace', 'readwrite');
    const current = await tx.store.get('current');
    if ((current?.revision ?? 0) !== expectedRevision) {
      tx.abort();
      await tx.done.catch(() => undefined);
      throw new ConflictError();
    }
    const revision = expectedRevision + 1;
    await tx.store.put({ workspace, revision }, 'current');
    await tx.done;
    return revision;
  }
}
