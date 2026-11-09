import { createSignal, type Accessor } from 'solid-js';

export type SelectionBox = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

export type SelectionSnapshot = {
  readonly box: SelectionBox;
  readonly tagName: string;
};

export type SelectionState = {
  readonly anchor?: SelectionSnapshot;
  readonly hover?: SelectionSnapshot;
};

export type SelectionController = {
  readonly state: Accessor<SelectionState>;
  setHover: (target: Element | undefined) => void;
  select: (target: Element) => void;
  clearHover: () => void;
  refresh: () => void;
  dispose: () => void;
};

function readSnapshot(target: Element | undefined): SelectionSnapshot | undefined {
  if (!target || !target.isConnected || target.ownerDocument !== document) return undefined;

  const rect = target.getBoundingClientRect();
  if (
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.top) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return undefined;
  }

  return {
    box: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
    tagName: target.tagName.toLowerCase(),
  };
}

export function createSelectionController(): SelectionController {
  const [state, setState] = createSignal<SelectionState>({});
  let anchor: Element | undefined;
  let hover: Element | undefined;
  let disposed = false;

  const publish = () => {
    if (disposed) return;
    const anchorSnapshot = readSnapshot(anchor);
    const hoverSnapshot = hover && hover !== anchor ? readSnapshot(hover) : undefined;

    if (anchor && !anchorSnapshot) anchor = undefined;
    if (hover && (!hoverSnapshot || hover === anchor)) hover = undefined;

    setState({
      anchor: anchorSnapshot,
      hover: hover && hover !== anchor ? readSnapshot(hover) : undefined,
    });
  };

  return {
    state,
    setHover(target) {
      if (disposed) return;
      hover = target && target !== anchor ? target : undefined;
      publish();
    },
    select(target) {
      if (disposed) return;
      anchor = target;
      hover = hover === target ? undefined : hover;
      publish();
    },
    clearHover() {
      if (disposed) return;
      hover = undefined;
      publish();
    },
    refresh: publish,
    dispose() {
      if (disposed) return;
      disposed = true;
      anchor = undefined;
      hover = undefined;
      setState({});
    },
  };
}
