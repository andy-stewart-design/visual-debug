import type { Accessor } from 'solid-js';
import type { SidebarActions } from '../../lib/sidebar-state';
import s from './styles.module.css';

type SidebarControlsProps = {
  actions: Accessor<SidebarActions>;
  onStart: () => void;
  onStop: () => void;
  onRefresh: () => void;
};

export default function SidebarControls(props: SidebarControlsProps) {
  const actions = () => props.actions();
  return (
    <div class={s.actions}>
      <button class={s.primary} type="button" onClick={props.onStart} disabled={!actions().canStart}>
        {actions().startLabel}
      </button>
      <button class={s.secondary} type="button" onClick={props.onStop} disabled={!actions().canStop}>
        {actions().stopLabel}
      </button>
      <button class={s.refresh} type="button" onClick={props.onRefresh} disabled={!actions().canRefresh}>
        {actions().refreshLabel}
      </button>
    </div>
  );
}
