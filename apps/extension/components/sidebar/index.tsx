import type { ParentProps } from 'solid-js';
import s from './styles.module.css';

export default function Sidebar(props: ParentProps) {
  return (
    <main class={s.shell}>
      <h1 class={s.title}>Visual Debug</h1>
      {props.children}
    </main>
  );
}
