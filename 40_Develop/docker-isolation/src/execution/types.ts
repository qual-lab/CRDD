/**
 * 用途を持たない一回の隔離実行の技術契約。
 * @responsibility Container・Network・所有Processと通知・終了事実を表す。
 * @trace ARCH-000008
 */
import type { ResourceSnapshot } from "../cleanup/types.ts";
import type { OwnedCommandHandle } from "../process/start.ts";
import type {
  CommandObservation,
  DockerCommandExecutionClassification,
  DockerProcessExitStatusClass,
} from "./result.ts";
import type {
  DockerIsolationCommand,
  DockerIsolationCommandInput,
} from "./plan.ts";
import type { DockerResourceExpectation } from "../cleanup/plan.ts";
/**
 * Sessionが使用する元Process Handleの最小断面。
 * @responsibility 開始・待機・終端だけを同じ私有Ownerへ保持する。
 * @trace ARCH-000008
 * @shape started、wait、terminateAndWait。
 * @invariant Handleを上位結果へ公開しない。
 * @boundary 技術Runtime内部、または非本番Candidate。
 * @security Processを任意PIDから再構成しない。
 * @compatibility 元Handleの三操作を縮約せず利用する。
 */
export type DockerSessionCommandHandle = Pick<
  OwnedCommandHandle,
  "started" | "terminateAndWait"
> &
  Readonly<{ wait: (timeoutMs: number) => Promise<CommandObservation | null> }>;

/**
 * 一回の技術清掃の元結果を搬送する。
 * @responsibility 清掃boolと資源別の三値観測を分ける。
 * @trace ARCH-000008
 * @shape 四boolと任意の資源別観測。
 * @invariant 未観測を不存在へ補完しない。
 * @boundary 技術清掃Ownerと上位終了処理。
 * @security コピーした成功結果を真正としない。
 * @compatibility 既存清掃結果のfieldを保持する。
 */
export type DockerSessionCleanup = Readonly<{
  confirmed: boolean;
  processTreeTerminated: boolean;
  containersAbsent: boolean;
  networksAbsent: boolean;
  resourceObservations?: readonly DockerResourceCleanupObservation[] | null;
}>;

/**
 * 発行予定・元資源・完了観測と開始factの通知。
 * @responsibility 技術操作の拒否と上位意味の解釈を有限接続へ限定する。
 * @trace ARCH-000008
 * @shape 発行予定、未発行、元資源ID、完了観測と同期開始通知。
 * @invariant DIへTask・Writer・Credentialの意味を持ち込まない。
 * @boundary 通知の完了待ちと上位の保存・内容判断を区別する。
 * @security 通知は許可・保存成功・新Authorityを返さない。
 * @compatibility 通知例外で後続要求を止め、同じ資源の回収を維持する。
 */
export interface DockerExecutionCallbacks {
  onCommandSubmitting?(
    purpose: DockerIsolationCommand["purpose"],
  ): void | Promise<void>;
  onCommandNotIssued?(
    purpose: DockerIsolationCommand["purpose"],
  ): void | Promise<void>;
  onExecutionSubmitting?(): void | Promise<void>;
  onResourceCreated?(
    purpose: DockerIsolationCommand["purpose"],
    dockerId: string,
  ): void | Promise<void>;
  onCommandObserved?(
    purpose: DockerIsolationCommand["purpose"],
    result: CommandObservation | null,
    classification: DockerCommandExecutionClassification,
  ): void;
  onCommandCompleted?(
    purpose: DockerIsolationCommand["purpose"],
    result: CommandObservation,
  ): void;
  /** 開始済みProcessの技術signal。公開非同期通知のjoinはExecutorが所有する。 */
  onExecutionStarted?(): void;
  onFailure?(failure: DockerSessionFailure): void;
}

/**
 * Session内部の固定技術操作を接続する。
 * @responsibility 本番では同Runtimeの元操作だけを結合する。
 * @trace ARCH-000008
 * @shape 固定purpose開始、元清掃と元結果照合。
 * @invariant 上位Store・業務結果を所有しない。
 * @boundary 本番Runtime内、または明示した非本番Candidate。
 * @security 本番Factoryは外部primitiveを受け取らない。
 * @compatibility Candidate注入を実Effect0や本番真正性の証明としない。
 */
