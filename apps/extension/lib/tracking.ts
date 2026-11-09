import type { Picker } from './picking';
import type { SelectionController } from './selection';

export type FrameScheduler = Readonly<{
  request: (callback: () => void) => number;
  cancel: (handle: number) => void;
}>;

type ResizeObserverLike = Readonly<{
  observe: (target: Element) => void;
  unobserve: (target: Element) => void;
  disconnect: () => void;
}>;

type MutationRecordLike = Readonly<{
  target: Node;
  addedNodes: NodeList;
  removedNodes: NodeList;
  type: string;
}>;

type MutationObserverLike = Readonly<{
  observe: (target: Node, options: MutationObserverInit) => void;
  disconnect: () => void;
}>;

export type TrackingController = Readonly<{
  invalidate: () => void;
  dispose: () => void;
}>;

export type TrackingOptions = Readonly<{
  selection: Pick<SelectionController, 'getTargets' | 'subscribeTargets' | 'refresh'>;
  picker: Pick<Picker, 'hasPointer' | 'refreshPointer'>;
  isMeasuring: () => boolean;
  isOwnElement: (element: Element) => boolean;
  isUiConnected: () => boolean;
  onUiDisconnected: () => void;
  scheduler?: FrameScheduler;
  windowTarget?: EventTarget;
  documentTarget?: EventTarget & { readonly visibilityState?: string };
  documentRoot?: Node;
  createResizeObserver?: (callback: () => void) => ResizeObserverLike;
  createMutationObserver?: (callback: (records: readonly MutationRecordLike[]) => void) => MutationObserverLike;
}>;

const defaultScheduler: FrameScheduler = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => window.cancelAnimationFrame(handle),
};

function isElementNode(node: Node): node is Element {
  return node.nodeType === 1;
}

function listContainsOnlyOwned(nodes: NodeList, isOwnElement: (element: Element) => boolean): boolean {
  for (const node of Array.from(nodes)) {
    if (!isElementNode(node) || !isOwnElement(node)) return false;
  }
  return true;
}

function hasPageMutation(
  record: MutationRecordLike,
  isOwnElement: (element: Element) => boolean,
): boolean {
  if (isElementNode(record.target) && isOwnElement(record.target)) return false;
  if (
    record.addedNodes.length > 0 &&
    !listContainsOnlyOwned(record.addedNodes, isOwnElement)
  ) {
    return true;
  }
  if (
    record.removedNodes.length > 0 &&
    !listContainsOnlyOwned(record.removedNodes, isOwnElement)
  ) {
    return true;
  }

  // Attribute and character-data records have no child list to inspect. The
  // target check above is enough to ignore records originating in our UI.
  return record.type === 'attributes' || record.type === 'characterData';
}

function createTargetObserver(
  selection: Pick<SelectionController, 'getTargets'>,
  observer: ResizeObserverLike,
): { sync: () => void; disconnect: () => void } {
  let observed = new Set<Element>();
  let disconnected = false;

  const sync = () => {
    if (disconnected) return;
    const targets = selection.getTargets();
    const next = new Set<Element>();
    for (const target of [targets.anchor, targets.hover]) {
      if (target && target.isConnected) next.add(target);
    }

    for (const target of observed) {
      if (!next.has(target)) observer.unobserve(target);
    }
    for (const target of next) {
      if (!observed.has(target)) observer.observe(target);
    }
    observed = next;
  };

  return {
    sync,
    disconnect() {
      if (disconnected) return;
      disconnected = true;
      for (const target of observed) observer.unobserve(target);
      observed.clear();
    },
  };
}

/**
 * Keeps page geometry event-driven while quiet and samples only the active
 * Option-held pair. All inputs are injected so scheduling/disposal can be
 * tested without a DOM or browser harness.
 */
