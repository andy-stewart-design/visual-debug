import type { Accessor } from 'solid-js';
import type { SidebarView } from '../../lib/sidebar-controller';
import s from './styles.module.css';

type SidebarStatusProps = {
  view: Accessor<SidebarView | undefined>;
  connectionError: Accessor<string | undefined>;
};

function statusLabel(view: SidebarView | undefined): string {
  if (view === undefined) return 'Waiting for the sidebar connection…';
  switch (view.status) {
    case 'active': return 'Inspection active';
    case 'inactive': return 'Inspection is stopped';
    case 'pending': return 'Working…';
    case 'unavailable': return 'Inspection unavailable';
    case 'error': return 'Inspection error';
    default: return 'Inspection status unavailable';
  }
}

export default function SidebarStatus(props: SidebarStatusProps) {
  return (
    <section>
      <div class={s.status} role="status" aria-live="polite">{statusLabel(props.view())}</div>
      {props.view()?.error && <p class={s.error}>{props.view()?.error}</p>}
      {props.connectionError() && <p class={s.error}>{props.connectionError()}</p>}
    </section>
  );
}
