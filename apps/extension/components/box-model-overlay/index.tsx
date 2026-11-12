import { Show, type Accessor } from 'solid-js';
import type { PaddingPreview } from '../../lib/session';
import type { SelectionState } from '../../lib/selection';
import { createPaddingPreviewGeometry, createPaddingPreviewPath } from '../../lib/box-model-preview';
import s from './styles.module.css';

type BoxModelOverlayProps = {
  selection: Accessor<SelectionState>;
  preview: Accessor<PaddingPreview | undefined>;
  getAnchor: () => Element | undefined;
};

export default function BoxModelOverlay(props: BoxModelOverlayProps) {
  const geometry = () => {
    const current = props.selection().anchor;
    const intent = props.preview();
    const target = props.getAnchor();
    if (!current || !intent || current.selectionId !== intent.selectionId || !target) return undefined;
    const value = createPaddingPreviewGeometry(target);
    if (!value || (value.outer.width === 0 && value.outer.height === 0)) return undefined;
    const { outer, content } = value;
    if (outer.left === content.left && outer.top === content.top &&
      outer.width === content.width && outer.height === content.height) return undefined;
    return value;
  };

  return (
    <Show when={geometry()} keyed>
      {(value) => {
        const outer = value.outer;
        const path = createPaddingPreviewPath(value);
        return (
          <svg
            class={s.region}
            aria-hidden="true"
            viewBox={`0 0 ${outer.width} ${outer.height}`}
            preserveAspectRatio="none"
            style={{
              left: `${outer.left}px`,
              top: `${outer.top}px`,
              width: `${outer.width}px`,
              height: `${outer.height}px`,
            }}
          >
            <path d={path} fill-rule="evenodd" />
          </svg>
        );
      }}
    </Show>
  );
}
