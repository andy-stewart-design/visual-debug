import s from './styles.module.css';

export default function SidebarInstructions() {
  return (
    <section>
      <h2 class={s.title}>How to inspect</h2>
      <ol class={s.instructions}>
        <li>Select an element on the page.</li>
        <li>Hold Option/Alt while hovering another element to measure.</li>
        <li>Press Escape on the page, or use Stop/Exit here, to finish.</li>
      </ol>
      <p class={s.hint}>Switching tabs does not start inspection automatically.</p>
    </section>
  );
}
