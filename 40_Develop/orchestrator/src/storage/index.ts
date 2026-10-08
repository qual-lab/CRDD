/**
 * Orchestratorの現在状態・Queue・履歴保存の公開入口。
 *
 * @packageDocumentation
 * @responsibility 本番利用側を単一Snapshot保存へ接続し、旧形式の互換Writerを公開しない。
 * @trace ARCH-000004
 */
export {
  createCurrentProjectRuntimePersistencePorts,
  createProjectRuntimeSnapshotPersistencePorts,
  inspectProjectRuntimeSnapshotIntake,
  readCurrentProjectRuntimeState,
  readProjectRuntimeSnapshot,
  initializeProjectRuntimeSnapshot,
  maintainProjectRuntimeSnapshot,
  createProjectRuntimeSnapshotAcceptanceDecisionStore,
  createProjectRuntimeSnapshotDecisionRecoveryStore,
  createProjectRuntimeSnapshotIntegrationRecordPort,
} from "./current-state-store.ts";
