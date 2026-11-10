export const INSPECTION_MESSAGE = 'visual-debug:inspection';
export const INSPECTION_STATE_MESSAGE = 'visual-debug:inspection-state';
export const LEGACY_TOGGLE_MESSAGE = 'visual-debug:toggle-inspection';

export type InspectionOperation = 'start' | 'stop' | 'query' | 'toggle';
export type InspectionStatus = 'pending' | 'active' | 'inactive' | 'unavailable' | 'error';

export interface InspectionIdentity {
  tabId: number;
  documentId: string;
  requestId: string;
}

export interface InspectionState {
  status: InspectionStatus;
  identity: InspectionIdentity;
  /** Monotonic within a document, including unsolicited disposal events. */
  revision: number;
  error?: string;
}

export interface InspectionRequest {
  kind: typeof INSPECTION_MESSAGE;
  operation: InspectionOperation;
  tabId: number;
  requestId: string;
  documentId?: string;
}

export interface InspectionResponse {
  kind: typeof INSPECTION_MESSAGE;
  ok: boolean;
  operation: InspectionOperation;
  identity: InspectionIdentity;
  state: InspectionState;
  superseded?: boolean;
  error?: string;
}

export interface InspectionStateMessage {
  kind: typeof INSPECTION_STATE_MESSAGE;
  state: InspectionState;
}

export interface LegacyToggleResponse {
  kind: typeof LEGACY_TOGGLE_MESSAGE;
  ok: boolean;
  active?: boolean;
  error?: string;
}

export interface MessageSenderLike {
  id?: string;
  frameId?: number;
  tab?: { id?: number };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isTabId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

const INSPECTION_STATUSES: ReadonlySet<string> = new Set(['pending', 'active', 'inactive', 'unavailable', 'error']);
const INSPECTION_OPERATIONS: ReadonlySet<string> = new Set(['start', 'stop', 'query', 'toggle']);

export function isInspectionStatus(value: unknown): value is InspectionStatus {
  return typeof value === 'string' && INSPECTION_STATUSES.has(value);
}

export function isInspectionOperation(value: unknown): value is InspectionOperation {
  return typeof value === 'string' && INSPECTION_OPERATIONS.has(value);
}

function isInspectionRequest(value: unknown): value is InspectionRequest {
  if (!isRecord(value) || value.kind !== INSPECTION_MESSAGE) return false;
  if (!isInspectionOperation(value.operation) || !isTabId(value.tabId) || !isNonEmptyString(value.requestId)) return false;
  return value.documentId === undefined || isNonEmptyString(value.documentId);
}

export function validateInspectionRequest(
  value: unknown,
  expectedTabId?: number,
  expectedDocumentId?: string,
): InspectionRequest | undefined {
  if (!isInspectionRequest(value)) return undefined;
  if (expectedTabId !== undefined && value.tabId !== expectedTabId) return undefined;
  if (expectedDocumentId !== undefined && value.documentId !== undefined && value.documentId !== expectedDocumentId) return undefined;
  return value;
}

/** Commands originate in our background/extension UI, not another content tab.
 * Sender.tab describes the SENDER, not the target of tabs.sendMessage.
 */
export function validateSender(sender: MessageSenderLike, extensionId: string | undefined): boolean {
  return extensionId !== undefined && sender.id === extensionId && sender.tab === undefined &&
    (sender.frameId === undefined || sender.frameId === 0);
}

function isInspectionIdentity(value: unknown): value is InspectionIdentity {
  return isRecord(value) && isTabId(value.tabId) && isNonEmptyString(value.documentId) && isNonEmptyString(value.requestId);
}

function isInspectionState(value: unknown): value is InspectionState {
  return isRecord(value) && isInspectionStatus(value.status) && isInspectionIdentity(value.identity) &&
    typeof value.revision === 'number' && Number.isSafeInteger(value.revision) && value.revision >= 0 &&
    (value.error === undefined || typeof value.error === 'string');
}

function isInspectionResponse(value: unknown): value is InspectionResponse {
  if (!isRecord(value) || value.kind !== INSPECTION_MESSAGE || typeof value.ok !== 'boolean' || !isInspectionOperation(value.operation)) return false;
  if (!isInspectionIdentity(value.identity) || !isInspectionState(value.state)) return false;
  if (value.superseded !== undefined && typeof value.superseded !== 'boolean') return false;
  if (value.error !== undefined && typeof value.error !== 'string') return false;
  const { identity, state } = value;
  if (state.identity.tabId !== identity.tabId || state.identity.documentId !== identity.documentId || state.identity.requestId !== identity.requestId) return false;
  if (!value.ok && (state.status === 'active' || !(value.error || state.error))) return false;
  if (value.ok && (state.status === 'error' || state.status === 'unavailable')) return false;
  if (value.superseded && state.status === 'active') return false;
  if (value.ok && value.operation === 'stop' && state.status !== 'inactive') return false;
  if (value.ok && value.operation !== 'query' && state.status === 'pending') return false;
  return true;
}

export function validateInspectionResponse(value: unknown): InspectionResponse | undefined {
  return isInspectionResponse(value) ? value : undefined;
}

function isInspectionStateMessage(value: unknown): value is InspectionStateMessage {
  return isRecord(value) && value.kind === INSPECTION_STATE_MESSAGE && isInspectionState(value.state);
}

export function validateInspectionStateMessage(value: unknown): InspectionStateMessage | undefined {
  return isInspectionStateMessage(value) ? value : undefined;
}

function isLegacyToggleResponse(value: unknown): value is LegacyToggleResponse {
  if (!isRecord(value) || value.kind !== LEGACY_TOGGLE_MESSAGE || typeof value.ok !== 'boolean') return false;
  if (value.active !== undefined && typeof value.active !== 'boolean') return false;
  if (value.error !== undefined && typeof value.error !== 'string') return false;
  if (value.ok && typeof value.active !== 'boolean') return false;
  if (!value.ok && !isNonEmptyString(value.error)) return false;
  return true;
}

export function validateLegacyToggleResponse(value: unknown): LegacyToggleResponse | undefined {
  return isLegacyToggleResponse(value) ? value : undefined;
}

export function makeRequest(operation: InspectionOperation, tabId: number, requestId: string, documentId?: string): InspectionRequest {
  return { kind: INSPECTION_MESSAGE, operation, tabId, requestId, ...(documentId === undefined ? {} : { documentId }) };
}
