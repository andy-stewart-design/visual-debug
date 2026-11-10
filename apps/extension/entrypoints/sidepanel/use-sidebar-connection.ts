import { createSignal, onCleanup, onMount, type Accessor } from 'solid-js';
import { browser } from 'wxt/browser';
import {
  SIDEBAR_PORT,
  validateSidebarView,
  type SidebarView,
} from '../../lib/sidebar-controller';
import {
  acceptSidebarView,
  beginSidebarCommand,
  beginSidebarConnection,
  createSidebarState,
  failSidebarConnection,
  getSidebarPresentation,
  retireSidebarConnection,
  setSidebarWindow,
  type SidebarCommand,
  type SidebarPresentation,
} from '../../lib/sidebar-state';

type SidebarPort = ReturnType<typeof browser.runtime.connect>;
type StateMessage = { kind: 'state'; view: unknown };

export type SidebarConnection = {
  view: Accessor<SidebarView | undefined>;
  presentation: Accessor<SidebarPresentation>;
  connectionError: Accessor<string | undefined>;
  start: () => void;
  stop: () => void;
  refresh: () => void;
};

function isStateMessage(value: unknown): value is StateMessage {
  return typeof value === 'object' && value !== null &&
    'kind' in value && value.kind === 'state' && 'view' in value;
}

export function useSidebarConnection(): SidebarConnection {
  const [model, setModel] = createSignal(createSidebarState());

  let disposed = false;
  let windowId: number | undefined;
  let currentPort: SidebarPort | undefined;
  let currentEpoch = 0;
  let nextToken = 0;
  let detachCurrentListeners: (() => void) | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let retryAttempt = 0;

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
    const guard = { epoch: currentEpoch, token: nextToken };
    currentPort = undefined;
    detachCurrentListeners?.();
    detachCurrentListeners = undefined;
    clearHeartbeat();
    setModel((state) => retireSidebarConnection(state, guard, error));
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
    // Reopen/reconnect always reconciles with the background; it never starts.
    post(port, { kind: 'command', operation: 'query' });
  };

  const identifyWindow = (port: SidebarPort) => {
    void Promise.resolve()
      .then(() => browser.windows.getCurrent())
      .then((window) => {
        if (disposed || currentPort !== port) return;
        const id = window.id;
        if (id === undefined) throw new Error('The sidebar window could not be identified.');
        windowId = id;
        setModel((state) => setSidebarWindow(state, id));
        sendReadyAndQuery(port);
      })
      .catch((error: unknown) => {
        if (disposed || currentPort !== port) return;
        retire(port, error instanceof Error ? error.message : 'The sidebar window could not be identified.');
      });
  };

  const connect = () => {
    if (disposed || currentPort !== undefined) return;
    if (reconnectTimer !== undefined) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
    const epoch = ++currentEpoch;
    const token = ++nextToken;
    const guard = { epoch, token };
    setModel((state) => beginSidebarConnection(state, guard));

    let port: SidebarPort;
    try {
      port = browser.runtime.connect({ name: SIDEBAR_PORT });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to connect to the background.';
      setModel((state) => failSidebarConnection(state, message, guard));
      scheduleReconnect();
      return;
    }

    currentPort = port;
    const onMessage = (message: unknown) => {
      if (disposed || currentPort !== port || !isStateMessage(message)) return;
      const next = validateSidebarView(message.view);
      if (next === undefined || windowId === undefined || next.windowId !== windowId) return;
      retryAttempt = 0;
      setModel((state) => acceptSidebarView(state, next, guard));
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
    else identifyWindow(port);
  };

  const sendCommand = (operation: SidebarCommand) => {
    const port = currentPort;
    if (port === undefined || windowId === undefined) return;
    const next = beginSidebarCommand(model(), operation);
    if (next === model()) return;
    setModel(next);
    // post retires the matching port and records its error if sending fails.
    post(port, { kind: 'command', operation });
  };

  const start = () => {
    if (!getSidebarPresentation(model()).actions.canStart) return;
    sendCommand('start');
  };

  const stop = () => {
    if (!getSidebarPresentation(model()).actions.canStop) return;
    sendCommand('stop');
  };

  const refresh = () => {
    if (currentPort === undefined) {
      // A retry only reconnects. The new port will issue its normal query.
      connect();
      return;
    }
    sendCommand('query');
  };

  onMount(connect);

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

  return {
    view: () => getSidebarPresentation(model()).view,
    presentation: () => getSidebarPresentation(model()),
    connectionError: () => model().connectionError,
    start,
    stop,
    refresh,
  };
}
