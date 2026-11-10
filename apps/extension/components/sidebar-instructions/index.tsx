import s from './styles.module.css';

export default function SidebarInstructions() {
  return (
    <section>
      <h2 class={s.title}>How to inspect</h2>
      <ol class={s.instructions}>
        <li>Use the toolbar button to authorize and start the current page.</li>
        <li>Click an element, then hold Option/Alt while hovering another to measure.</li>
        <li>Press Escape on the page, or use Stop/Exit here, to finish.</li>
      </ol>
      <p class={s.hint}>Switching tabs does not start inspection automatically. Return to the toolbar when this panel says it is unavailable.</p>
    </section>
  );
}
