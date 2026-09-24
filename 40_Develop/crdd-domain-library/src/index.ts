/**
 * CRDD共通Domain Libraryの名前空間付き公開境界。
 * @packageDocumentation
 * @responsibility Artifact、現実追跡、Repository観測、変更と品質状態のDomain能力を分離して公開する。
 * @trace ARCH-000008
 * @boundary Repository観測Capabilityを利用側へ限定公開するPackage境界。
 */
export * as artifact from "./artifact/index.ts";
export * as filesystemStoreRoot from "./filesystem-store-root/index.ts";
export * as qualityChangeControl from "./quality-change-control/index.ts";
export * as realityTraceability from "./reality-traceability/index.ts";
export * as repositoryObservation from "./repository-observation/index.ts";
export type {
  DomainIssue,
  DomainLocation,
  DomainOutcome,
  DomainStatus,
} from "./outcome.ts";
export { validateDomainOutcome } from "./outcome.ts";
