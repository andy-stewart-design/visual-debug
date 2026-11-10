import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { enqueueToggle } from '../lib/activation';
import { resolveActionApi } from '../lib/action-api';

export default defineBackground(() => {
  resolveActionApi(browser).onClicked.addListener((tab) => {
    if (tab.id == null) return;
    enqueueToggle(tab.id);
  });
});
