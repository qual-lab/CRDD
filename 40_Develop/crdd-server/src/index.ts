/**
 * CRDD Serverのクライアント向け型を公開する。
 *
 * @packageDocumentation
 * @responsibility Workbenchが利用するHTTP応答の型だけを既存の所有元から公開する。
 * @trace ARCH-000012
 * @boundary パッケージの型専用入口。実行時の公開入口は ./cli に限る。
 */
export type { ManagementResult, ManagementView } from "./service/access.ts";
export type { AiSelectionView } from "./service/configuration.ts";
export type {
  AiRequestMode,
  AiRequestSnapshot,
  AiResultItem,
} from "./service/execution.ts";
export type {
  OwnerArtifactCatalog,
  ProjectPlanObservation,
  ProjectQualityObservation,
} from "./service/project-context.ts";
export type { ViewResponse } from "./transport/api-types.ts";
