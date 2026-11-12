import { describe, expect, it } from 'vitest';
import {
  INSPECTION_MESSAGE, INSPECTION_STATE_MESSAGE, INSPECTION_PREVIEW_MESSAGE,
  makeRequest, validateInspectionRequest, validateInspectionResponse,
  validateInspectionStateMessage, validateInspectionPreviewRequest, validateInspectionPreviewResponse, validateSender,
} from '../../apps/extension/lib/inspection-protocol';

const identity = { tabId: 4, documentId: 'doc-a', requestId: 'r1' };
const selection = {
  selectionId: 'selection-1',
  tagName: 'div',
  box: { left: 1, top: 2, width: 30, height: 40 },
  computedStyle: { padding: { top: '1px', right: '2px', bottom: '3px', left: '4px' } },
};
const response = {
  kind: INSPECTION_MESSAGE, ok: true, operation: 'start', identity,
  state: { status: 'active', identity: { ...identity }, revision: 2 }, extra: 'preserved',
};

describe('inspection protocol', () => {
  it('accepts background/UI senders without confusing the sender with the target tab', () => {
    expect(validateSender({ id: 'extension' }, 'extension')).toBe(true);
    expect(validateSender({ id: 'extension', frameId: 0 }, 'extension')).toBe(true);
    expect(validateSender({ id: 'extension', frameId: 1 }, 'extension')).toBe(false);
    expect(validateSender({ id: 'extension', frameId: 0, tab: { id: 4 } }, 'extension')).toBe(false);
    expect(validateSender({ id: 'other' }, 'extension')).toBe(false);
    expect(validateSender({}, 'extension')).toBe(false);
    expect(validateSender({}, undefined)).toBe(false);
  });

  it('validates commands, tab IDs and optional document identities', () => {
    const request = { ...makeRequest('start', 4, 'r1', 'doc-a'), extra: 'preserved' };
    expect(validateInspectionRequest(request, 4, 'doc-a')).toBe(request);
    for (const value of [null, {}, { ...request, operation: 'erase' }, { ...request, operation: 'toggle' }, { ...request, requestId: '' },
      { ...request, tabId: -1 }, { ...request, tabId: 1.5 }, { ...request, documentId: 7 }]) {
      expect(validateInspectionRequest(value)).toBeUndefined();
    }
    expect(validateInspectionRequest(request, 5)).toBeUndefined();
    expect(validateInspectionRequest(request, 4, 'doc-b')).toBeUndefined();
  });

  it('requires complete and matching response/state identity and revision', () => {
    expect(validateInspectionResponse(response)).toBe(response);
    for (const value of [
      { ...response, identity: { ...identity, requestId: 'old' } },
      { ...response, state: { ...response.state, identity: { ...identity, documentId: 'other' } } },
      { ...response, state: { ...response.state, revision: -1 } },
      { ...response, state: { ...response.state, revision: undefined } },
      { ...response, superseded: 'yes' },
      { ...response, ok: false, error: 'denied' },
      { ...response, superseded: true },
      { ...response, operation: 'stop' },
    ]) expect(validateInspectionResponse(value)).toBeUndefined();
    expect(validateInspectionResponse({ ...response, ok: false, error: 'denied', state: { ...response.state, status: 'error' } })).toBeDefined();
  });

  it('accepts page-owned computed style snapshots and rejects malformed style data', () => {
    const event = { kind: INSPECTION_STATE_MESSAGE, state: { ...response.state, selection } };
    expect(validateInspectionStateMessage(event)).toBe(event);
    expect(validateInspectionStateMessage({
      ...event,
      state: { ...event.state, selection: { ...selection, computedStyle: { padding: { ...selection.computedStyle.padding, top: 4 } } } },
    })).toBeUndefined();
    expect(validateInspectionStateMessage({
      ...event,
      state: { ...event.state, status: 'inactive' as const },
    })).toBeUndefined();
  });

  it('validates transient preview requests and acknowledgements without weakening identity checks', () => {
    const request = {
      kind: INSPECTION_PREVIEW_MESSAGE, tabId: 4, documentId: 'doc-a', selectionId: 'selection-1',
      preview: 'padding', visible: true, sequence: 7,
    };
    expect(validateInspectionPreviewRequest(request, 4, 'doc-a')).toBe(request);
    expect(validateInspectionPreviewResponse({ ...request, ok: true })).toBeDefined();
    expect(validateInspectionPreviewResponse({ kind: INSPECTION_PREVIEW_MESSAGE, ok: false, tabId: 4, documentId: 'doc-a', sequence: 7 })).toBeDefined();
    expect(validateInspectionPreviewResponse({ kind: INSPECTION_PREVIEW_MESSAGE, ok: true, tabId: 4, documentId: 'doc-a', sequence: 1.5 })).toBeUndefined();
    for (const bad of [
      { ...request, sequence: -1 }, { ...request, sequence: 1.5 }, { ...request, visible: 'yes' },
      { ...request, preview: 'margin' }, { ...request, documentId: 'old' },
    ]) expect(validateInspectionPreviewRequest(bad, 4, 'doc-a')).toBeUndefined();
  });

  it('validates unsolicited lifecycle state separately from operation responses', () => {
    const event = { kind: INSPECTION_STATE_MESSAGE, state: response.state, extra: 'preserved' };
    expect(validateInspectionStateMessage(event)).toBe(event);
    expect(validateInspectionStateMessage({ ...event, state: { ...response.state, revision: 0.5 } })).toBeUndefined();
    expect(validateInspectionStateMessage(response)).toBeUndefined();
  });

});
