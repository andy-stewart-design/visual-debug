export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** No receiver is normal on a document that hasn't been inspected or just left. */
export function isMissingReceiver(error: unknown): boolean {
  return [
    'Could not establish connection. Receiving end does not exist.',
    'Receiving end does not exist.',
  ].includes(errorMessage(error));
}

export function isAccessDenied(error: unknown): boolean {
  const text = errorMessage(error).toLowerCase();
  // Match browser scripting denials, not arbitrary JS failures such as
  // "Cannot access 'state' before initialization".
  return /cannot access (?:(?:a|an) )?[a-z][a-z\d+.-]*:/.test(text) || [
    'cannot access contents of',
    'cannot access this page',
    'cannot access the page',
    'cannot access a privileged url',
    'extensions gallery cannot be scripted',
    'permission denied',
    'operation is insecure',
    'missing host permission',
    'restricted uri',
    'not allowed to access this page',
    'not allowed to access this url',
  ].some((reason) => text.includes(reason));
}

function isMissingTarget(error: unknown): boolean {
  return /^no (?:tab|window) with id:\s*\d+\.?$/i.test(errorMessage(error));
}

/** Only cleanup may treat a vanished message channel as an expected stop. */
export function isExpectedStopError(error: unknown): boolean {
  const text = errorMessage(error).toLowerCase().replace(/\.$/, '');
  return isMissingReceiver(error) || isMissingTarget(error) || [
    'the message port closed before a response was received',
    'message port closed',
    'message manager disconnected',
    'a listener indicated an asynchronous response by returning true, but the message channel closed before a response was received',
  ].includes(text);
}

/** No badge for unavailable targets or canceled work; unknown failures alarm. */
export function isExpectedUnavailableError(error: unknown): boolean {
  const text = errorMessage(error).toLowerCase();
  return isMissingReceiver(error) || isAccessDenied(error) || isMissingTarget(error) ||
    text === 'the inspection operation was superseded.' ||
    text === 'the operation was canceled.' || text === 'the operation was cancelled.';
}
