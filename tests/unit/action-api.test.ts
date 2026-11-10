import { describe, expect, it } from 'vitest';
import {
  type ActionApi,
  type ActionTab,
  resolveActionApi,
} from '../../apps/extension/lib/action-api';

type Feedback = { tabId?: number; text: string } | { tabId?: number; title: string };

function createActionApi() {
  const feedback: Feedback[] = [];
  let listener: ((tab: ActionTab) => void) | undefined;

  const api: ActionApi = {
    onClicked: {
      addListener(nextListener) {
        listener = nextListener;
      },
    },
    async setBadgeText(details) {
      feedback.push(details);
    },
    async setTitle(details) {
      feedback.push(details);
    },
  };

  return { api, feedback, getListener: () => listener };
}

describe('resolveActionApi', () => {
  it('selects the modern action API for Chrome-style APIs', async () => {
    const modern = createActionApi();
    const selected = resolveActionApi({ action: modern.api });
    const tab = { id: 42 };

    selected.onClicked.addListener((receivedTab) => {
      expect(receivedTab).toBe(tab);
    });
    modern.getListener()?.(tab);
    await selected.setBadgeText({ tabId: 42, text: '!' });
    await selected.setTitle({ tabId: 42, title: 'Inspection unavailable' });

    expect(modern.feedback).toEqual([
      { tabId: 42, text: '!' },
      { tabId: 42, title: 'Inspection unavailable' },
    ]);
  });

  it('selects browserAction for Firefox-style legacy APIs', async () => {
    const legacy = createActionApi();
    const selected = resolveActionApi({ browserAction: legacy.api });
    expect(selected).toBe(legacy.api);

    const receivedTabs: ActionTab[] = [];
    selected.onClicked.addListener((tab) => receivedTabs.push(tab));
    expect(legacy.getListener()).toBeDefined();
    legacy.getListener()?.({ id: 7 });
    await selected.setBadgeText({ tabId: 7, text: '!' });
    await selected.setTitle({ tabId: 7, title: 'Inspection unavailable' });

    expect(receivedTabs).toEqual([{ id: 7 }]);
    expect(legacy.feedback).toEqual([
      { tabId: 7, text: '!' },
      { tabId: 7, title: 'Inspection unavailable' },
    ]);
  });

  it('prefers the modern API when both APIs are available', () => {
    const modern = createActionApi();
    const legacy = createActionApi();
    expect(resolveActionApi({ action: modern.api, browserAction: legacy.api })).toBe(modern.api);
  });

  it('fails clearly when neither API is available', () => {
    expect(() => resolveActionApi({})).toThrow(
      'Neither browser.action nor browser.browserAction is available.',
    );
  });
});
