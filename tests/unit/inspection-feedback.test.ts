import { describe, expect, it } from 'vitest';
import { isAccessDenied, isExpectedStopError, isExpectedUnavailableError } from '../../apps/extension/lib/inspection-feedback';

describe('inspection feedback severity', () => {
  it.each([
    'Cannot access a helium:// URL',
    'Cannot access a chrome:// URL',
    'Cannot access about:config',
    'Cannot access contents of url "https://example.test/". Extension manifest must request permission.',
    'Cannot access this page',
    'The extensions gallery cannot be scripted.',
    'Missing host permission for the tab',
    'Permission denied to access this page',
    'The operation is insecure.',
    'Restricted URI',
  ])('treats native access denial as unavailable, not an extension error: %s', (reason) => {
    expect(isAccessDenied(new Error(reason))).toBe(true);
    expect(isExpectedUnavailableError(reason)).toBe(true);
  });

  it.each([
    "Cannot access 'state' before initialization",
    "Cannot read properties of undefined (reading 'onClicked')",
    'Inspection content script returned an invalid or stale protocol response.',
    'Message port closed',
    'Unexpected failure on helium://extensions/',
  ])('keeps genuine or unknown failures badge-worthy: %s', (reason) => {
    expect(isAccessDenied(reason)).toBe(false);
    expect(isExpectedUnavailableError(reason)).toBe(false);
  });

  it.each([
    'Receiving end does not exist.',
    'Could not establish connection. Receiving end does not exist.',
    'The inspection operation was superseded.',
    'The operation was canceled.',
    'No tab with id: 7.',
  ])('does not alarm for absent targets or superseded work: %s', (reason) => {
    expect(isExpectedUnavailableError(reason)).toBe(true);
  });

  it('treats a vanished response channel as expected only during stop/cleanup', () => {
    expect(isExpectedStopError('The message port closed before a response was received.')).toBe(true);
    expect(isExpectedStopError('Message port closed')).toBe(true);
    expect(isExpectedStopError('Message manager disconnected')).toBe(true);
    expect(isExpectedStopError('A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received.')).toBe(true);
    expect(isExpectedStopError('Receiving end does not exist.')).toBe(true);
    expect(isExpectedStopError('No tab with id: 7.')).toBe(true);
    expect(isExpectedStopError('Unexpected cleanup failure')).toBe(false);
    expect(isExpectedUnavailableError('The message port closed before a response was received.')).toBe(false);
  });
});
