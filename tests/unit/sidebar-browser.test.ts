import { describe, expect, it, vi } from 'vitest';
import {
  createSidebarBrowser,
  type SidebarBrowserApis,
} from '../../apps/extension/lib/sidebar-browser';

type ClosedListener = (info: { windowId: number; path: string; tabId?: number }) => void;

function chromeApis() {
  let listener: ClosedListener | undefined;
  const addListener = vi.fn((next: ClosedListener) => { listener = next; });
  const removeListener = vi.fn((next: ClosedListener) => {
    if (listener === next) listener = undefined;
  });
  const open = vi.fn(() => Promise.resolve());
  const apis: SidebarBrowserApis = {
    sidePanel: {
      open,
      onClosed: { addListener, removeListener },
    },
  };
  return { apis, open, addListener, removeListener, emit: (info: Parameters<ClosedListener>[0]) => listener?.(info) };
}

describe('createSidebarBrowser', () => {
  it('opens Chrome with the exact window option and preserves synchronous invocation', () => {
    const chrome = chromeApis();
    let observedBeforeReturn = false;
    chrome.open.mockImplementation(() => {
      observedBeforeReturn = true;
      return Promise.resolve();
    });
    const sidebar = createSidebarBrowser(chrome.apis);

    const result = sidebar.open(19);

    expect(observedBeforeReturn).toBe(true);
    expect(chrome.open).toHaveBeenCalledWith({ windowId: 19 });
    expect(result).toBeInstanceOf(Promise);
  });

  it('forwards only global sidepanel close events for sidepanel.html and unsubscribes', () => {
    const chrome = chromeApis();
    const sidebar = createSidebarBrowser(chrome.apis);
    const closed = vi.fn();
    const unsubscribe = sidebar.onClosed(closed);

    chrome.emit({ windowId: 1, path: 'other.html' });
    chrome.emit({ windowId: 1, path: '/sidepanel.html', tabId: 2 });
    chrome.emit({ windowId: 1, path: '/sidepanel.html' });
    expect(closed).toHaveBeenCalledOnce();
    expect(closed).toHaveBeenCalledWith(1);

    unsubscribe();
    expect(chrome.removeListener).toHaveBeenCalledOnce();
    chrome.emit({ windowId: 2, path: 'sidepanel.html' });
    expect(closed).toHaveBeenCalledOnce();
  });

  it('uses Firefox sidebarAction and its window-specific isOpen check', async () => {
    const open = vi.fn(() => Promise.resolve());
    const isOpen = vi.fn(async ({ windowId }: { windowId: number }) => windowId === 7);
    const sidebar = createSidebarBrowser({ sidebarAction: { open, isOpen } });

    await sidebar.open(7);
    expect(open).toHaveBeenCalledOnce();
    await expect(sidebar.isOpen(7)).resolves.toBe(true);
    expect(isOpen).toHaveBeenCalledWith({ windowId: 7 });

    const closed = vi.fn();
    const unsubscribe = sidebar.onClosed(closed);
    unsubscribe();
    expect(closed).not.toHaveBeenCalled();
  });

  it('prefers the modern Chrome API when both APIs are available', () => {
    const chrome = chromeApis();
    const firefoxOpen = vi.fn(() => Promise.resolve());
    const sidebar = createSidebarBrowser({
      ...chrome.apis,
      sidebarAction: { open: firefoxOpen, isOpen: async () => false },
    });

    expect(sidebar.kind).toBe('chromium');
    sidebar.open(3);
    expect(chrome.open).toHaveBeenCalledWith({ windowId: 3 });
    expect(firefoxOpen).not.toHaveBeenCalled();
  });

  it('rejects unsupported or incomplete APIs clearly', () => {
    expect(() => createSidebarBrowser({})).toThrow(
      'Neither browser.sidePanel nor browser.sidebarAction is available.',
    );
    expect(() => createSidebarBrowser({ sidePanel: { open: async () => undefined } })).toThrow(
      'Chrome sidePanel.onClosed is required for sidebar close handling.',
    );
  });

  it('keeps native open rejections observable', async () => {
    const error = new Error('permission denied');
    const sidebar = createSidebarBrowser({
      sidePanel: {
        open: () => Promise.reject(error),
        onClosed: { addListener: () => undefined, removeListener: () => undefined },
      },
    });
    await expect(sidebar.open(4)).rejects.toBe(error);
  });
});

