export interface SidebarBrowserApis {
  sidePanel?: {
    open(options: { windowId: number }): Promise<void>;
    onClosed?: {
      addListener(listener: (info: { windowId: number; path: string; tabId?: number }) => void): void;
      removeListener(listener: (info: { windowId: number; path: string; tabId?: number }) => void): void;
    };
  };
  sidebarAction?: {
    open(): Promise<void>;
    isOpen(details: { windowId: number }): Promise<boolean>;
  };
}

export type SidebarBrowser = {
  kind: 'chromium' | 'firefox';
  open(windowId: number): Promise<void>;
  isOpen(windowId: number): Promise<boolean> | undefined;
  onClosed(listener: (windowId: number) => void): () => void;
};

const SIDEBAR_PATH = 'sidepanel.html';

function isSidebarPath(path: string): boolean {
  return path.replace(/^\/+/, '') === SIDEBAR_PATH;
}

/**
 * Keep browser-specific sidebar behavior behind a small injected adapter. In
 * particular, `open` is deliberately not async: callers can invoke the native
 * method in the same stack as a toolbar click.
 */
export function createSidebarBrowser(apis: SidebarBrowserApis): SidebarBrowser {
  if (apis.sidePanel !== undefined) {
    const sidePanel = apis.sidePanel;
    if (sidePanel.onClosed === undefined) {
      throw new Error('Chrome sidePanel.onClosed is required for sidebar close handling.');
    }

    const onClosed = sidePanel.onClosed;
    return {
      kind: 'chromium',
      open(windowId) {
        return sidePanel.open({ windowId });
      },
      isOpen() {
        return undefined;
      },
      onClosed(listener) {
        const nativeListener = (info: { windowId: number; path: string; tabId?: number }) => {
          // Chrome can report closures for another extension path, and newer
          // versions can include a tabId for a tab-specific panel. This adapter
          // only observes the global panel represented by this entrypoint.
          if (info.tabId !== undefined || !isSidebarPath(info.path)) return;
          listener(info.windowId);
        };
        onClosed.addListener(nativeListener);
        let removed = false;
        return () => {
          if (removed) return;
          removed = true;
          onClosed.removeListener(nativeListener);
        };
      },
    };
  }

  if (apis.sidebarAction !== undefined) {
    const sidebarAction = apis.sidebarAction;
    return {
      kind: 'firefox',
      open() {
        return sidebarAction.open();
      },
      isOpen(windowId) {
        return sidebarAction.isOpen({ windowId });
      },
      // Firefox has no native close event in the supported contract. The
      // background coordinates closure using its port and isOpen polling.
      onClosed() {
        return () => undefined;
      },
    };
  }

  throw new Error('Neither browser.sidePanel nor browser.sidebarAction is available.');
}
