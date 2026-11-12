import type { ParentProps } from 'solid-js';
import s from './styles.module.css';

export default function Sidebar(props: ParentProps) {
  return (
    <main class={s.shell}>
      {props.children}
    </main>
  );
}
