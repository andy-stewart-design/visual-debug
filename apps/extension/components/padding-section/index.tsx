import { createEffect, createSignal, type Accessor } from 'solid-js';
import type { StyleEditResponse } from '../../lib/inspection-protocol';
import type { PaddingValues } from '../../lib/style-edit';
import { parsePaddingInput, adjustPaddingValue } from '../../lib/style-edit';
import { paddingTargetKey, type PaddingTarget } from '../../lib/padding-target';
import type { SidebarPresentation } from '../../lib/sidebar-state';
import {
  choosePaddingMode,
  paddingFields,
  paddingGroupText,
  PADDING_MODE_LABELS,
  type PaddingField,
  type PaddingMode,
} from '../../lib/padding-group';
import {
  isPaddingPreviewActive,
  updatePaddingPreviewInteraction,
  type PaddingPreviewInteraction,
} from '../../lib/padding-preview-interaction';
import s from './styles.module.css';

type PaddingSectionProps = {
  presentation: Accessor<SidebarPresentation>;
  onPreview: (visible: boolean) => void;
  onEdit: (sides: PaddingValues) => string | undefined;
  editAck: Accessor<StyleEditResponse | undefined>;
};

type Drafts = Partial<Record<PaddingField, string>>;
type PendingEdit = {
  editId: string;
  targetKey: string;
  text: string;
};

type PendingEdits = Partial<Record<PaddingField, PendingEdit>>;

