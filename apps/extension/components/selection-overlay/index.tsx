import { Show, type Accessor } from 'solid-js';
import type { SelectionState } from '../../lib/selection';
import s from './styles.module.css';

type SelectionOverlayProps = {
  selection: Accessor<SelectionState>;
  held: Accessor<boolean>;
};

export default function SelectionOverlay(props: SelectionOverlayProps) {
  const isMeasuring = () => props.held() && Boolean(props.selection().anchor && props.selection().hover);

  return (
    <>
      <Show when={props.selection().anchor}>
        {(anchor) => (
          <div
            class={`${s.outline} ${s.anchor} ${isMeasuring() ? s.measuring : ''}`}
            aria-hidden="true"
            style={{
              left: `${anchor().box.left}px`,
              top: `${anchor().box.top}px`,
              width: `${anchor().box.width}px`,
              height: `${anchor().box.height}px`,
            }}
          />
        )}
      </Show>
      <Show when={props.selection().hover}>
        {(hover) => (
          <div
            class={`${s.outline} ${s.hover} ${isMeasuring() ? s.measuring : ''}`}
            aria-hidden="true"
            style={{
              left: `${hover().box.left}px`,
              top: `${hover().box.top}px`,
              width: `${hover().box.width}px`,
              height: `${hover().box.height}px`,
            }}
          />
        )}
      </Show>
    </>
  );
}