export type DockerCommandSessionOperations = Readonly<{
  startCommand: (
    purpose: DockerIsolationCommand["purpose"],
  ) => DockerSessionCommandHandle;
  cleanup: (receipts: DockerResourceReceipts) => Promise<DockerSessionCleanup>;
  verifyCleanup?: (
    result: DockerSessionCleanup,
  ) => readonly DockerResourceCleanupObservation[] | null | undefined;
}>;

/**
 * 下位の停止点を業務理由とは別に搬送する。
 * @responsibility 技術失敗または有限Gate拒否の元段階を保持する。
 * @trace ARCH-000008
 * @shape purpose、段階、Gate名、拒否種別、固定例外分類と二観測。
 * @invariant 後続cleanupで一次停止点を書き換えない。
 * @boundary 技術停止点と上位の公開理由選択。
 * @security 生例外・生出力・Pathを含めない。
 * @compatibility 上位の既存一次失敗fieldへ接続する。
 */
export type DockerSessionFailure = Readonly<{
  purpose: DockerIsolationCommand["purpose"] | null;
  stage:
    | "command_start"
    | "provider_start_observation"
    | "command_wait"
    | "gate";
  gate: keyof DockerExecutionCallbacks | null;
  kind:
    | "rejected"
    | "invalid_return"
    | "threw"
    | "start_unconfirmed"
    | "invalid_plan"
    | "command_failed";
  exceptionCode: string | null;
  commandHandleObtained: boolean;
  responseObserved: boolean;
}>;

/**
 * 一回の技術Sessionの終了観測を搬送する。
 * @responsibility 実行、取消、通知解放、清掃を別々の事実として保持する。
 * @trace ARCH-000008
 * @invariant 未観測の資源を不存在へ補完しない。
 */
export type DockerCommandSessionResult = Readonly<{
  resourceSnapshot?: ResourceSnapshot;
  failure: DockerSessionFailure | null;
  notificationDeliveryConfirmed: boolean | null;
  callbackRegistrationReleased: boolean;
  cancellationRequested: boolean;
  executionStarted: boolean;
  executionCompleted: boolean;
  executionContainerCreated: boolean;
  executionExit: DockerProcessExitStatusClass;
  cleanup: DockerSessionCleanup;
  resourceObservations:
    | readonly DockerResourceCleanupObservation[]
    | null
    | undefined;
  processTreeTerminationConfirmed: boolean;
}>;

/**
 * 元Sessionの取消と終了待機だけを上位へ返す。
 * @responsibility 生Handleや試験Candidateの表示を本番契約へ含めない。
 * @trace ARCH-000008
 * @invariant 取消要求と終了観測を同一視しない。
 */
export type DockerCommandSession = Readonly<{
  cancel: () => Promise<
    Readonly<{
      cancellationRequested: boolean;
      processTerminationObserved: boolean;
    }>
  >;
  completion: Promise<DockerCommandSessionResult>;
}>;
/**
 * 実行資源の技術計画。相関値は許可ではない。
 *
 * @responsibility 起動構成と限定stdinを同じ一回の実行へ結合する。
 * @trace ARCH-000004
 * @shape 上位相関Hash、Docker技術構成、限定stdin。
 * @invariant Task・Provider・Authority・保存Ownerの意味を持たない。
 * @boundary 上位の検証済み計画から隔離資源Ownerへの境界。
 * @security stdinと内部構成を診断へ複製しない。
 * @compatibility 同じ操作と構成以外の再利用を拒否する。
 */
export type DockerIsolationRuntimePlan = Readonly<{
  identity: string;
  configuration: DockerIsolationCommandInput;
  stdin: string | null;
}>;

/**
 * 本番隔離Runtimeへ渡す確定済み所在だけを表す。
 * @responsibility 既存依存契約の必要断面を再利用する。
 * @trace ARCH-000008
 * @invariant Process primitiveやCLI構成を上位へ公開しない。
 */
