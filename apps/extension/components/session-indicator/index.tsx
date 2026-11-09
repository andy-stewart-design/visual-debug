import s from './styles.module.css';

type SessionIndicatorProps = {
  onExit: () => void;
};

export default function SessionIndicator(props: SessionIndicatorProps) {
  return (
    <section class={s.indicator} aria-label="Inspection session">
      <p class={s.title}>Inspection session</p>
      <p class={s.copy}>Move over a page element, then click to select.</p>
      <p class={s.hint}>Press Escape to exit.</p>
      {/* Use a native listener here because delegated clicks stop at the isolated shadow root. */}
      <button class={s.exitButton} type="button" on:click={props.onExit}>
        Exit inspection
      </button>
    </section>
  );
}
