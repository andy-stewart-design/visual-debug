import { createSignal, type Accessor } from 'solid-js';
import type { ElementSnapshot } from './element-snapshot';

export type SelectionBox = ElementSnapshot['box'];
export type SelectionSnapshot = ElementSnapshot;

export type SelectionState = {
  readonly anchor?: SelectionSnapshot;
  readonly hover?: SelectionSnapshot;
};

export type SelectionTargets = Readonly<{
  readonly anchor?: Element;
  readonly hover?: Element;
}>;

type TargetListener = (targets: SelectionTargets) => void;
type SelectionListener = (snapshot: SelectionSnapshot | undefined) => void;

export type SelectionController = {
  readonly state: Accessor<SelectionState>;
  /** Runtime-only target seam for tracking; UI consumers receive snapshots only. */
  readonly getTargets: () => SelectionTargets;
  readonly subscribeTargets: (listener: TargetListener) => () => void;
  /** Notifies only when the selected anchor snapshot changes. */
  readonly subscribeSelection: (listener: SelectionListener) => () => void;
  setHover: (target: Element | undefined) => void;
  select: (target: Element) => void;
  clearHover: () => void;
  refresh: () => void;
  dispose: () => void;
};

function readSnapshot(target: Element | undefined, getSelectionId: (target: Element) => string): SelectionSnapshot | undefined {
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

  const style = getComputedStyle(target);
  return {
    selectionId: getSelectionId(target),
    box: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
    tagName: target.tagName.toLowerCase(),
    computedStyle: {
      padding: {
        top: style.paddingTop,
        right: style.paddingRight,
        bottom: style.paddingBottom,
        left: style.paddingLeft,
      },
    },
  };
}

function sameSnapshot(first: SelectionSnapshot | undefined, second: SelectionSnapshot | undefined): boolean {
  if (first === second) return true;
  if (!first || !second || first.selectionId !== second.selectionId || first.tagName !== second.tagName) return false;
  return (
    first.box.left === second.box.left &&
    first.box.top === second.box.top &&
    first.box.width === second.box.width &&
    first.box.height === second.box.height &&
    first.computedStyle.padding.top === second.computedStyle.padding.top &&
    first.computedStyle.padding.right === second.computedStyle.padding.right &&
    first.computedStyle.padding.bottom === second.computedStyle.padding.bottom &&
    first.computedStyle.padding.left === second.computedStyle.padding.left
  );
}

export function createSelectionController(): SelectionController {
  const [state, setState] = createSignal<SelectionState>({});
  let anchor: Element | undefined;
  let hover: Element | undefined;
  let publishedAnchor: Element | undefined;
  let publishedHover: Element | undefined;
  let publishedState: SelectionState = {};
  let disposed = false;
  const targetListeners = new Set<TargetListener>();
  const selectionListeners = new Set<SelectionListener>();
  const elementIds = new WeakMap<Element, string>();
  let nextElementId = 0;
  const getSelectionId = (target: Element) => {
    let id = elementIds.get(target);
    if (!id) {
      id = `selection-${++nextElementId}`;
      elementIds.set(target, id);
    }
    return id;
  };

  const notifyTargets = () => {
    if (disposed) return;
    const targets: SelectionTargets = { anchor, hover };
    for (const listener of [...targetListeners]) {
      try {
        listener(targets);
      } catch (error) {
        // A tracking subscriber must not break selection publication or input.
        console.error('Inspection target subscriber failed.', error);
      }
    }
  };

  const publish = () => {
    if (disposed) return;

    // Read each retained element exactly once per publication. Invalidating an
    // anchor clears the selection; a valid hover may remain available for the
    // next deliberate selection.
    const nextAnchorSnapshot = readSnapshot(anchor, getSelectionId);
    if (anchor && !nextAnchorSnapshot) anchor = undefined;

    const nextHoverSnapshot = hover && hover !== anchor ? readSnapshot(hover, getSelectionId) : undefined;
    if (hover && (!nextHoverSnapshot || hover === anchor)) hover = undefined;

    const targetsChanged = anchor !== publishedAnchor || hover !== publishedHover;
    const nextState: SelectionState = {
      anchor: anchor ? nextAnchorSnapshot : undefined,
      hover: hover && hover !== anchor ? nextHoverSnapshot : undefined,
    };
    const stateChanged =
      !sameSnapshot(publishedState.anchor, nextState.anchor) ||
      !sameSnapshot(publishedState.hover, nextState.hover);

    publishedAnchor = anchor;
    publishedHover = hover;
    const anchorChanged = !sameSnapshot(publishedState.anchor, nextState.anchor);
    if (stateChanged) {
      publishedState = nextState;
      setState(nextState);
    }
    if (anchorChanged) {
      for (const listener of [...selectionListeners]) {
        try {
          listener(nextState.anchor);
        } catch (error) {
          console.error('Inspection selection subscriber failed.', error);
        }
      }
    }
    if (targetsChanged) notifyTargets();
  };

  return {
    state,
    getTargets() {
      return { anchor, hover };
    },
    subscribeTargets(listener) {
      if (disposed) return () => undefined;
      targetListeners.add(listener);
      return () => targetListeners.delete(listener);
    },
    subscribeSelection(listener) {
      if (disposed) return () => undefined;
      selectionListeners.add(listener);
      return () => selectionListeners.delete(listener);
    },
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
      publishedAnchor = undefined;
      publishedHover = undefined;
      targetListeners.clear();
      selectionListeners.clear();
      publishedState = {};
      setState({});
    },
  };
}