export function createTrackingController(options: TrackingOptions): TrackingController {
  const scheduler = options.scheduler ?? defaultScheduler;
  const windowTarget = options.windowTarget ?? window;
  const documentTarget = options.documentTarget ?? document;
  const documentRoot = options.documentRoot ?? document.documentElement ?? document;
  const isVisible = () => documentTarget.visibilityState === undefined || documentTarget.visibilityState === 'visible';

  let disposed = false;
  let focused = true;
  let frame: number | undefined;
  let resizeObserver: ResizeObserverLike | undefined;
  let mutationObserver: MutationObserverLike | undefined;
  let targetObserver: ReturnType<typeof createTargetObserver> | undefined;
  let unsubscribeTargets: (() => void) | undefined;

  const active = () => focused && isVisible();
  const cancelFrame = () => {
    if (frame === undefined) return;
    scheduler.cancel(frame);
    frame = undefined;
  };

  const syncObservers = () => targetObserver?.sync();

  const handleDisconnectedUi = () => {
    if (disposed) return false;
    try {
      options.onUiDisconnected();
    } finally {
      // The session callback owns the complete teardown, but dispose here too
      // so a callback that runs during startup cannot leave this controller
      // active before its caller has assigned the returned reference.
      dispose();
    }
    return false;
  };

  const checkUiConnected = () =>
    !disposed && (options.isUiConnected() || handleDisconnectedUi());

  const schedule = () => {
    if (!checkUiConnected() || !active() || frame !== undefined) return;
    frame = scheduler.request(() => {
      frame = undefined;
      if (!checkUiConnected() || !active()) return;

      // Re-hit-test first: a stationary pointer can now be over a different
      // element after its old target moved, transformed, or was removed.
      options.picker.refreshPointer();
      options.selection.refresh();
      syncObservers();

      if (
        checkUiConnected() &&
        active() &&
        options.isMeasuring() &&
        options.picker.hasPointer() &&
        Boolean(options.selection.getTargets().anchor)
      ) {
        schedule();
      }
    });
  };

  const disconnectObservers = () => {
    targetObserver?.disconnect();
    targetObserver = undefined;
    resizeObserver?.disconnect();
    resizeObserver = undefined;
    mutationObserver?.disconnect();
    mutationObserver = undefined;
  };

  const pause = () => {
    cancelFrame();
    disconnectObservers();
  };

  const resume = () => {
    if (!checkUiConnected() || !active()) return;
    if (!resizeObserver || !mutationObserver || !targetObserver) {
      setupObservers();
    }
    syncObservers();
    schedule();
  };

  const onVisibilityChange = () => {
    if (!isVisible()) {
      pause();
    } else {
      resume();
    }
  };
  const onWindowBlur = () => {
    focused = false;
    pause();
  };
  const onWindowFocus = () => {
    focused = true;
    resume();
  };

  const setupObservers = () => {
    if (
      disposed ||
      !checkUiConnected() ||
      !active() ||
      resizeObserver ||
      mutationObserver ||
      targetObserver
    ) return;

    let nextResizeObserver: ResizeObserverLike | undefined;
    let nextTargetObserver: ReturnType<typeof createTargetObserver> | undefined;
    let nextMutationObserver: MutationObserverLike | undefined;
    try {
      nextResizeObserver = (options.createResizeObserver ?? ((callback) =>
        new ResizeObserver(callback))).call(undefined, () => schedule());
      nextTargetObserver = createTargetObserver(options.selection, nextResizeObserver);

      nextMutationObserver = (options.createMutationObserver ?? ((callback) =>
        new MutationObserver(callback as MutationCallback))).call(undefined, (records) => {
        // Check connection before filtering extension-owned records: removing
        // the Shadow host itself is an owned mutation, but it must end the
        // session rather than leave page listeners and observers running.
        if (!checkUiConnected()) return;
        if (records.some((record) => hasPageMutation(record, options.isOwnElement))) schedule();
      });
      nextMutationObserver.observe(documentRoot, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
      resizeObserver = nextResizeObserver;
      targetObserver = nextTargetObserver;
      mutationObserver = nextMutationObserver;
    } catch (error) {
      nextTargetObserver?.disconnect();
      nextMutationObserver?.disconnect();
      nextResizeObserver?.disconnect();
      throw error;
    }
  };

  const listeners: Array<[EventTarget, string, EventListener, boolean]> = [
    [windowTarget, 'scroll', schedule, true],
    [windowTarget, 'resize', schedule, true],
    [windowTarget, 'blur', onWindowBlur, false],
    [windowTarget, 'focus', onWindowFocus, false],
    [documentTarget, 'visibilitychange', onVisibilityChange, true],
  ];

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const [target, type, listener, capture] of listeners) {
      target.removeEventListener(type, listener, capture);
    }
    cancelFrame();
    unsubscribeTargets?.();
    unsubscribeTargets = undefined;
    disconnectObservers();
  };

  try {
    for (const [target, type, listener, capture] of listeners) {
      target.addEventListener(type, listener, capture);
    }
    setupObservers();
    if (!disposed) {
      syncObservers();
      unsubscribeTargets = options.selection.subscribeTargets(schedule);
    }
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    invalidate: schedule,
    dispose,
  };
}
