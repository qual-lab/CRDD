/**
 * Domain Modelの共通結果だけを公開する軽量境界。
 * @packageDocumentation
 * @responsibility 中立な結果型と結果検証だけを公開し、保存や個別Domainの実装を推移的に読み込まない。
 * @trace ARCH-000008
 * @boundary Repository観測Capabilityを利用側へ限定公開するPackage境界。
 */
export type {
  DomainIssue,
  DomainLocation,
  DomainOutcome,
  DomainStatus,
} from "./outcome.ts";
export { validateDomainOutcome } from "./outcome.ts";