import { afterEach, beforeEach } from 'vitest';

const bridge = vi.hoisted(() => {
  const event = () => ({ addListener: vi.fn(), removeListener: vi.fn() });
  const chrome = { open: vi.fn(async () => undefined), onClosed: event() };
  const firefox = { open: vi.fn(async () => undefined), isOpen: vi.fn(async () => true) };
  const platform: import('../../apps/extension/lib/sidebar-browser').SidebarBrowserApis = { sidePanel: chrome };
  const tabs = [
    { id: 7, windowId: 1, active: true }, { id: 8, windowId: 1, active: false }, { id: 9, windowId: 2, active: true },
  ];
  const api = {
    ...platform,
    action: { onClicked: event(), setBadgeText: vi.fn(), setTitle: vi.fn() },
    runtime: { id: 'extension', getURL: (path: string) => 'chrome-extension://extension/' + path.replace(/^\//, ''),
      onConnect: event(), onMessage: event() },
    tabs: { query: vi.fn(), get: vi.fn(), onActivated: event(), onUpdated: event(), onRemoved: event() },
    windows: { get: vi.fn(), onRemoved: event() },
  };
  vi.stubGlobal('browser', api);
  return { api, chrome, firefox, tabs,
    activation: { start: vi.fn(), stop: vi.fn(), query: vi.fn() }, feedback: vi.fn() };
});
vi.mock('../../apps/extension/lib/activation', () => ({
  inspectionActivation: bridge.activation, updateActionFeedback: bridge.feedback,
}));
import background from '../../apps/extension/entrypoints/background';


function bridgeResponse(tabId: number, status: 'active' | 'inactive') {
  const identity = { tabId, documentId: 'doc-' + tabId, requestId: 'response' };
  return { kind: 'visual-debug:inspection', operation: 'query', ok: true, identity, state: { status, identity, revision: 1 } };
}
function bridgePort(url = 'chrome-extension://extension/sidepanel.html') {
  let message: ((value: unknown) => void) | undefined;
  let disconnect: (() => void) | undefined;
  const port = {
    name: 'visual-debug:sidebar', sender: { id: 'extension', url },
    onMessage: { addListener(callback: (value: unknown) => void) { message = callback; } },
    onDisconnect: { addListener(callback: () => void) { disconnect = callback; } },
    postMessage: vi.fn(),
    disconnect: vi.fn(() => disconnect?.()),
  };
  return { port, receive: (value: unknown) => message?.(value) };
}
function connectBridge(windowId = 1) {
  const connected = bridgePort();
  bridge.api.runtime.onConnect.addListener.mock.calls.at(-1)![0](connected.port);
  connected.receive({ kind: 'ready', windowId });
  return connected;
}
describe('background/sidebar composition with fake native APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bridge.api.sidePanel = bridge.chrome;
    bridge.api.sidebarAction = undefined;
    bridge.chrome.open.mockResolvedValue(undefined);
    bridge.firefox.isOpen.mockResolvedValue(true);
    bridge.api.tabs.query.mockImplementation(async (options: { windowId: number; active?: boolean }) =>
      bridge.tabs.filter((tab) => tab.windowId === options.windowId && (options.active === undefined || tab.active)));
    bridge.api.tabs.get.mockImplementation(async (id: number) => bridge.tabs.find((tab) => tab.id === id));
    bridge.api.windows.get.mockImplementation(async (id: number) => ({ id }));
    bridge.activation.query.mockImplementation(async (id: number) => bridgeResponse(id, 'inactive'));
    bridge.activation.start.mockImplementation(async (id: number) => bridgeResponse(id, 'active'));
    bridge.activation.stop.mockImplementation(async (id: number) => bridgeResponse(id, 'inactive'));
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('calls native open synchronously, then starts only after a validated sidebar connection', async () => {
    background.main();
    const clicked = bridge.api.action.onClicked.addListener.mock.calls.at(-1)![0];
    clicked({ id: 7, windowId: 1 });
    expect(bridge.chrome.open).toHaveBeenCalledWith({ windowId: 1 });
    expect(bridge.api.tabs.query).not.toHaveBeenCalled();
    expect(bridge.activation.start).not.toHaveBeenCalled();
    const connected = connectBridge();
    await vi.waitFor(() => expect(bridge.activation.start).toHaveBeenCalledWith(7, { allowInjection: true }));
    await vi.waitFor(() => expect(connected.port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'state', view: expect.objectContaining({ status: 'active', tabId: 7 }) })));
  });

  it('routes commands by the bound window, rejects foreign ports, and ignores cross-target claims', async () => {
    background.main();
    const foreign = bridgePort('chrome-extension://extension/options.html');
    bridge.api.runtime.onConnect.addListener.mock.calls.at(-1)![0](foreign.port);
    expect(foreign.port.disconnect).toHaveBeenCalledOnce();
    const connected = connectBridge();
    await vi.waitFor(() => expect(connected.port.postMessage).toHaveBeenCalled());
    connected.receive({ kind: 'command', operation: 'start', windowId: 2, tabId: 9 });
    await vi.waitFor(() => expect(bridge.activation.start).toHaveBeenCalledWith(7, { allowInjection: false }));
    expect(bridge.activation.start).not.toHaveBeenCalledWith(9, expect.anything());
  });

  it('uses the native Chrome close event to sweep only the closed window even after restart', async () => {
    background.main();
    const closed = bridge.chrome.onClosed.addListener.mock.calls.at(-1)![0];
    closed({ windowId: 1, path: 'sidepanel.html' });
    await vi.waitFor(() => expect(bridge.activation.stop).toHaveBeenCalledWith(8));
    expect(bridge.activation.stop).toHaveBeenCalledWith(7);
    expect(bridge.activation.stop).not.toHaveBeenCalledWith(9);
  });

  it('ignores untrusted or non-top-frame lifecycle reports', async () => {
    background.main();
    const received = bridge.api.runtime.onMessage.addListener.mock.calls.at(-1)![0];
    const event = { kind: 'visual-debug:inspection-state', state: bridgeResponse(7, 'active').state };
    expect(received(event, { id: 'foreign', frameId: 0, tab: { id: 7, windowId: 1 } })).toBeUndefined();
    expect(received(event, { id: 'extension', frameId: 1, tab: { id: 7, windowId: 1 } })).toBeUndefined();
    expect(received(event, { id: 'extension', frameId: 0, tab: { id: 9, windowId: 2 } })).toBeUndefined();
    expect(bridge.activation.stop).not.toHaveBeenCalled();
    expect(bridge.api.tabs.get).not.toHaveBeenCalled();
  });

  it('does not treat a Firefox port disconnect or tab/focus change as a close while isOpen remains true', async () => {
    vi.useFakeTimers();
    bridge.api.sidePanel = undefined;
    bridge.api.sidebarAction = bridge.firefox;
    background.main();
    const connected = connectBridge();
    await vi.waitFor(() => expect(connected.port.postMessage).toHaveBeenCalled());
    connected.port.disconnect();
    await vi.advanceTimersByTimeAsync(600);
    expect(bridge.firefox.isOpen).toHaveBeenCalledWith({ windowId: 1 });
    expect(bridge.activation.stop).not.toHaveBeenCalled();
    const reconnected = connectBridge();
    await vi.waitFor(() => expect(reconnected.port.postMessage).toHaveBeenCalled());
    expect(bridge.activation.start).not.toHaveBeenCalled();
  });

  it('backs up Firefox disconnect handling with native isOpen polling and stops hidden tabs on closure', async () => {
    vi.useFakeTimers();
    bridge.api.sidePanel = undefined;
    bridge.api.sidebarAction = bridge.firefox;
    background.main();
    const connected = connectBridge();
    await vi.waitFor(() => expect(connected.port.postMessage).toHaveBeenCalled());
    bridge.firefox.isOpen.mockResolvedValue(false);
    // No unload or disconnect is needed: native visibility is authoritative.
    await vi.advanceTimersByTimeAsync(500);
    expect(bridge.activation.stop).toHaveBeenCalledWith(7);
    expect(bridge.activation.stop).toHaveBeenCalledWith(8);
    expect(bridge.activation.stop).not.toHaveBeenCalledWith(9);
    expect(connected.port.disconnect).toHaveBeenCalled();
  });
});
