export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(private limit = 80) {}
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  record(previous: T) {
    this.past.push(previous);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo(current: T) {
    const previous = this.past.pop();
    if (previous === undefined) return current;
    this.future.push(current);
    return previous;
  }
  redo(current: T) {
    const next = this.future.pop();
    if (next === undefined) return current;
    this.past.push(current);
    return next;
  }
}
