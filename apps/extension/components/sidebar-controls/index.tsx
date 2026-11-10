import s from './styles.module.css';

type SidebarControlsProps = {
  canStart: boolean;
  canStop: boolean;
  onStart: () => void;
  onStop: () => void;
};

export default function SidebarControls(props: SidebarControlsProps) {
  return (
    <div class={s.actions}>
      <button class={s.primary} type="button" onClick={props.onStart} disabled={!props.canStart}>
        Start/restart
      </button>
      <button class={s.secondary} type="button" onClick={props.onStop} disabled={!props.canStop}>
        Stop/Exit
      </button>
    </div>
  );
}
