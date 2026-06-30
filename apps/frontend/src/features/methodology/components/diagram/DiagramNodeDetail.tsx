import { useEffect, useRef } from 'react';

import { NodeRelationsList } from '../NodeRelationsList';
import type { NodeRelations } from '../nodeRelations';
import type { DiagramNodeBase } from './types';

export interface DiagramNodeDetailProps<TNode extends DiagramNodeBase> {
  readonly node: TNode | null;
  readonly onClose: () => void;
  // 本節點在目前視角的上下游關聯（次要資訊）。
  readonly relations?: NodeRelations;
  // usage 是否含本檔靜態信任的 HTML（content registry，無外部輸入）；預設純文字。
  readonly usageAsHtml?: boolean;
  // 標題是否以等寬字體呈現（資料庫物件名稱用）。
  readonly monoTitle?: boolean;
  // 角色文字的覆寫（如爬蟲在角色後附上即時職缺佔比）；預設顯示 node.detail.role。
  readonly formatRole?: (node: TNode) => string | undefined;
}

// 節點詳細面板（領域無關）：顯示選取節點的 label 與 detail.role／detail.usage（內容已無機密）。
// 鍵盤與焦點行為：Escape 關閉、開啟時焦點移入面板，關閉時還原至開啟前的觸發元素。
export function DiagramNodeDetail<TNode extends DiagramNodeBase>({
  node,
  onClose,
  relations,
  usageAsHtml = false,
  monoTitle = false,
  formatRole,
}: DiagramNodeDetailProps<TNode>) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    if (!node) return;

    previouslyFocused.current = document.activeElement;
    // preventScroll：移入焦點但不要把面板捲進視窗（避免點節點時頁面往上跳）。
    closeButtonRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const toRestore = previouslyFocused.current;
      if (toRestore instanceof HTMLElement) {
        toRestore.focus({ preventScroll: true });
      }
    };
  }, [node, onClose]);

  if (!node) return null;

  const roleText = formatRole ? formatRole(node) : node.detail?.role;

  return (
    <div
      role="dialog"
      aria-label={node.label}
      className="rounded-xl border border-[#c3c6d5] bg-white p-4 text-left shadow-2xl"
    >
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-[#e8eaf0] pb-2.5">
        <h3
          className={`text-base font-black tracking-tight text-[#001f2a] ${monoTitle ? 'font-mono break-all' : ''}`}
        >
          {node.label}
        </h3>
        <button
          ref={closeButtonRef}
          type="button"
          className="-m-1 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#9398a6] transition-colors hover:bg-[#f4faff] hover:text-[#001f2a]"
          aria-label="關閉說明"
          onClick={onClose}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            close
          </span>
        </button>
      </div>
      {node.detail && (
        <dl className="space-y-3">
          <div>
            <dt className="text-sm font-bold text-[#001f2a]">角色</dt>
            <dd className="mt-0.5 text-sm leading-relaxed font-normal text-[#5b6070]">{roleText}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-[#001f2a]">說明</dt>
            {usageAsHtml ? (
              <dd
                className="mt-0.5 text-sm leading-relaxed font-normal text-[#5b6070]"
                dangerouslySetInnerHTML={{ __html: node.detail.usage }}
              />
            ) : (
              <dd className="mt-0.5 text-sm leading-relaxed font-normal text-[#5b6070]">{node.detail.usage}</dd>
            )}
          </div>
        </dl>
      )}
      <NodeRelationsList incoming={relations?.incoming ?? []} outgoing={relations?.outgoing ?? []} />
    </div>
  );
}
