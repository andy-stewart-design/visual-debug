import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createModifierController,
  reduceModifierState,
  type ModifierState,
} from '../../apps/extension/lib/modifiers';

type Registration = Readonly<{
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
}>;

class RecordingEventTarget extends EventTarget {
  readonly registrations: Registration[] = [];

  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (listener) this.registrations.push({ type, listener, options });
    super.addEventListener(type, listener, options);
  }
}

class RecordingDocument extends RecordingEventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
}

let windowStub: RecordingEventTarget;
let documentStub: RecordingDocument;

function fakeWheel({ altKey = false, ctrlKey = false, metaKey = false } = {}): Event {
  const event = new Event('wheel', { cancelable: true });
  Object.defineProperties(event, {
    altKey: { value: altKey },
    ctrlKey: { value: ctrlKey },
    metaKey: { value: metaKey },
  });
  return event;
}

function invokeListener(listener: EventListenerOrEventListenerObject, event: Event): void {
  if (typeof listener === 'function') listener(event);
  else listener.handleEvent(event);
}

const initial: ModifierState = { held: false, keys: [] };

const transition = (state: ModifierState, key: 'AltLeft' | 'AltRight', type: 'keydown' | 'keyup', repeat = false) =>
  reduceModifierState(state, { type, key, ...(type === 'keydown' ? { repeat } : {}) });

describe('reduceModifierState', () => {
  it('requires a fresh non-repeat keydown after clear', () => {
    const held = transition(initial, 'AltLeft', 'keydown');
    expect(held.held).toBe(true);
    expect(reduceModifierState(held, { type: 'clear' })).toEqual(initial);
    expect(reduceModifierState(initial, { type: 'keydown', key: 'AltLeft', repeat: true })).toEqual(initial);
    expect(transition(initial, 'AltLeft', 'keydown').held).toBe(true);
  });

  it('keeps Option held while either side remains down', () => {
    const left = transition(initial, 'AltLeft', 'keydown');
    const both = transition(left, 'AltRight', 'keydown');
    const rightOnly = transition(both, 'AltLeft', 'keyup');
    expect(rightOnly).toEqual({ held: true, keys: ['AltRight'] });
    expect(transition(rightOnly, 'AltRight', 'keyup')).toEqual(initial);
  });

  it('ignores keyup for an already-cleared key', () => {
    const held = transition(initial, 'AltLeft', 'keydown');
    expect(reduceModifierState(held, { type: 'clear' })).toEqual(initial);
    expect(transition(initial, 'AltLeft', 'keyup')).toEqual(initial);
  });
});

describe('createModifierController', () => {
  beforeEach(() => {
    windowStub = new RecordingEventTarget();
    documentStub = new RecordingDocument();
    vi.stubGlobal('window', windowStub);
    vi.stubGlobal('document', documentStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('consumes Alt wheel events only while active', () => {
    const controller = createModifierController();
    const wheelRegistration = windowStub.registrations.find(({ type }) => type === 'wheel');

    expect(wheelRegistration?.options).toEqual({ capture: true, passive: false });
    if (!wheelRegistration) throw new Error('wheel listener was not registered');

    const altWheel = fakeWheel({ altKey: true });
    windowStub.dispatchEvent(altWheel);
    expect(altWheel.defaultPrevented).toBe(true);

    const ordinaryWheel = fakeWheel();
    windowStub.dispatchEvent(ordinaryWheel);
    expect(ordinaryWheel.defaultPrevented).toBe(false);

    const ctrlWheel = fakeWheel({ ctrlKey: true });
    windowStub.dispatchEvent(ctrlWheel);
    expect(ctrlWheel.defaultPrevented).toBe(false);

    const metaWheel = fakeWheel({ metaKey: true });
    windowStub.dispatchEvent(metaWheel);
    expect(metaWheel.defaultPrevented).toBe(false);

    controller.dispose();
    const callbackAfterDispose = fakeWheel({ altKey: true });
    invokeListener(wheelRegistration.listener, callbackAfterDispose);
    expect(callbackAfterDispose.defaultPrevented).toBe(false);

    const removedListenerWheel = fakeWheel({ altKey: true });
    windowStub.dispatchEvent(removedListenerWheel);
    expect(removedListenerWheel.defaultPrevented).toBe(false);

    controller.dispose();
  });
});