export default function PaddingSection(props: PaddingSectionProps) {
  const presentation = () => props.presentation();
  const selection = () => {
    const view = presentation().view;
    return view?.selection ?? view?.state?.selection;
  };
  const enabled = () =>
    presentation().status === 'active' && selection() !== undefined;
  const [interaction, setInteraction] = createSignal<PaddingPreviewInteraction>(
    { hovered: false, focused: false },
  );
  const [mode, setMode] = createSignal<PaddingMode>('independent');
  const [drafts, setDrafts] = createSignal<Drafts>({});
  const [pending, setPending] = createSignal<PendingEdits>({});
  const active = () => isPaddingPreviewActive(interaction());
  const target = (): PaddingTarget | undefined => {
    const view = presentation().view;
    const current = view?.selection ?? view?.state?.selection;
    if (view?.tabId === undefined || view.state === undefined || current === undefined) return undefined;
    return {
      tabId: view.tabId,
      documentId: view.state.identity.documentId,
      selectionId: current.selectionId,
    };
  };
  const currentTargetKey = () => paddingTargetKey(target());
  let lastTargetKey: string | undefined;

  createEffect(() => {
    const current = selection();
    const key = currentTargetKey();
    if (key !== lastTargetKey) {
      lastTargetKey = key;
      setDrafts({});
      setPending({});
      if (current) setMode(choosePaddingMode(current.computedStyle.padding));
    }
  });

  createEffect(() => {
    const ack = props.editAck();
    if (!ack) return;
    const ackKey = paddingTargetKey({
      tabId: ack.tabId,
      documentId: ack.documentId,
      selectionId: ack.selectionId,
    });
    const entries = Object.entries(pending());
    const match = entries.find(([, value]) => value?.editId === ack.editId && value.targetKey === ackKey);
    if (!match || currentTargetKey() !== ackKey) return;
    const [fieldKey, currentPending] = match as [PaddingField, PendingEdit];

    // A late acknowledgement cannot clear a newer edit for this field. A
    // response from a mode that is no longer selected is ignored because mode
    // changes retire the pending entry above.
    setPending((current) => {
      const next = { ...current };
      if (next[fieldKey]?.editId === ack.editId) delete next[fieldKey];
      return next;
    });
    setDrafts((current) => {
      if (current[fieldKey] !== currentPending.text) return current;
      const next = { ...current };
      delete next[fieldKey];
      return next;
    });
  });

  createEffect(() => {
    props.onPreview(active() && enabled());
  });

  const field = (key: PaddingField) => paddingFields(mode()).find((item) => item.key === key);
  const confirmed = (key: PaddingField) => {
    if (!enabled()) return '';
    const current = selection();
    const item = field(key);
    return current && item ? paddingGroupText(current.computedStyle.padding, item.sides) : '';
  };
  const shown = (key: PaddingField) => drafts()[key] ?? confirmed(key);
  const sidesFor = (key: PaddingField, value: number): PaddingValues => {
    const item = field(key);
    if (!item) return {};
    return Object.fromEntries(item.sides.map((side) => [side, value])) as PaddingValues;
  };
  const send = (key: PaddingField, text: string) => {
    setDrafts((current) => ({ ...current, [key]: text }));
    const value = parsePaddingInput(text);
    if (value === undefined || !enabled()) return;
    const sides = sidesFor(key, value);
    if (Object.keys(sides).length === 0) return;
    const editId = props.onEdit(sides);
    const editTarget = target();
    const editTargetKey = paddingTargetKey(editTarget);
    if (editId && editTargetKey !== undefined) {
      setPending((current) => ({
        ...current,
        [key]: { editId, targetKey: editTargetKey, text },
      }));
    }
  };
  const normalize = (key: PaddingField, input: HTMLInputElement) => {
    input.value = confirmed(key);
    setDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  const changeMode = (next: PaddingMode) => {
    setMode(next);
    // Drafts from a previous grouping no longer describe the visible fields.
    // Retiring their acknowledgements prevents a late response from restoring
    // an obsolete draft or changing the selected mode.
    setDrafts({});
    setPending({});
  };

  return (
    <section
      class={s.section}
      aria-labelledby="padding-heading"
      onPointerEnter={() =>
        setInteraction((state) =>
          updatePaddingPreviewInteraction(state, { type: 'pointer-enter' }),
        )
      }
      onPointerLeave={() =>
        setInteraction((state) =>
          updatePaddingPreviewInteraction(state, { type: 'pointer-leave' }),
        )
      }
      onFocusIn={() =>
        setInteraction((state) =>
          updatePaddingPreviewInteraction(state, { type: 'focus-enter' }),
        )
      }
      onFocusOut={(event) => {
        const current = event.currentTarget;
        const next = event.relatedTarget;
        const stillWithin =
          current instanceof Element && next instanceof Node && current.contains(next);
        setInteraction((state) =>
          updatePaddingPreviewInteraction(state, { type: 'focus-leave', stillWithin }),
        );
        if (event.target instanceof HTMLInputElement) {
          normalize(event.target.getAttribute('data-field') as PaddingField, event.target);
        }
      }}
    >
      <div class={s.headingRow}>
        <h2 id="padding-heading" class={s.heading}>Padding</h2>
        <label class={s.modeField}>
          <span>Mode</span>
          <select
            aria-label="Padding editing mode"
            disabled={!enabled()}
            value={mode()}
            onChange={(event) => changeMode(event.currentTarget.value as PaddingMode)}
          >
            {(Object.keys(PADDING_MODE_LABELS) as PaddingMode[]).map((value) => (
              <option value={value}>{PADDING_MODE_LABELS[value]}</option>
            ))}
          </select>
        </label>
      </div>
      <div class={s.grid}>
        {paddingFields(mode()).map((item) => (
          <label class={s.field}>
            <span>{item.label}</span>
            <input
              type="number"
              min="0"
              step="any"
              data-field={item.key}
              aria-label={`Padding ${item.label}`}
              disabled={!enabled()}
              value={shown(item.key)}
              placeholder="Mixed"
              onInput={(event) => send(item.key, event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                  event.preventDefault();
                  const next = adjustPaddingValue(
                    event.currentTarget.value,
                    event.key === 'ArrowUp' ? 1 : -1,
                  );
                  if (next !== undefined) send(item.key, String(next));
                } else if (event.key === 'Enter') {
                  event.preventDefault();
                  normalize(item.key, event.currentTarget);
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
