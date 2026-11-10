export interface ActionTab {
  id?: number;
}

export interface ActionApi {
  onClicked: {
    addListener(listener: (tab: ActionTab) => void): void;
  };
  setBadgeText(details: { tabId?: number; text: string }): void | Promise<void>;
  setTitle(details: { tabId?: number; title: string }): void | Promise<void>;
}

export interface BrowserActionApis {
  action?: ActionApi;
  browserAction?: ActionApi;
}

export function resolveActionApi(apis: BrowserActionApis): ActionApi {
  if (apis.action != null) return apis.action;
  if (apis.browserAction != null) return apis.browserAction;

  throw new Error('Neither browser.action nor browser.browserAction is available.');
}
