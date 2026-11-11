import type { Accessor } from 'solid-js';
import type { SidebarPresentation } from '../../lib/sidebar-state';
import s from './styles.module.css';

type SidebarControlsProps = {
  presentation: Accessor<SidebarPresentation>;
  connectionError: Accessor<string | undefined>;
  onStart: () => void;
  onStop: () => void;
  onRefresh: () => void;
};

export default function SidebarControls(props: SidebarControlsProps) {
  const presentation = () => props.presentation();
  const actions = () => presentation().actions;
  const isBusy = () => presentation().status === 'pending';
  const canToggle = () => actions().canStart || actions().canStop;

  return (
    <header class={s.header} aria-busy={isBusy()}>
      <label class={s.toggle}>
        <input
          type="checkbox"
          checked={presentation().status === 'active'}
          disabled={isBusy() || !canToggle()}
          onChange={(event) => {
            if (event.currentTarget.checked) props.onStart();
            else props.onStop();
          }}
        />
        <span>Active</span>
        {isBusy() && <span class={s.loading} aria-label="Loading" />}
      </label>

      {presentation().error && <p class={s.error} role="alert">{presentation().error}</p>}
      {presentation().guidance && <p class={s.guidance}>{presentation().guidance}</p>}
      {props.connectionError() && (
        <button
          class={s.retry}
          type="button"
          onClick={props.onRefresh}
          disabled={!actions().canRefresh}
        >
          Retry
        </button>
      )}
    </header>
  );
}
