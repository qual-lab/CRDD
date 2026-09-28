/**
 * WorkbenchのProject Plan観測契約。
 *
 * @packageDocumentation
 * @responsibility Current Release Projectionの利用可能、未構成および観測不能を型で区別する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @boundary Project Operation Release Read ModelとWorkbench Client Modelの境界。
 * @effect N/A: 型定義だけを所有する。
 * @security Repository外情報を取得せず、Browser描画責務を所有しない。
 */
import type { RepositoryReleaseProjection } from "../../project-operation/src/index.ts";

/**
 * Workbenchが観測したCurrent Release Projectionを定義する。
 *
 * @responsibility 利用可能、未構成および観測不能をProjection本体と同じ結果へ閉じる。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @shape state、projectionおよびreasonを表す。
 * @invariant 未構成または観測不能を空の計画へ変換しない。
 * @boundary Repository Release ReaderとWorkbench Project Surfaceの型境界。
 * @security reasonは内部Pathを含まない固定値に限る。
 * @compatibility 状態追加時は全表示と試験を再評価する。
 */
export type WorkbenchProjectPlanObservation = Readonly<{
  state: "available" | "not_configured" | "unknown";
  projection: RepositoryReleaseProjection | null;
  reason: "release_projection_invalid" | "observation_failed" | null;
}>;
