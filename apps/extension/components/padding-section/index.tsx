import { createEffect, createSignal, type Accessor } from 'solid-js';
import type { StyleEditResponse } from '../../lib/inspection-protocol';
import type { PaddingSide } from '../../lib/style-edit';
import { parsePaddingInput, adjustPaddingValue } from '../../lib/style-edit';
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
  onEdit: (side: PaddingSide, value: number) => string | undefined;
  editAck: Accessor<StyleEditResponse | undefined>;
};

const sides = ['top', 'right', 'bottom', 'left'] as const;
type Drafts = Partial<Record<PaddingSide, string>>;
type PendingEdit = { editId: string; tabId: number; documentId: string; selectionId: string; text: string };

export default function PaddingSection(props: PaddingSectionProps) {
  const presentation = () => props.presentation();
  const selection = () => presentation().view?.selection;
  const enabled = () => presentation().status === 'active' && selection() !== undefined;
  const [interaction, setInteraction] = createSignal<PaddingPreviewInteraction>({ hovered: false, focused: false });
  const [drafts, setDrafts] = createSignal<Drafts>({});
  const [pending, setPending] = createSignal<Partial<Record<PaddingSide, PendingEdit>>>({});
  let lastSelectionId: string | undefined;
  const active = () => isPaddingPreviewActive(interaction());

  createEffect(() => {
    const id = selection()?.selectionId;
    if (id !== lastSelectionId) {
      lastSelectionId = id;
      setDrafts({});
      setPending({});
    }
  });

  createEffect(() => {
    const ack = props.editAck();
    const currentPending = ack ? pending()[ack.side] : undefined;
    const currentView = presentation().view;
    const currentState = currentView?.state;
    const currentSelection = currentView?.selection ?? currentState?.selection;
    if (!ack || !currentPending || currentPending.editId !== ack.editId ||
      currentPending.tabId !== ack.tabId || currentPending.documentId !== ack.documentId ||
      currentPending.selectionId !== ack.selectionId || !currentView ||
      currentView.tabId !== ack.tabId || currentState?.identity.documentId !== ack.documentId ||
      (currentView.status === 'active' && currentSelection?.selectionId !== ack.selectionId)) return;
    // A late acknowledgement cannot clear a newer edit for the same side.
    const sentText = currentPending.text;
    setPending((current) => {
      const next = { ...current };
      delete next[ack.side];
      return next;
    });
    if (!ack.ok && sentText !== undefined) {
      // Restore the acknowledged value after a rejection, unless the user has
      // already typed a newer value (including an unfinished one).
      setDrafts((current) => {
        if (current[ack.side] !== sentText) return current;
        const next = { ...current };
        delete next[ack.side];
        return next;
      });
    }
  });

  createEffect(() => {
    // Re-issue while active so a selection/document change follows the
    // current sidebar view without putting the transient intent in state.
    props.onPreview(active() && enabled());
  });

  const confirmed = (side: PaddingSide) => {
    if (!enabled()) return '';
    const value = selection()?.computedStyle.padding[side] ?? '';
    return value.trim().replace(/px$/i, '');
  };
  const shown = (side: PaddingSide) => drafts()[side] ?? confirmed(side);
  const send = (side: PaddingSide, text: string) => {
    setDrafts((current) => ({ ...current, [side]: text }));
    const value = parsePaddingInput(text);
    if (value !== undefined && enabled()) {
      const editId = props.onEdit(side, value);
      const target = presentation().view;
      const targetState = target?.state;
      const targetSelection = target?.selection ?? targetState?.selection;
      if (editId && target?.tabId !== undefined && targetState && targetSelection) {
        setPending((current) => ({ ...current, [side]: {
          editId, tabId: target.tabId, documentId: targetState.identity.documentId,
          selectionId: targetSelection.selectionId, text,
        } }));
      }
    }
  };
  const normalize = (side: PaddingSide, input: HTMLInputElement) => {
    input.value = confirmed(side);
    setDrafts((current) => {
      const next = { ...current };
      delete next[side];
      return next;
    });
  };

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
        if (event.target instanceof HTMLInputElement) normalize(event.target.getAttribute('data-side') as PaddingSide, event.target);
      }}
    >
      <h2 id="padding-heading" class={s.heading}>Padding</h2>
      <div class={s.grid}>
        {sides.map((side) => (
          <label class={s.field}>
            <span>{side}</span>
            <input
              type="number"
              min="0"
              step="any"
              data-side={side}
              aria-label={`Padding ${side}`}
              disabled={!enabled()}
              value={shown(side)}
              onInput={(event) => send(side, event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                  // The number input's native step must not run for an
                  // unfinished/invalid draft. The pure helper below decides
                  // whether there is a value we can send.
                  event.preventDefault();
                  const next = adjustPaddingValue(event.currentTarget.value, event.key === 'ArrowUp' ? 1 : -1);
                  if (next !== undefined) send(side, String(next));
                } else if (event.key === 'Enter') {
                  event.preventDefault();
                  normalize(side, event.currentTarget);
                  event.currentTarget.blur();
                }
              }}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
