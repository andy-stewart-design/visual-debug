import { createEffect, createSignal, type Accessor } from 'solid-js';
import type { SidebarPresentation } from '../../lib/sidebar-state';
import {
  isPaddingPreviewActive,
  updatePaddingPreviewInteraction,
  type PaddingPreviewInteraction,
} from '../../lib/padding-preview-interaction';
import s from './styles.module.css';

type PaddingSectionProps = {
  presentation: Accessor<SidebarPresentation>;
  onPreview: (visible: boolean) => void;
};

const sides = ['top', 'right', 'bottom', 'left'] as const;

export default function PaddingSection(props: PaddingSectionProps) {
  const presentation = () => props.presentation();
  const selection = () => presentation().view?.selection;
  const enabled = () => presentation().status === 'active' && selection() !== undefined;
  const [interaction, setInteraction] = createSignal<PaddingPreviewInteraction>({ hovered: false, focused: false });
  const active = () => isPaddingPreviewActive(interaction());

  createEffect(() => {
    // Re-issue while active so a selection/document change follows the
    // current sidebar view without putting the transient intent in state.
    props.onPreview(active() && enabled());
  });

  return (
    <section
      class={s.section}
      aria-labelledby="padding-heading"
      onPointerEnter={() => setInteraction((state) => updatePaddingPreviewInteraction(state, { type: 'pointer-enter' }))}
      onPointerLeave={() => setInteraction((state) => updatePaddingPreviewInteraction(state, { type: 'pointer-leave' }))}
      onFocusIn={() => setInteraction((state) => updatePaddingPreviewInteraction(state, { type: 'focus-enter' }))}
      onFocusOut={(event) => {
        const current = event.currentTarget;
        const next = event.relatedTarget;
        const stillWithin = current instanceof Element && next instanceof Node && current.contains(next);
        setInteraction((state) => updatePaddingPreviewInteraction(state, { type: 'focus-leave', stillWithin }));
      }}
    >
      <h2 id="padding-heading" class={s.heading}>Padding</h2>
      <div class={s.grid}>
        {sides.map((side) => (
          <label class={s.field}>
            <span>{side}</span>
            <input
              type="text"
              aria-label={`Padding ${side}`}
              readOnly
              disabled={!enabled()}
              value={enabled() ? selection()?.computedStyle.padding[side] ?? '' : ''}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
