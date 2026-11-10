import { createSignal, onCleanup, onMount, type Accessor } from 'solid-js';
import { browser } from 'wxt/browser';
import {
  SIDEBAR_PORT,
  validateSidebarView,
  type SidebarView,
} from '../../lib/sidebar-controller';

type SidebarPort = ReturnType<typeof browser.runtime.connect>;
type StateMessage = { kind: 'state'; view: unknown };
type CommandOperation = 'start' | 'stop' | 'query';

export type SidebarConnection = {
  view: Accessor<SidebarView | undefined>;
  connectionError: Accessor<string | undefined>;
  start: () => void;
  stop: () => void;
};

function isStateMessage(value: unknown): value is StateMessage {
  return typeof value === 'object' && value !== null &&
    'kind' in value && value.kind === 'state' && 'view' in value;
}

export function useSidebarConnection(): SidebarConnection {
  const [view, setView] = createSignal<SidebarView | undefined>();
  const [connectionError, setConnectionError] = createSignal<string | undefined>();

  let disposed = false;
  let windowId: number | undefined;
  let currentPort: SidebarPort | undefined;
  let detachCurrentListeners: (() => void) | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let retryAttempt = 0;

  const setPending = () => {
    if (windowId !== undefined) {
      setView({ windowId, status: 'pending', canStart: false });
    }
  };

  const clearHeartbeat = () => {
    if (heartbeatTimer !== undefined) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
    }
  };

  const post = (port: SidebarPort, message: unknown): boolean => {
    if (disposed || currentPort !== port) return false;
    try {
      port.postMessage(message);
      return true;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'The sidebar connection failed.';
      retire(port, messageText);
      return false;
    }
  };

  const startHeartbeat = (port: SidebarPort) => {
    clearHeartbeat();
    heartbeatTimer = setInterval(() => {
      post(port, { kind: 'heartbeat' });
    }, 15_000);
  };

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer !== undefined) return;
    const delay = Math.min(250 * (2 ** retryAttempt), 3_000);
    retryAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, delay);
  };

  const retire = (port: SidebarPort, error?: string) => {
    if (currentPort !== port) return;
    currentPort = undefined;
    detachCurrentListeners?.();
    detachCurrentListeners = undefined;
    clearHeartbeat();
    if (error !== undefined) setConnectionError(error);
    setPending();
    try {
      port.disconnect();
    } catch {
      // A disconnected runtime port may reject a second disconnect call.
    }
    scheduleReconnect();
  };

  const sendReadyAndQuery = (port: SidebarPort) => {
    if (windowId === undefined || currentPort !== port) return;
    if (!post(port, { kind: 'ready', windowId })) return;
    startHeartbeat(port);
    post(port, { kind: 'command', operation: 'query' });
  };

  const connect = () => {
    if (disposed || currentPort !== undefined) return;
    setPending();
    let port: SidebarPort;
    try {
      port = browser.runtime.connect({ name: SIDEBAR_PORT });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to connect to the background.';
      setConnectionError(message);
      scheduleReconnect();
      return;
    }

    currentPort = port;
    const onMessage = (message: unknown) => {
      if (disposed || currentPort !== port || !isStateMessage(message)) return;
      const next = validateSidebarView(message.view);
      if (next === undefined || windowId === undefined || next.windowId !== windowId) return;
      retryAttempt = 0;
      setConnectionError(undefined);
      setView(next);
    };
    const onDisconnect = () => {
      retire(port);
    };

    port.onMessage.addListener(onMessage);
    port.onDisconnect.addListener(onDisconnect);
    detachCurrentListeners = () => {
      port.onMessage.removeListener(onMessage);
      port.onDisconnect.removeListener(onDisconnect);
    };
    if (windowId !== undefined) sendReadyAndQuery(port);
  };

  const sendCommand = (operation: CommandOperation) => {
    const port = currentPort;
    if (port === undefined || windowId === undefined) return;
    setView((previous: SidebarView | undefined) => previous === undefined
      ? previous
      : { ...previous, status: 'pending', canStart: false, error: undefined });
    if (!post(port, { kind: 'command', operation })) {
      setConnectionError('The sidebar could not send that command.');
    }
  };

  const start = () => {
    if (view()?.canStart !== true || view()?.status === 'pending') return;
    sendCommand('start');
  };

  const stop = () => {
    const current = view();
    if (current?.tabId === undefined || (current.status !== 'active' && current.status !== 'pending')) return;
    sendCommand('stop');
  };

  onMount(() => {
    connect();
    void Promise.resolve()
      .then(() => browser.windows.getCurrent())
      .then((window) => {
        if (disposed || window.id === undefined) throw new Error('The sidebar window could not be identified.');
        windowId = window.id;
        setPending();
        if (currentPort !== undefined) sendReadyAndQuery(currentPort);
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setConnectionError(error instanceof Error ? error.message : 'The sidebar window could not be identified.');
      });
  });

  onCleanup(() => {
    disposed = true;
    if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
    clearHeartbeat();
    const port = currentPort;
    currentPort = undefined;
    detachCurrentListeners?.();
    detachCurrentListeners = undefined;
    if (port !== undefined) {
      try {
        port.disconnect();
      } catch {
        // Cleanup is best effort; no unload message is used for lifecycle.
      }
    }
  });

  return { view, connectionError, start, stop };
}
