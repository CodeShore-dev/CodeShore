import { type DiagramViewState, useDiagramView } from '../components/diagram/useDiagramView';
import type { DbNode, DbView, DbViewId } from '../content/databaseSchema';
import { databaseSchema } from '../content/databaseSchema';

export type DatabaseSchemaViewState = DiagramViewState<DbNode, DbViewId, DbView>;

/**
 * 資料庫架構關係圖的視角（tab）／選取狀態（純前端）。切換 tab 時清除既有節點選取，
 * 詳細面板隨之關閉；只有 interactive 節點可被選取。共用 useDiagramView。
 */
export function useDatabaseSchemaView(): DatabaseSchemaViewState {
  return useDiagramView(databaseSchema);
}
