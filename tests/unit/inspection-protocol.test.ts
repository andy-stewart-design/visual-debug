import { describe, expect, it } from 'vitest';
import {
  INSPECTION_MESSAGE, INSPECTION_STATE_MESSAGE, LEGACY_TOGGLE_MESSAGE,
  makeRequest, validateInspectionRequest, validateInspectionResponse,
  validateInspectionStateMessage, validateLegacyToggleResponse, validateSender,
} from '../../apps/extension/lib/inspection-protocol';

const identity = { tabId: 4, documentId: 'doc-a', requestId: 'r1' };
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
    for (const value of [null, {}, { ...request, operation: 'erase' }, { ...request, requestId: '' },
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

  it('validates unsolicited lifecycle state separately from operation responses', () => {
    const event = { kind: INSPECTION_STATE_MESSAGE, state: response.state, extra: 'preserved' };
    expect(validateInspectionStateMessage(event)).toBe(event);
    expect(validateInspectionStateMessage({ ...event, state: { ...response.state, revision: 0.5 } })).toBeUndefined();
    expect(validateInspectionStateMessage(response)).toBeUndefined();
  });

  it('retains validated legacy toggle acknowledgements and rejects malformed optional fields', () => {
    const success = { kind: LEGACY_TOGGLE_MESSAGE, ok: true, active: false, error: undefined, extra: 'preserved' };
    const failure = { kind: LEGACY_TOGGLE_MESSAGE, ok: false, active: undefined, error: 'failed', extra: 'preserved' };
    expect(validateLegacyToggleResponse(success)).toBe(success);
    expect(validateLegacyToggleResponse(failure)).toBe(failure);
    expect(validateLegacyToggleResponse({ kind: LEGACY_TOGGLE_MESSAGE, ok: true })).toBeUndefined();
    expect(validateLegacyToggleResponse({ kind: LEGACY_TOGGLE_MESSAGE, ok: false, error: 'failed' })).toBeDefined();
    expect(validateLegacyToggleResponse({ kind: LEGACY_TOGGLE_MESSAGE, ok: false, active: 7, error: 'failed' })).toBeUndefined();
    expect(validateLegacyToggleResponse({ kind: LEGACY_TOGGLE_MESSAGE, ok: true, active: false, error: 7 })).toBeUndefined();
  });
});
