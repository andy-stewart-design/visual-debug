import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { enqueueToggle } from '../lib/activation';

export default defineBackground(() => {
  browser.action.onClicked.addListener((tab) => {
    if (tab.id == null) return;
    enqueueToggle(tab.id);
  });
});