export type DockerIsolationRuntimeOptions = Readonly<{
  paths: Readonly<{ tmp: string; management: string }>;
}>;

/**
 * 固定隔離Runtimeの開始・清掃・照合操作を表す。
 * @responsibility 下位の技術操作を名前付きの契約で上位へ接続する。
 * @trace ARCH-000008
 * @invariant 上位のTask状態や保存方式を所有しない。
 */
export type HomeLease = Readonly<{ release: () => boolean }>;

/**
 * Docker実行とHome技術排他の有限操作。
 * @responsibility Taskや保存方式を持たず、元Handleの取得・実行・回収だけを扱う。
 * @trace ARCH-000008
 */
export type DockerIsolationRuntime = Readonly<{
  acquireHomeLease: (bindingHash: string) => HomeLease | null;
  startCommand: (
    purpose: DockerIsolationCommand["purpose"],
    plan: DockerIsolationRuntimePlan,
    managementCapability: unknown,
  ) => OwnedCommandHandle;
  cleanupOwnedResources: (
    plan: DockerIsolationRuntimePlan,
    recoveryCapability: object,
    managementCapability: unknown,
    receipts: DockerResourceReceipts | null,
  ) => Promise<DockerSessionCleanup>;
  verifyCleanupOutcome: (
    result: unknown,
    callerIdentity: string,
    recoveryCapability: unknown,
    managementCapability: unknown,
  ) => readonly DockerResourceCleanupObservation[] | null;
  startExecution: (
    plan: DockerIsolationRuntimePlan,
    recoveryCapability: object,
    managementCapability: unknown,
    hooks: DockerExecutionCallbacks,
  ) => DockerCommandSession;
}>;

/**
 * 五資源の作成要求と実IDの検査済み投影。
 *
 * @responsibility 明示未要求と作成結果不明を区別した読取り値を搬送する。
 * @trace ARCH-000008
 * @shape 各作成purposeにsubmittedと実Docker IDまたはnull。
 * @invariant nullを未要求または不存在へ補完しない。
 * @boundary 既存保存Ownerから技術清掃への用途限定投影。
 * @security 記録の読取り・Lock操作・新しいAuthorityは所有しない。
 * @compatibility 固定五purposeのReceiptを受理する。
 */
export type DockerResourceReceipts = Readonly<
  Record<
    | "create_provider"
    | "create_proxy"
    | "create_subscription_auth_probe"
    | "create_internal_network"
    | "create_egress_network",
    Readonly<{ submitted: boolean; dockerId: string | null }>
  >
>;

/**
 * 一資源の終了観測。清掃のboolから再構成しない。
 *
 * @responsibility 明示未要求、不存在、観測不能を別の値として返す。
 * @trace ARCH-000008
 * @shape purpose、予定名、実IDと三値の終了観測。
 * @invariant 不明を成功や未要求へ変換しない。
 * @boundary 技術清掃と上位の結果保存の間。
 * @security Path・本文・Secret・処置許可を含めない。
 * @compatibility 既存資源別終端観測と同じfieldを保持する。
 */
export type DockerResourceCleanupObservation = Readonly<{
  purpose: keyof DockerResourceReceipts;
  plannedResourceName: string;
  dockerId: string | null;
  observation: "not_requested" | "absent" | "unknown";
}>;

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

/** 必須通知は正常完了後に次のEffectへ進む。結果解釈通知は同期だけ。 */
export interface IsolationCallbacks {
  onSubmitting?(step: IsolationStep): void | Promise<void>;
  onNotIssued?(step: IsolationStep): void | Promise<void>;
  onCreated?(
    step: IsolationStep,
    snapshot: ResourceSnapshot,
  ): void | Promise<void>;
  onStarted?(step: IsolationStep): void;
  onObserved?(
    step: IsolationStep,
    result: CommandObservation | null,
    elapsedMs: number,
    errorCode: "ETIMEDOUT" | "ENOBUFS" | "PROCESS_FAILURE" | null,
  ): void;
  onCompleted?(step: IsolationStep, result: CommandObservation): void;
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
