import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { Page } from '../document/model';
import { fitView } from '../canvas/geometry';
import { drawPage } from '../canvas/render';

export function IconButton({ label, active, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; children: ReactNode }) {
  return <button type="button" className={'icon-button ' + (active ? 'active ' : '') + className} aria-label={label} title={label} aria-pressed={active} {...rest}>{children}</button>;
}
export function PageThumbnail({ page }: { page: Page }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    const render = () => {
      if (!live || !ref.current) return;
      const canvas = ref.current, ctx = canvas.getContext('2d')!;
      canvas.width = 360; canvas.height = 224;
      drawPage(ctx, page, fitView(page, 360, 224), 360, 224);
    };
    render(); void document.fonts.ready.then(render);
    return () => { live = false; };
  }, [page]);
  return <canvas className="page-thumbnail" ref={ref} aria-hidden="true" />;
}
export type DialogSpec = {
  title: string; description?: string; initial?: string; multiline?: boolean;
  confirm?: boolean; danger?: boolean; submit?: string; maxLength?: number;
  onSubmit: (value: string) => void;
};
export function Dialog({ spec, close }: { spec: DialogSpec; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); ref.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')?.focus(); }, []);
  return <dialog ref={ref} className="dialog" aria-label={spec.title} onCancel={close} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <form onSubmit={event => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get('value') ?? '').trim(); if (!spec.confirm && !value) return; spec.onSubmit(value); close(); }}>
      <div className="dialog-top"><h2>{spec.title}</h2><IconButton label="Close dialog" onClick={close}><X size={19} /></IconButton></div>
      {spec.description && <p>{spec.description}</p>}
      {!spec.confirm && <label className="dialog-field"><span>{spec.multiline ? 'Your text' : 'Name'}</span>{spec.multiline
        ? <textarea name="value" defaultValue={spec.initial} maxLength={spec.maxLength ?? 1000} required autoFocus rows={5} />
        : <input name="value" defaultValue={spec.initial} maxLength={spec.maxLength ?? 100} required autoFocus onFocus={event => event.target.select()} />
      }</label>}
      <div className="dialog-actions"><button type="button" className="button secondary" onClick={close}>Cancel</button><button className={'button ' + (spec.danger ? 'danger' : 'primary')} type="submit">{spec.submit ?? 'Save'}</button></div>
    </form>
  </dialog>;
}
