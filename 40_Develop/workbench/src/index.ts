/**
 * CROS WorkbenchのProduction localhost入口。
 *
 * @packageDocumentation
 * @responsibility Browser向けWorkbench Shellをloopback限定で提供する公開境界を公開する。
 * @trace ARCH-000012
 * @boundary Workbench SubsystemとCLI・将来のCROS Adapterの公開境界。
 * @effect localhost Listenerを開始・終了し、承認済みBrand Assetを読取る。
 * @security 外部BindとRepository越境を許可せず、Credential管理は検証済み管理Contextが注入された場合だけ公開する。
 */
export type {
  CredentialAdministration,
  CredentialAdministrationResult,
} from "./credential-administration.ts";
export {
  type WorkbenchHandle,
  type WorkbenchStartRequest,
  startWorkbench,
} from "./workbench-server.ts";
export {
  readWorkbenchProjectSurface,
  type WorkbenchCapabilityState,
  type WorkbenchProjectSurface,
  type WorkbenchRecordCollection,
} from "./project-surface.ts";
