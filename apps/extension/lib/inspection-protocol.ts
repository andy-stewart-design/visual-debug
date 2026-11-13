import { isElementSnapshot, type ElementSnapshot } from './element-snapshot';
import { PADDING_SIDES, type PaddingSide, type StyleEditRequest } from './style-edit';

export const STYLE_EDIT_MESSAGE = 'visual-debug:style-edit';

export const INSPECTION_MESSAGE = 'visual-debug:inspection';
export const INSPECTION_STATE_MESSAGE = 'visual-debug:inspection-state';
export const INSPECTION_PREVIEW_MESSAGE = 'visual-debug:inspection-preview';
export type InspectionOperation = 'start' | 'stop' | 'query';
export type InspectionPreviewKind = 'padding';
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
  /** Page-owned, serializable data for the current selected anchor. */
  selection?: ElementSnapshot;
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

/** Transient sidebar intent. It is deliberately not part of InspectionState. */
export interface InspectionPreviewRequest {
  kind: typeof INSPECTION_PREVIEW_MESSAGE;
  tabId: number;
  documentId: string;
  selectionId: string;
  preview: InspectionPreviewKind;
  visible: boolean;
  sequence: number;
}

export interface InspectionPreviewResponse {
  kind: typeof INSPECTION_PREVIEW_MESSAGE;
  ok: boolean;
  tabId: number;
  documentId: string;
  sequence: number;
}

export interface StyleEditResponse {
  kind: typeof STYLE_EDIT_MESSAGE;
  ok: boolean;
  tabId: number;
  documentId: string;
  selectionId: string;
  editId: string;
  property: 'padding';
  side: PaddingSide;
  state?: InspectionState;
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
const INSPECTION_OPERATIONS: ReadonlySet<string> = new Set(['start', 'stop', 'query']);

export function isInspectionStatus(value: unknown): value is InspectionStatus {
  return typeof value === 'string' && INSPECTION_STATUSES.has(value);
}

export function isInspectionOperation(value: unknown): value is InspectionOperation {
  return typeof value === 'string' && INSPECTION_OPERATIONS.has(value);
}

function isStyleEditRequest(value: unknown): value is StyleEditRequest {
  return isRecord(value) && value.kind === STYLE_EDIT_MESSAGE && isTabId(value.tabId) &&
    isNonEmptyString(value.documentId) && isNonEmptyString(value.selectionId) && isNonEmptyString(value.editId) &&
    value.property === 'padding' && typeof value.side === 'string' && PADDING_SIDES.includes(value.side as PaddingSide) &&
    typeof value.value === 'number' && Number.isFinite(value.value) && value.value >= 0;
}

export function validateStyleEditRequest(
  value: unknown,
  expectedTabId?: number,
  expectedDocumentId?: string,
): StyleEditRequest | undefined {
  if (!isStyleEditRequest(value)) return undefined;
  if (expectedTabId !== undefined && value.tabId !== expectedTabId) return undefined;
  if (expectedDocumentId !== undefined && value.documentId !== expectedDocumentId) return undefined;
  return value;
}

export function makeStyleEditResponse(request: StyleEditRequest, ok: boolean, error?: string, state?: InspectionState): StyleEditResponse {
  return {
    kind: STYLE_EDIT_MESSAGE, ok, tabId: request.tabId, documentId: request.documentId,
    selectionId: request.selectionId, editId: request.editId,
    property: request.property, side: request.side,
    ...(state === undefined ? {} : { state }), ...(error === undefined ? {} : { error }),
  };
}

export function validateStyleEditResponse(value: unknown): StyleEditResponse | undefined {
  if (!isRecord(value) || value.kind !== STYLE_EDIT_MESSAGE || typeof value.ok !== 'boolean' ||
    !isTabId(value.tabId) || !isNonEmptyString(value.documentId) || !isNonEmptyString(value.selectionId) ||
    !isNonEmptyString(value.editId) || value.property !== 'padding' || typeof value.side !== 'string' || !PADDING_SIDES.includes(value.side as PaddingSide) ||
    (value.state !== undefined && !isInspectionState(value.state)) || (value.error !== undefined && typeof value.error !== 'string')) return undefined;
  if (!value.ok && value.error === undefined) return undefined;
  if (value.ok && value.state === undefined) return undefined;
  if (value.state && (value.state.identity.tabId !== value.tabId || value.state.identity.documentId !== value.documentId)) return undefined;
  if (value.ok && (value.state?.status !== 'active' || value.state.selection?.selectionId !== value.selectionId)) return undefined;
  return value as unknown as StyleEditResponse;
}

function isInspectionPreviewRequest(value: unknown): value is InspectionPreviewRequest {
  return isRecord(value) && value.kind === INSPECTION_PREVIEW_MESSAGE && isTabId(value.tabId) &&
    isNonEmptyString(value.documentId) && isNonEmptyString(value.selectionId) && value.preview === 'padding' &&
    typeof value.visible === 'boolean' && typeof value.sequence === 'number' &&
    Number.isSafeInteger(value.sequence) && value.sequence >= 0;
}

export function validateInspectionPreviewRequest(
  value: unknown,
  expectedTabId?: number,
  expectedDocumentId?: string,
): InspectionPreviewRequest | undefined {
  if (!isInspectionPreviewRequest(value)) return undefined;
  if (expectedTabId !== undefined && value.tabId !== expectedTabId) return undefined;
  if (expectedDocumentId !== undefined && value.documentId !== expectedDocumentId) return undefined;
  return value;
}

export function makePreviewResponse(
  request: InspectionPreviewRequest,
  ok: boolean,
): InspectionPreviewResponse {
  return {
    kind: INSPECTION_PREVIEW_MESSAGE, ok, tabId: request.tabId, documentId: request.documentId,
    sequence: request.sequence,
  };
}

export function validateInspectionPreviewResponse(value: unknown): InspectionPreviewResponse | undefined {
  if (!isRecord(value) || value.kind !== INSPECTION_PREVIEW_MESSAGE || typeof value.ok !== 'boolean' ||
    !isTabId(value.tabId) || !isNonEmptyString(value.documentId) || typeof value.sequence !== 'number' ||
    !Number.isSafeInteger(value.sequence) || value.sequence < 0) return undefined;
  return value as unknown as InspectionPreviewResponse;
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
    (value.selection === undefined || (value.status === 'active' && isElementSnapshot(value.selection))) &&
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

export function makeRequest(operation: InspectionOperation, tabId: number, requestId: string, documentId?: string): InspectionRequest {
  return { kind: INSPECTION_MESSAGE, operation, tabId, requestId, ...(documentId === undefined ? {} : { documentId }) };
}
