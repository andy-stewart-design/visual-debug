import { describe, expect, it, vi } from 'vitest';
import { createInspectionController } from '../../apps/extension/lib/inspection-controller';
import { createActivationController } from '../../apps/extension/lib/activation';
import { applyPaddingStyleEdit, adjustPaddingValue, parsePaddingInput, readComputedPadding, type StyleEditRequest } from '../../apps/extension/lib/style-edit';

const request = (side: 'top' | 'right' | 'bottom' | 'left', value: number): StyleEditRequest => ({
  kind: 'visual-debug:style-edit', tabId: 3, documentId: 'doc-a', selectionId: 'selection-1',
  editId: `edit-${side}`, order: 1, property: 'padding', side, value,
});

describe('style editing primitives', () => {
  it('rejects unfinished/negative input and adjusts decimal arrows at zero', () => {
    expect(parsePaddingInput('')).toBeUndefined();
    expect(parsePaddingInput('-')).toBeUndefined();
    expect(parsePaddingInput('.')).toBeUndefined();
    expect(parsePaddingInput('1.')).toBeUndefined();
    expect(parsePaddingInput('1.25')).toBe(1.25);
    expect(adjustPaddingValue('1.5', 1)).toBe(2.5);
    expect(adjustPaddingValue('0.5', -1)).toBe(0);
    // Arrow handling must leave incomplete number drafts to the user rather
    // than producing a native step or an edit request.
    expect(adjustPaddingValue('', 1)).toBeUndefined();
    expect(adjustPaddingValue('1.', -1)).toBeUndefined();
    expect(adjustPaddingValue('-', 1)).toBeUndefined();
  });

  it('writes one physical longhand and reads computed padding back', () => {
    const calls: string[][] = [];
    const element = { isConnected: true, style: { setProperty: (name: string, value: string) => calls.push([name, value]) } } as unknown as Element;
    expect(applyPaddingStyleEdit(element, 'left', 2.25)).toBe(true);
    expect(calls).toEqual([['padding-left', '2.25px']]);
    vi.stubGlobal('getComputedStyle', () => ({ paddingTop: '1px', paddingRight: '2px', paddingBottom: '3px', paddingLeft: '2.25px' }));
    expect(readComputedPadding(element)).toEqual({ top: '1px', right: '2px', bottom: '3px', left: '2.25px' });
    vi.unstubAllGlobals();
  });

  it('serializes correlated edit commands after document and selection discovery', async () => {
    const selection = { selectionId: 'selection-1', tagName: 'div', box: { left: 0, top: 0, width: 10, height: 10 },
      computedStyle: { padding: { top: '1px', right: '1px', bottom: '1px', left: '1px' } } };
    const state = { status: 'active' as const, identity: { tabId: 3, documentId: 'doc-a', requestId: 'query' }, revision: 1, selection };
    const sent: StyleEditRequest[] = [];
    const activation = createActivationController({ transport: {
      send: vi.fn(async () => ({ kind: 'visual-debug:inspection' as const, ok: true, operation: 'query' as const,
        identity: state.identity, state })),
      sendStyleEdit: vi.fn(async (_tabId, edit) => {
        sent.push(edit);
        return { kind: 'visual-debug:style-edit' as const, ok: true, ...edit, state };
      }),
      inject: vi.fn(async () => undefined),
    } });
    const second = { ...request('right', 2), editId: 'edit-right', order: 2 };
    await Promise.all([activation.edit(3, request('top', 1)), activation.edit(3, second)]);
    expect(sent.map((edit) => edit.order)).toEqual([1, 2]);
    expect(sent.every((edit) => edit.documentId === 'doc-a' && edit.selectionId === 'selection-1')).toBe(true);
  });

  it('rejects a stale selection without invoking the page write helper', async () => {
    const editStyle = vi.fn(() => ({ ok: true }));
    const controller = createInspectionController({
      tabId: 3, documentId: 'doc-a',
      createSession: async () => ({ isDisposed: false, editStyle, dispose() {} }),
    });
    await controller.handle({ kind: 'visual-debug:inspection', operation: 'start', tabId: 3, requestId: 'start' });
    controller.selectionChanged({
      selectionId: 'selection-1', tagName: 'div', box: { left: 0, top: 0, width: 10, height: 10 },
      computedStyle: { padding: { top: '1px', right: '1px', bottom: '1px', left: '1px' } },
    });
    const response = await controller.handleStyleEdit({ ...request('top', 4), selectionId: 'selection-old' });
    expect(response.ok).toBe(false);
    expect(editStyle).not.toHaveBeenCalled();
  });
});
