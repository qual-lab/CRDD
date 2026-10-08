/**
 * WorkbenchのQuality観測契約。
 *
 * @packageDocumentation
 * @responsibility Current Quality Projectionの利用可能、未構成および観測不能を型で区別する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @boundary Project Operation Quality Read ModelとWorkbench Client Modelの境界。
 * @effect N/A: 型定義だけを所有する。
 * @security Repository外情報を取得せず、Browser描画責務を所有しない。
 */
import type { RepositoryQualityProjection } from "../../../domain-model/src/index.ts";

/**
 * Workbenchが観測したCurrent Quality Projectionを定義する。
 *
 * @responsibility 利用可能、未構成および観測不能をQuality Projectionと同じ結果へ閉じる。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @shape state、projectionおよびreasonを表す。
 * @invariant 未構成または観測不能をQuality Readyへ変換しない。
 * @boundary Repository Quality ReaderとWorkbench Project Surfaceの型境界。
 * @security reasonは内部Pathを含まない固定値に限る。
 * @compatibility 状態追加時は全表示と試験を再評価する。
 */
export type WorkbenchQualityObservation = Readonly<{
  state: "available" | "not_configured" | "unknown";
  projection: RepositoryQualityProjection | null;
  reason: "quality_projection_invalid" | "observation_failed" | null;
}>;
