/**
 * 用途を持たない一回の隔離実行の技術契約。
 * @responsibility Container・Network・所有Processと通知・終了事実を表す。
 * @trace ARCH-000008
 */

import type { DockerResourceExpectation } from "../cleanup/plan.ts";
import type { ResourceSnapshot } from "../cleanup/types.ts";
import type { CommandObservation, IsolationCommandResult } from "./result.ts";

/** 固定セキュリティ条件へ与えるContainer構成。Docker flagは受け取らない。 */
export type IsolationContainer = Readonly<{
  kind: "container";
  key: string;
  name: string;
  ownershipLabel: string;
  image: string;
  argv: readonly string[];
  environment: Readonly<Record<string, string>>;
  mounts: readonly Readonly<{
    source: string;
    target: string;
    readOnly: boolean;
  }>[];
  network: string | null;
  networkAlias: "proxy" | null;
  user: "65532:65532" | "65534:65534";
  workingDirectory: "/work" | "/operation/workspace" | null;
  entrypoint: "python" | null;
  tmpfsBytes: 16777216 | 33554432 | null;
  interactive: boolean;
  tty: boolean;
  init: boolean;
  seccomp: Readonly<{ sha256: string; bytes: number }> | null;
}>;

/** 固定bridgeの内部又は外向きNetwork。 */
export type IsolationNetwork = Readonly<{
  kind: "network";
  key: string;
  name: string;
  ownershipLabel: string;
  internal: boolean;
}>;

/** 分岐・再送を持たない閉じた技術操作列。 */
export type IsolationStep =
  | Readonly<{
      key: string;
      action: "create";
      resource: string;
      timeoutMs: number;
    }>
  | Readonly<{
      key: string;
      action: "connect";
      resource: string;
      network: string;
      timeoutMs: number;
    }>
  | Readonly<{
      key: string;
      action: "run";
      resource: string;
      mode: "captured" | "interactive" | "detached";
      stdin: string | null;
      timeoutMs: number | null;
      stdoutLimitBytes: number;
      stderrLimitBytes: number;
      acceptedExitCodes: readonly number[];
      deadlineOrigin: "request" | "started";
    }>;

/** 実行内容はExecutorが確定し、技術順序・Process・回収はDIが所有する。 */
export type IsolationRequest = Readonly<{
  proxy?: Readonly<{
    resource: string;
    clients: readonly string[];
    profile: "codex" | "claude";
    token: string;
    additionalHosts: readonly string[] | null;
    environmentMode: "https" | "uppercase" | "all";
  }>;
  managementDirectory: string;
  resources: readonly (IsolationContainer | IsolationNetwork)[];
  steps: readonly IsolationStep[];
  cleanupOrder: readonly string[];
  setupTimeoutMs: number;
  unreceiptedAbsence: "retain" | "observe";
  verifyLabelAbsence: boolean;
}>;

/** 同じDI回収Ownerへ、元SnapshotとID欠測時だけの既存構成期待値を渡す。 */
export type IsolationCleanupRequest = Readonly<{
  managementDirectory: string;
  resources: ResourceSnapshot;
  cleanupOrder: readonly string[];
  setupTimeoutMs: number;
  unreceiptedAbsence: "retain" | "observe";
  verifyLabelAbsence: boolean;
  previouslyAbsent: readonly string[];
  discovery: readonly Readonly<{
    key: string;
    configurations: readonly Omit<DockerResourceExpectation, "dockerId">[];
  }>[];
}>;

/** 同Processの短命な準備結果。値のコピーや保存から実行を復元しない。 */
export interface PreparedIsolation {
  readonly resources: ResourceSnapshot;
}

/** 必須通知は正常完了後に次のEffectへ進む。結果解釈通知は同期だけで、同じ観測の分類を搬送する。 */
export interface IsolationCallbacks {
  onSubmitting?(step: IsolationStep): void | Promise<void>;
  onNotIssued?(step: IsolationStep): void | Promise<void>;
  onCreated?(
    step: IsolationStep,
    snapshot: ResourceSnapshot,
  ): void | Promise<void>;
  onStarted?(step: IsolationStep): void;
  onObserved?(step: IsolationStep, result: IsolationCommandResult): void;
  onCompleted?(
    step: IsolationStep,
    result: IsolationCommandResult &
      Readonly<{ observation: CommandObservation }>,
  ): void;
  onCleanupSubmitting?(resourceKey: string): void | Promise<void>;
  onResourceIdentified?(
    resourceKey: string,
    snapshot: ResourceSnapshot,
  ): void | Promise<void>;
  onCleanupCompleted?(resourceKey: string): void | Promise<void>;
  onResourcesClosed?(
    resources: ResourceSnapshot,
    observations: IsolationExecutionResult["cleanup"]["observations"],
  ): void | Promise<void>;
}

/** 一次停止点はCleanupで上書きしない。秘密値・生例外を搬送しない。 */
export type IsolationFailure = Readonly<{
  stepKey: string | null;
  stage: "preparation" | "notification" | "start" | "wait" | "observation";
  reason: string;
  notification: keyof IsolationCallbacks | null;
  commandHandleObtained: boolean;
  responseObserved: boolean;
  exceptionCode: string | null;
  kind: "threw" | "invalid_return" | "start_unconfirmed" | "command_failed";
}>;

/** 要求・終了・回収を別々の事実として返す。 */
export type IsolationExecutionResult = Readonly<{
  failure: IsolationFailure | null;
  resources: ResourceSnapshot;
  cancellationRequested: boolean;
  processTerminationConfirmed: boolean;
  notificationDeliveryConfirmed: boolean | null;
  callbackRegistrationReleased: boolean;
  cleanup: Readonly<{
    confirmed: boolean;
    configCleanupConfirmed: boolean;
    observations: readonly Readonly<{
      key: string;
      observation: "not_requested" | "absent" | "unknown";
    }>[];
  }>;
}>;

/** 取消要求と最終的な終了・Cleanupの成立を分ける。 */
export interface IsolationExecution {
  cancel(): Promise<
    Readonly<{
      cancellationRequested: boolean;
      processTerminationObserved: boolean;
    }>
  >;
  readonly completion: Promise<IsolationExecutionResult>;
}
