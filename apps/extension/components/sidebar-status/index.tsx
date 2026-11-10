import type { Accessor } from 'solid-js';
import type { SidebarPresentation } from '../../lib/sidebar-state';
import s from './styles.module.css';

type SidebarStatusProps = {
  presentation: Accessor<SidebarPresentation>;
};

export default function SidebarStatus(props: SidebarStatusProps) {
  const presentation = () => props.presentation();
  return (
    <section>
      <div class={s.status} role="status" aria-live="polite">{presentation().statusLabel}</div>
      {presentation().error && <p class={s.error}>{presentation().error}</p>}
      {presentation().guidance && <p class={s.guidance}>{presentation().guidance}</p>}
    </section>
  );
}
