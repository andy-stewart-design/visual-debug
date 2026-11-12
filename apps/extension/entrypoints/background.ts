import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { inspectionActivation, updateActionFeedback } from '../lib/activation';
import { resolveActionApi } from '../lib/action-api';
import { createSidebarBrowser, type SidebarBrowser } from '../lib/sidebar-browser';
import { createSidebarController, SIDEBAR_PORT, validateSidebarPreviewIntent } from '../lib/sidebar-controller';
import { isTabId, validateInspectionStateMessage } from '../lib/inspection-protocol';
import { hasGrantedSiteAccess } from '../lib/site-access';
import { errorMessage, isExpectedUnavailableError } from '../lib/inspection-feedback';
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function tabReference(tab: Browser.tabs.Tab | undefined) {
  return tab && isTabId(tab.id) && isTabId(tab.windowId) ? { id: tab.id, windowId: tab.windowId } : undefined;
}

const PREVIEW_STREAM_EPOCH_KEY = 'visual-debug:preview-stream-epoch';

async function allocatePreviewStreamEpoch(): Promise<number> {
  // Some unit/browser harnesses provide only the APIs they exercise. The real
  // MV3 manifest grants storage; the compatibility fallback is only for such
  // harnesses and keeps their legacy preview requests at epoch zero.
  const storage = (browser as unknown as {
    storage?: { local?: {
      get(key: string): Promise<Record<string, unknown>>;
      set(value: Record<string, number>): Promise<void>;
    } };
  }).storage?.local;
  if (!storage) return 0;
  const stored = await storage.get(PREVIEW_STREAM_EPOCH_KEY);
  const previous = stored[PREVIEW_STREAM_EPOCH_KEY];
  const next = typeof previous === 'number' && Number.isSafeInteger(previous) && previous >= 0 ? previous + 1 : 1;
  await storage.set({ [PREVIEW_STREAM_EPOCH_KEY]: next });
  return next;
}

