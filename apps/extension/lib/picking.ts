type PickerOptions = {
  isOwnEvent: (event: Event) => boolean;
  isOwnElement: (element: Element) => boolean;
  onHover: (target: Element | undefined) => void;
  onSelect: (target: Element) => void;
};

type PointerPosition = {
  clientX: number;
  clientY: number;
};

type SuppressedGesture = {
  pointerId?: number;
  active: boolean;
  compatibilityUntil: number;
};

export type Picker = {
  refreshPointer: () => void;
  dispose: () => void;
};

function isPrimaryPointer(event: PointerEvent): boolean {
  return event.isPrimary && event.button === 0;
}

function isPrimaryMouse(event: MouseEvent): boolean {
  return event.button === 0;
}

function isPageElement(
  element: Element | null,
  isOwnElement: (element: Element) => boolean,
): element is Element {
  if (!element || isOwnElement(element) || element.ownerDocument !== document || !element.isConnected) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return (
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

export function createPicker(options: PickerOptions): Picker {
  let disposed = false;
  let lastPointer: PointerPosition | undefined;
  let gesture: SuppressedGesture | undefined;
  let compatibilityTimer: number | undefined;

  const clearCompatibilityTimer = () => {
    if (compatibilityTimer !== undefined) {
      window.clearTimeout(compatibilityTimer);
      compatibilityTimer = undefined;
    }
  };

  const clearGesture = () => {
    gesture = undefined;
    clearCompatibilityTimer();
  };

  const hitTest = (position: PointerPosition): Element | undefined => {
    const target = document.elementFromPoint(position.clientX, position.clientY);
    if (!isPageElement(target, options.isOwnElement)) return undefined;

    // Only leave a measurable native track to the page. Borders around normal
    // scrollable content are not scrollbars; overlay and non-right/bottom
    // scrollbar variants remain browser-specific and are not inferred here.
    if (target instanceof HTMLElement) {
      const rect = target.getBoundingClientRect();
      const style = window.getComputedStyle(target);
      const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
      const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
      const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
      const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;
      const verticalTrack = rect.width - borderLeft - borderRight - target.clientWidth;
      const horizontalTrack = rect.height - borderTop - borderBottom - target.clientHeight;
      const onVerticalScrollbar =
        target.scrollHeight > target.clientHeight &&
        verticalTrack > 1 &&
        position.clientX >= rect.right - borderRight - verticalTrack &&
        position.clientX <= rect.right - borderRight;
      const onHorizontalScrollbar =
        target.scrollWidth > target.clientWidth &&
        horizontalTrack > 1 &&
        position.clientY >= rect.bottom - borderBottom - horizontalTrack &&
        position.clientY <= rect.bottom - borderBottom;
      if (onVerticalScrollbar || onHorizontalScrollbar) return undefined;
    }

    return target;
  };

  const clearPointerHover = () => {
    lastPointer = undefined;
    options.onHover(undefined);
  };

  const updateHover = (position: PointerPosition) => {
    lastPointer = position;
    options.onHover(hitTest(position));
  };

  const isSuppressed = () =>
    gesture !== undefined &&
    (gesture.active || gesture.compatibilityUntil > performance.now());

  const rememberCompatibility = () => {
    if (!gesture) return;
    gesture.active = false;
    gesture.compatibilityUntil = performance.now() + 700;
    clearCompatibilityTimer();
    compatibilityTimer = window.setTimeout(() => {
      if (gesture && gesture.compatibilityUntil <= performance.now()) {
        gesture = undefined;
      }
      compatibilityTimer = undefined;
    }, 750);
  };

  const suppress = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const startGesture = (target: Element, pointerId?: number) => {
    clearCompatibilityTimer();
    gesture = { pointerId, active: true, compatibilityUntil: 0 };
    options.onSelect(target);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (options.isOwnEvent(event)) {
      clearPointerHover();
      return;
    }
    updateHover({ clientX: event.clientX, clientY: event.clientY });
    if (
      gesture?.active &&
      gesture.pointerId === event.pointerId &&
      (event.buttons & 1) !== 0
    ) {
      suppress(event);
    }
  };

  const onMouseMove = (event: MouseEvent) => {
    if (options.isOwnEvent(event)) {
      clearPointerHover();
      return;
    }
    updateHover({ clientX: event.clientX, clientY: event.clientY });
    if (gesture?.active && (event.buttons & 1) !== 0) suppress(event);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!isPrimaryPointer(event)) return;
    clearGesture();
    if (options.isOwnEvent(event)) {
      clearPointerHover();
      return;
    }

    const target = hitTest({ clientX: event.clientX, clientY: event.clientY });
    if (!target) return;

    startGesture(target, event.pointerId);
    suppress(event);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (options.isOwnEvent(event)) {
      clearPointerHover();
      if (gesture?.pointerId === event.pointerId) rememberCompatibility();
      return;
    }
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    suppress(event);
    rememberCompatibility();
  };

  const onPointerCancel = (event: PointerEvent) => {
    const matchesGesture = gesture?.pointerId === event.pointerId;
    if (matchesGesture && !options.isOwnEvent(event)) suppress(event);
    clearPointerHover();
    if (matchesGesture) clearGesture();
  };

  const onMouseDown = (event: MouseEvent) => {
    if (!isPrimaryMouse(event)) return;
    if (options.isOwnEvent(event)) {
      clearPointerHover();
      return;
    }

    if (gesture?.active) {
      suppress(event);
      return;
    }

    // This is also the fallback path when a page's earlier pointer handler
    // prevented the pointer event from reaching this interceptor.
    clearGesture();
    const target = hitTest({ clientX: event.clientX, clientY: event.clientY });
    if (!target) return;
    startGesture(target);
    suppress(event);
  };

  const onMouseUp = (event: MouseEvent) => {
    if (!isPrimaryMouse(event)) return;
    if (options.isOwnEvent(event)) {
      clearPointerHover();
      if (gesture) rememberCompatibility();
      return;
    }
    if (!gesture) return;
    if (isSuppressed()) suppress(event);
    rememberCompatibility();
  };

  const onCompatibilityEvent = (event: Event) => {
    if (options.isOwnEvent(event)) {
      clearPointerHover();
      return;
    }
    if (!gesture || !isSuppressed()) return;
    suppress(event);
    if (event.type === 'click') rememberCompatibility();
  };

  const onPointerOut = (event: PointerEvent) => {
    const related = event.relatedTarget;
    const relatedIsOwn = related instanceof Element && options.isOwnElement(related);
    if (
      options.isOwnEvent(event) ||
      relatedIsOwn ||
      !related ||
      !(related instanceof Node) ||
      !document.documentElement.contains(related)
    ) {
      clearPointerHover();
    }
  };

  const onWindowBlur = (event: Event) => {
    if (event.target !== window) return;
    clearPointerHover();
    clearGesture();
  };

  const onVisibilityChange = () => {
    if (document.visibilityState !== 'visible') {
      clearPointerHover();
      clearGesture();
    }
  };

  const listeners: Array<[EventTarget, string, EventListener, boolean]> = [
    [window, 'pointermove', onPointerMove as EventListener, true],
    [window, 'pointerdown', onPointerDown as EventListener, true],
    [window, 'pointerup', onPointerUp as EventListener, true],
    [window, 'pointercancel', onPointerCancel as EventListener, true],
    [window, 'mousedown', onMouseDown as EventListener, true],
    [window, 'mousemove', onMouseMove as EventListener, true],
    [window, 'mouseup', onMouseUp as EventListener, true],
    [window, 'click', onCompatibilityEvent, true],
    [window, 'dblclick', onCompatibilityEvent, true],
    [window, 'auxclick', onCompatibilityEvent, true],
    [window, 'dragstart', onCompatibilityEvent, true],
    [window, 'selectstart', onCompatibilityEvent, true],
    [window, 'pointerout', onPointerOut as EventListener, true],
    [window, 'blur', onWindowBlur, false],
    [document, 'visibilitychange', onVisibilityChange, true],
  ];

  for (const [target, type, listener, capture] of listeners) {
    target.addEventListener(type, listener, capture);
  }

  return {
    refreshPointer() {
      if (!disposed && lastPointer) updateHover(lastPointer);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [target, type, listener, capture] of listeners) {
        target.removeEventListener(type, listener, capture);
      }
      clearGesture();
      clearPointerHover();
    },
  };
}
