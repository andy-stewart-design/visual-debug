import { For, Show, type Accessor } from 'solid-js';
import { createMeasurementLayout } from '../../lib/measurement';
import type { SelectionState } from '../../lib/selection';
import s from './styles.module.css';

type MeasurementOverlayProps = {
  selection: Accessor<SelectionState>;
  held: Accessor<boolean>;
};

export default function MeasurementOverlay(props: MeasurementOverlayProps) {
  const layout = () => {
    const current = props.selection();
    if (!props.held() || !current.anchor || !current.hover) return undefined;
    return createMeasurementLayout(current.anchor.box, current.hover.box, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
  };

  return (
    <Show when={layout()}>
      {(measurement) => (
        <>
          <svg class={s.lines} aria-hidden="true">
            <For each={measurement().lines}>
              {(line) => (
                <>
                  <line
                    class={s.line}
                    x1={line.start.x}
                    y1={line.start.y}
                    x2={line.end.x}
                    y2={line.end.y}
                  />
                  <circle class={s.endpoint} cx={line.start.x} cy={line.start.y} r="2" />
                  <circle class={s.endpoint} cx={line.end.x} cy={line.end.y} r="2" />
                </>
              )}
            </For>
          </svg>
          <For each={measurement().labels}>
            {(label) => (
              <div
                class={s.label}
                aria-hidden="true"
                style={{ left: `${label.position.x}px`, top: `${label.position.y}px` }}
              >
                {label.text}
              </div>
            )}
          </For>
        </>
      )}
    </Show>
  );
}
