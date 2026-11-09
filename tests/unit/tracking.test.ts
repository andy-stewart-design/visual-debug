import { describe, expect, it } from 'vitest';
import { createTrackingController, type FrameScheduler } from '../../apps/extension/lib/tracking';

function target(): Element {
  return { isConnected: true } as Element;
}

function scheduler(): FrameScheduler & { runNext: () => void; pending: () => number } {
  let nextId = 1;
  const callbacks = new Map<number, () => void>();
  return {
    request(callback) {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    cancel(id) {
      callbacks.delete(id);
    },
    runNext() {
      const next = callbacks.entries().next().value as [number, () => void] | undefined;
      if (!next) return;
      callbacks.delete(next[0]);
      next[1]();
    },
    pending() {
      return callbacks.size;
    },
  };
}

function eventTarget() {
  return new EventTarget();
}

function makeTracking(overrides: Partial<Parameters<typeof createTrackingController>[0]> = {}) {
  const pageWindow = eventTarget();
  const pageDocument = Object.assign(eventTarget(), { visibilityState: 'visible' as string });
  const frameScheduler = scheduler();
  const anchor = target();
  const selectionListeners = new Set<() => void>();
  let targets: { anchor?: Element; hover?: Element } = { anchor };
  let refreshes = 0;
  let pointerPresent = true;
  let measuring = false;
  let uiConnected = true;
  let uiDisconnects = 0;
  let resizeCallback: (() => void) | undefined;
  let mutationCallback: ((records: readonly { target: Node; addedNodes: NodeList; removedNodes: NodeList; type: string }[]) => void) | undefined;
  const resize = {
    observed: [] as Element[],
    unobserved: [] as Element[],
    disconnects: 0,
    observe(element: Element) {
      this.observed.push(element);
    },
    unobserve(element: Element) {
      this.unobserved.push(element);
    },
    disconnect() {
      this.disconnects += 1;
    },
  };
  const mutation = {
    disconnects: 0,
    observeCalls: 0,
    observe() {
      this.observeCalls += 1;
    },
    disconnect() {
      this.disconnects += 1;
    },
  };

  let controller: ReturnType<typeof createTrackingController>;
  const controllerOptions = {
    selection: {
      getTargets: () => targets,
      subscribeTargets: (listener) => {
        selectionListeners.add(listener);
        return () => selectionListeners.delete(listener);
      },
      refresh: () => {
        refreshes += 1;
      },
    },
    picker: {
      hasPointer: () => pointerPresent,
      refreshPointer: () => undefined,
    },
    isMeasuring: () => measuring,
    isOwnElement: () => false,
    isUiConnected: () => uiConnected,
    onUiDisconnected: () => {
      uiDisconnects += 1;
      controller?.dispose();
    },
    scheduler: frameScheduler,
    windowTarget: pageWindow,
    documentTarget: pageDocument,
    documentRoot: { nodeType: 9 } as Node,
    createResizeObserver: (callback) => {
      resizeCallback = callback;
      return resize;
    },
    createMutationObserver: (callback) => {
      mutationCallback = callback;
      return mutation;
    },
    ...overrides,
  };
  controller = createTrackingController(controllerOptions);

  return {
    controller,
    pageWindow,
    pageDocument,
    frameScheduler,
    anchor,
    resize,
    mutation,
    get resizeCallback() {
      return resizeCallback;
    },
    get mutationCallback() {
      return mutationCallback;
    },
    get refreshes() {
      return refreshes;
    },
    get uiDisconnects() {
      return uiDisconnects;
    },
    set uiConnected(value: boolean) {
      uiConnected = value;
    },
    set targets(value: { anchor?: Element; hover?: Element }) {
      targets = value;
      for (const listener of selectionListeners) listener();
    },
    set measuring(value: boolean) {
      measuring = value;
    },
    set pointerPresent(value: boolean) {
      pointerPresent = value;
    },
  };
}

describe('createTrackingController', () => {
  it('coalesces invalidations and only continues sampling for an active pair', () => {
    const tracking = makeTracking();
    tracking.measuring = true;

    tracking.controller.invalidate();
    tracking.controller.invalidate();
    expect(tracking.frameScheduler.pending()).toBe(1);

    tracking.frameScheduler.runNext();
    expect(tracking.refreshes).toBe(1);
    expect(tracking.frameScheduler.pending()).toBe(1);

    tracking.measuring = false;
    tracking.frameScheduler.runNext();
    expect(tracking.refreshes).toBe(2);
    expect(tracking.frameScheduler.pending()).toBe(0);
    tracking.controller.dispose();
  });

  it('replaces ResizeObserver targets when selection identities change', () => {
    const tracking = makeTracking();
    const replacement = target();

    expect(tracking.resize.observed).toEqual([tracking.anchor]);
    tracking.targets = { anchor: replacement };
    tracking.frameScheduler.runNext();

    expect(tracking.resize.unobserved).toEqual([tracking.anchor]);
    expect(tracking.resize.observed).toEqual([tracking.anchor, replacement]);
    tracking.controller.dispose();
  });

  it('coalesces observer invalidation and stops all work on hidden or dispose', () => {
    const tracking = makeTracking();
    tracking.resizeCallback?.();
    tracking.resizeCallback?.();
    tracking.mutationCallback?.([
      {
        target: { nodeType: 3 } as Node,
        addedNodes: [] as unknown as NodeList,
        removedNodes: [] as unknown as NodeList,
        type: 'characterData',
      },
    ]);
    expect(tracking.frameScheduler.pending()).toBe(1);

    tracking.pageDocument.visibilityState = 'hidden';
    tracking.pageDocument.dispatchEvent(new Event('visibilitychange'));
    expect(tracking.frameScheduler.pending()).toBe(0);
    expect(tracking.resize.disconnects).toBe(1);
    expect(tracking.mutation.disconnects).toBe(1);

    tracking.frameScheduler.runNext();
    expect(tracking.refreshes).toBe(0);

    tracking.pageDocument.visibilityState = 'visible';
    tracking.pageDocument.dispatchEvent(new Event('visibilitychange'));
    expect(tracking.frameScheduler.pending()).toBe(1);
    tracking.controller.dispose();
    tracking.pageWindow.dispatchEvent(new Event('scroll'));
    tracking.pageDocument.dispatchEvent(new Event('visibilitychange'));
    expect(tracking.frameScheduler.pending()).toBe(0);
  });

  it('exits during startup when the UI host is already detached', () => {
    const tracking = makeTracking({ isUiConnected: () => false });

    expect(tracking.uiDisconnects).toBe(1);
    expect(tracking.frameScheduler.pending()).toBe(0);
    tracking.pageWindow.dispatchEvent(new Event('scroll'));
    expect(tracking.frameScheduler.pending()).toBe(0);
  });

  it('exits and disposes when an owned UI host is removed', () => {
    const tracking = makeTracking({ isOwnElement: () => true });
    tracking.uiConnected = false;
    tracking.mutationCallback?.([
      {
        target: { nodeType: 9 } as Node,
        addedNodes: [] as unknown as NodeList,
        removedNodes: [{ nodeType: 1 } as Node] as unknown as NodeList,
        type: 'childList',
      },
    ]);

    expect(tracking.uiDisconnects).toBe(1);
    expect(tracking.resize.disconnects).toBe(1);
    expect(tracking.mutation.disconnects).toBe(1);
    expect(tracking.frameScheduler.pending()).toBe(0);

    tracking.pageWindow.dispatchEvent(new Event('scroll'));
    expect(tracking.frameScheduler.pending()).toBe(0);
  });

  it('cancels active sampling when the pointer leaves or the anchor is cleared', () => {
    const tracking = makeTracking();
    tracking.measuring = true;
    tracking.controller.invalidate();
    tracking.frameScheduler.runNext();
    expect(tracking.frameScheduler.pending()).toBe(1);

    tracking.pointerPresent = false;
    tracking.frameScheduler.runNext();
    expect(tracking.frameScheduler.pending()).toBe(0);

    tracking.pointerPresent = true;
    tracking.targets = {};
    tracking.frameScheduler.runNext();
    expect(tracking.frameScheduler.pending()).toBe(0);
    tracking.controller.dispose();
  });

  it('disconnects resources if observer setup fails partway through', () => {
    const pageWindow = eventTarget();
    const pageDocument = Object.assign(eventTarget(), { visibilityState: 'visible' as string });
    const frameScheduler = scheduler();
    const resize = { disconnects: 0, observe() {}, unobserve() {}, disconnect() { this.disconnects += 1; } };

    expect(() => createTrackingController({
      selection: {
        getTargets: () => ({}),
        subscribeTargets: () => () => undefined,
        refresh: () => undefined,
      },
      picker: { hasPointer: () => false, refreshPointer: () => undefined },
      isMeasuring: () => false,
      isOwnElement: () => false,
      isUiConnected: () => true,
      onUiDisconnected: () => undefined,
      scheduler: frameScheduler,
      windowTarget: pageWindow,
      documentTarget: pageDocument,
      documentRoot: { nodeType: 9 } as Node,
      createResizeObserver: () => resize,
      createMutationObserver: () => {
        throw new Error('observer setup failed');
      },
    })).toThrow('observer setup failed');
    expect(resize.disconnects).toBe(1);
  });
});
