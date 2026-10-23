/**
 * Workbench起動Compositionが所有する非永続の表示状態。
 * @packageDocumentation
 * @responsibility 表示投影と直前操作結果の既存寿命を保ち、Server内の受付と表示処理へ同じ参照を渡す。
 * @trace ARCH-000012
 * @boundary Workbench起動Composition・HTTP受付・表示投影。
 * @security 資格、認可結果、Task正本、実行Owner、共有AI Sessionを保持せず、公開APIへexportしない。
 */
import type { AiSelectionSaveResult } from "../../../../coordinator/src/index.ts";
import type { ChangePublicationResult } from "../../../../version-control/src/index.ts";
import type { WorkbenchAiSelectionSurface } from "../ai-selection/projection.ts";
import type { WorkbenchAiRequestSnapshot } from "../ai-request/types.ts";
import type { WorkbenchProjectSurface } from "../project/surface.ts";
import type { TopicMeetingActionResult } from "../topic-meeting/action.ts";
import type { WorkbenchRuntimeActivityObservation } from "../activity/observe.ts";

/**
 * 主画面と起動が共有する接続形態の表示値。
 * @responsibility 単体と横断表示の既存区別だけを保持する。
 * @trace ARCH-000012
 * @shape repositoryまたはcros_available。
 * @invariant 認証・認可結果または内容公開のAuthorityとして使わない。
 * @boundary 起動Compositionと主画面投影。
 * @security 資格・Rootを含まない。
 * @compatibility 既存の表示値と同一である。
 */
export type WorkbenchConnectionState = "repository" | "cros_available";

/**
 * 一つの起動中だけ共有する表示値と直前結果。
 * @responsibility 既存変数の読取り・更新時点を変えず、操作受付と表示の間で保持する。
 * @trace ARCH-000012
 * @shape 現在投影、Profile表示、単体操作結果、単体AI表示ID・Snapshot・Notice、既存の活動観測。
 * @invariant 保存・clone・汎用更新APIを追加せず、共有AI Sessionと混在しない。
 * @boundary Server内の実Consumerだけで共有する型。
 * @security 認証資格や許可済みRootを表示状態のAuthorityとして保持しない。
 * @compatibility 既存のメモリ内変数だけをまとめ、通信・永続Schemaを変更しない。
 */
export type WorkbenchPresentationState = {
  runtimeActivityObservation: WorkbenchRuntimeActivityObservation | undefined;
  projectSurface: WorkbenchProjectSurface | undefined;
  aiSelection: WorkbenchAiSelectionSurface;
  lastActionResult: ChangePublicationResult | null;
  topicMeetingResult: TopicMeetingActionResult | null;
  currentAiRequestId: string | null;
  aiRequestSnapshot: WorkbenchAiRequestSnapshot | null;
  aiRequestNotice: string | null;
  aiSelectionManagementResult: AiSelectionSaveResult | null;
};