export default defineBackground(() => {
  // The epoch is persisted, unlike the service worker's in-memory sequence.
  // Every worker incarnation therefore creates a stream newer than packets
  // which may still be in flight from the retired incarnation.
  const previewStreamEpoch = allocatePreviewStreamEpoch();
  let sidebar: SidebarBrowser | undefined;
  let setupError: string | undefined;
  try { sidebar = createSidebarBrowser(browser); } catch (error) { setupError = errorMessage(error); }
  const controller = createSidebarController({
    activation: inspectionActivation,
    getActiveTab: async (windowId) => tabReference((await browser.tabs.query({ windowId, active: true }))[0]),
    getTab: async (tabId) => {
      try { return tabReference(await browser.tabs.get(tabId)); } catch { return undefined; }
    },
    getTabs: async (windowId) => {
      try { return (await browser.tabs.query({ windowId })).flatMap((tab) => { const ref = tabReference(tab); return ref ? [ref] : []; }); }
      catch (error) {
        // Window removal destroys its page contexts; other query failures must
        // not silently masquerade as successful shutdown.
        try { await browser.windows.get(windowId); } catch { return []; }
        throw error;
      }
    },
    canInject: (tabId) => hasGrantedSiteAccess(browser, tabId),
    previewStreamEpoch,
  });
  type Port = ReturnType<typeof browser.runtime.connect>;
  type Connection = ReturnType<typeof controller.connect>;
  const ports = new Map<number, { port: Port; connection: Connection }>();
  const watched = new Map<number, { opening: number; version: number }>();
  const run = (operation: Promise<unknown>) => {
    void operation.catch((error) => {
      if (!isExpectedUnavailableError(error)) console.error('Sidebar lifecycle operation failed.', error);
    });
  };
  const watch = (windowId: number) => {
    let item = watched.get(windowId);
    if (!item) { item = { opening: 0, version: 0 }; watched.set(windowId, item); }
    return item;
  };
  const closeWindow = (windowId: number): Promise<void> => {
    watched.delete(windowId);
    const old = ports.get(windowId);
    ports.delete(windowId);
    const closing = controller.close(windowId);
    old?.connection.disconnect();
    try { old?.port.disconnect(); } catch { /* already destroyed */ }
    return closing;
  };
  const checkFirefoxWindow = async (windowId: number) => {
    const item = watched.get(windowId);
    if (!sidebar || sidebar.kind !== 'firefox' || !item || item.opening > 0) return;
    const version = item.version;
    const open = await sidebar.isOpen(windowId);
    if (watched.get(windowId) !== item || item.opening > 0 || item.version !== version) return;
    if (open === false) await closeWindow(windowId);
  };
  sidebar?.onClosed((windowId) => run(closeWindow(windowId)));
  if (sidebar?.kind === 'firefox') {
    // A native isOpen check backs up port disconnect. Neither tab switches nor
    // blur are closure signals. Polling also covers disconnect/reconnect gaps.
    setInterval(() => {
      for (const windowId of watched.keys()) run(checkFirefoxWindow(windowId));
    }, 500);
  }

  resolveActionApi(browser).onClicked.addListener((tab) => {
    if (!isTabId(tab.id)) return;
    const tabId = tab.id;
    const windowId = 'windowId' in tab && isTabId(tab.windowId) ? tab.windowId : undefined;
    if (!sidebar || windowId === undefined) {
      run(updateActionFeedback(tabId, setupError ?? 'The browser window could not be identified.'));
      return;
    }
    const adapter = sidebar;
    const item = watch(windowId);
    item.opening += 1;
    item.version += 1;
    const open = () => {
      let opening: Promise<void>;
      try { opening = adapter.open(windowId); } catch (error) { item.opening -= 1; throw error; }
      return opening.finally(() => {
        item.opening -= 1;
        if (adapter.kind === 'firefox') run(checkFirefoxWindow(windowId));
      });
    };
    // openAndStart invokes open synchronously: no tab query or other await may
    // consume the toolbar's native sidebar-opening user gesture first.
    run(controller.openAndStart(windowId, tabId, open).catch(async (error) => {
      await updateActionFeedback(tabId, errorMessage(error));
      throw error;
    }));
  });

  browser.runtime.onConnect.addListener((port) => {
    const sender = port.sender;
    if (port.name !== SIDEBAR_PORT || sender?.id !== browser.runtime.id || sender.tab !== undefined ||
      (sender.frameId !== undefined && sender.frameId !== 0) || sender.url !== browser.runtime.getURL('/sidepanel.html')) {
      port.disconnect();
      return;
    }
    let gone = false;
    let claimedWindow: number | undefined;
    let binding: Connection | undefined;
    port.onMessage.addListener((message: unknown) => {
      if (gone || !record(message)) return;
      if (message.kind === 'ready' && isTabId(message.windowId)) {
        const windowId = message.windowId;
        if (claimedWindow !== undefined) {
          if (claimedWindow !== windowId) port.disconnect();
          return;
        }
        claimedWindow = windowId;
        run((async () => {
          if (!sidebar) throw new Error(setupError ?? 'Browser sidebar support is unavailable.');
          await browser.windows.get(windowId);
          const open = sidebar.isOpen(windowId);
          if (open && !await open) throw new Error('The sidebar is not open in this window.');
          if (gone) return;
          const previous = ports.get(windowId);
          binding = controller.connect(windowId, (view) => {
            if (!gone && ports.get(windowId)?.port === port) port.postMessage({ kind: 'state', view });
          });
          ports.set(windowId, { port, connection: binding });
          watch(windowId).version += 1;
          if (previous && previous.port !== port) {
            try { previous.port.disconnect(); } catch { /* already disconnected */ }
          }
        })().catch((error) => {
          if (!gone) port.postMessage({ kind: 'state', view: { windowId, status: 'error', canStart: false, error: errorMessage(error) } });
          throw error;
        }));
      } else if (message.kind === 'command' && binding && claimedWindow !== undefined &&
        (message.operation === 'start' || message.operation === 'stop' || message.operation === 'query')) {
        run(controller.command(claimedWindow, binding.id, message.operation));
      } else if (message.kind === 'preview' && binding && claimedWindow !== undefined) {
        const intent = validateSidebarPreviewIntent(message.intent);
        if (intent) run(controller.preview(claimedWindow, binding.id, intent));
      }
      // Heartbeats keep Chrome's service worker alive; they never start a page.
    });
    port.onDisconnect.addListener(() => {
      gone = true;
      binding?.disconnect();
      if (claimedWindow !== undefined && ports.get(claimedWindow)?.port === port) {
        ports.delete(claimedWindow);
        run(checkFirefoxWindow(claimedWindow));
      }
    });
  });

  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    const event = validateInspectionStateMessage(message);
    if (!event || sender.id !== browser.runtime.id || sender.frameId !== 0 ||
      !isTabId(sender.tab?.id) || !isTabId(sender.tab?.windowId) || event.state.identity.tabId !== sender.tab.id) return undefined;
    run(controller.stateChanged(event.state, { tabId: sender.tab.id, windowId: sender.tab.windowId }));
    return undefined;
  });
  browser.tabs.onActivated.addListener(({ windowId }) => run(controller.refresh(windowId)));
  browser.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (change.status === 'loading' || change.url !== undefined) {
      // Clear per-tab feedback even when no inspection session was owned. The
      // activation invalidation prevents a canceled old request from putting
      // the badge back while the new document is loading.
      // navigated invalidates the old document synchronously, before clearing
      // its feedback. Its expected cleanup failures cannot reapply the badge.
      run(controller.navigated(tabId, tab.windowId));
      run(updateActionFeedback(tabId));
    }
  });
  browser.tabs.onRemoved.addListener((_tabId, info) => run(controller.refresh(info.windowId)));
  browser.windows.onRemoved.addListener((windowId) => run(closeWindow(windowId)));
});
