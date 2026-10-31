/**
 * 固定九目的のDocker実行と取消・清掃を一回の生涯へ閉じる。
 * @responsibility raw Handle、技術期限と終端を所有し、上位の意味・保存方式を知らない。
 * @trace ARCH-000008
 */
import type { OwnedCommandHandle } from "../process/start.ts";
import { types as utilTypes } from "node:util";
import type { DockerIsolationCommand } from "./plan.ts";
import type {
  DockerResourceCleanupObservation,
  DockerResourceReceipts,
} from "./execute.ts";
import {
  classifyDockerCommandExecution,
  classifyDockerProcessExit,
  classifyDockerCommandException,
  type CommandObservation,
  type DockerCommandExecutionClassification,
  type DockerProcessExitStatusClass,
} from "./result.ts";

const PURPOSES = [
  "create_subscription_auth_probe",
  "start_subscription_auth_probe_attached",
  "create_internal_network",
  "create_egress_network",
  "create_proxy",
  "connect_proxy_egress",
  "create_provider",
  "start_proxy",
  "start_provider_attached",
] as const;
const CREATE_PURPOSES = new Set<string>([
  "create_subscription_auth_probe",
  "create_internal_network",
  "create_egress_network",
  "create_proxy",
  "create_provider",
]);
const GRACE_MS = 5_000;
const SETUP_MS = 10_000;
const EXECUTION_MS = 300_000;

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
 * 固定技術順序と待機契約の非秘密説明を返す。
 * @responsibility 上位の説明値を実行Ownerと同じ定数へ結合する。
 * @trace ARCH-000008
 * @input N/A: 固定値のみ。
 * @returns 九目的と三期限、Provider期限の起算点。
 * @precondition 実観測の証拠には使わない。
 * @postcondition 実行Ownerと上位説明で定数を重複定義しない。
 * @effect N/A: 不変値の投影だけ。
 * @failure N/A: 外部処理なし。
 * @invariant 数値だけから実終了を推定しない。
 * @boundary 技術Ownerと契約説明。
 * @security 実行許可を発行しない。
 * @concurrency N/A: 同期投影。
 */
export function describeDockerCommandSessionContract() {
  return Object.freeze({
    purposes: Object.freeze([...PURPOSES]),
    setupTimeoutMs: SETUP_MS,
    providerTimeoutMs: EXECUTION_MS,
    cancellationGraceMs: GRACE_MS,
    providerDeadlineOrigin: "execution_started_observed" as const,
  });
}

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
      cancellationRequested: true;
      processTerminationObserved: boolean;
    }>
  >;
  completion: Promise<DockerCommandSessionResult>;
}>;

/**
 * 同じ固定計画の実行・取消・清掃を開始する。
 * @responsibility raw Handleを上位へ返さず、返却後に一回だけ実行する。
 * @trace ARCH-000008
 * @input purposes: 固定九目的。operations: 同じ技術Runtimeの元操作。hooks: 同期又は指定段階だけ非同期の通知。
 * @returns 不透明cancelと一回のcompletion。
 * @precondition 本番Runtimeが検証済み計画と元Ownerを保持している。
 * @postcondition 上位の開始保存Promiseは技術待機・清掃を妨げない。
 * @effect 所有ProcessとDocker資源を元Runtime経由で開始・終端・清掃する。
 * @failure 技術失敗と通知失敗を固定分類し、清掃は必ず一回試行する。
 * @invariant 同じHandleのterminate/joinを一回化し、終了後に再発行しない。
 * @boundary 固定技術順序と利用側の事実通知。
 * @security 任意argvや業務理由を生成しない。
 * @concurrency 返却前通知0。取消は通知await中も保持し、最終返却前に通知参照を破棄する。
 */
export function startDockerCommandSession(
  purposes: readonly DockerIsolationCommand["purpose"][],
  operations: DockerCommandSessionOperations,
  hooks: DockerExecutionCallbacks,
): DockerCommandSession {
  const callbacks: { current: DockerExecutionCallbacks | null } = {
    current: hooks,
  };
  const sequence =
    purposes.length === PURPOSES.length
      ? Object.freeze([...purposes])
      : Object.freeze([]);
  const receipts = {
    create_provider: { submitted: false, dockerId: null as string | null },
    create_proxy: { submitted: false, dockerId: null as string | null },
    create_subscription_auth_probe: {
      submitted: false,
      dockerId: null as string | null,
    },
    create_internal_network: {
      submitted: false,
      dockerId: null as string | null,
    },
    create_egress_network: {
      submitted: false,
      dockerId: null as string | null,
    },
  };
  let cancelled = false;
  let finished = false;
  let activeHandle: DockerSessionCommandHandle | null = null;
  const terminations = new WeakMap<
    DockerSessionCommandHandle,
    Promise<boolean>
  >();
  let purpose: DockerIsolationCommand["purpose"] | null = null;
  let stage: DockerSessionFailure["stage"] = "command_start";
  let gateName: keyof DockerExecutionCallbacks | null = null;
  let obtained = false;
  let observed = false;
  let failure: DockerSessionFailure | null = null;
  let executionStarted = false;
  let executionCompleted = false;
  let executionContainerCreated = false;
  let executionExit: DockerProcessExitStatusClass = "not_observed";
  let notificationDeliveryConfirmed = true;
  let notificationRequested = false;

  /**
   * 同じHandleの終端を一つのPromiseへ集約する。
   * @responsibility 取消と失敗の同時発火で二重終端を発行しない。
   * @trace ARCH-000008
   * @input handle: このSessionが取得した元Handle。
   * @returns 終端確認の同じPromise。
   * @precondition Handleを別Ownerへ移譲しない。
   * @postcondition 失敗はfalseで保持する。
   * @effect 元Handleの終端要求とjoinを一回発行する。
   * @failure 例外はfalse。元一次失敗を上書きしない。
   * @invariant 再呼出しは同じ要求を共有する。
   * @boundary Session私有Process。
   * @security 他Processを名前で操作しない。
   * @concurrency WeakMapへ待機前に登録する。
   */
  function terminate(handle: DockerSessionCommandHandle): Promise<boolean> {
    const existing = terminations.get(handle);
    if (existing) return existing;
    const pending = Promise.resolve()
      .then(() => handle.terminateAndWait(GRACE_MS))
      .catch(() => false);
    terminations.set(handle, pending);
    return pending;
  }

  /**
   * 最初の技術停止点だけを固定する。
   * @responsibility 元段階と固定例外分類をcleanupから独立して保持する。
   * @trace ARCH-000008
   * @input kind: 停止種別。error: 非公開の元例外。
   * @returns N/A: 私有停止点を更新する。
   * @precondition 同じ実行の同期段階内で呼ぶ。
   * @postcondition 二回目以後は元停止点を維持する。
   * @effect N/A: Process内の局所値だけ。
   * @failure 例外本文を結果へ渡さない。
   * @invariant 清掃失敗で一次失敗を消さない。
   * @boundary 私有失敗と固定搬送値。
   * @security Secret・stackを複製しない。
   * @concurrency 同期で一度だけ固定する。
   */
  function fail(kind: DockerSessionFailure["kind"], error?: unknown) {
    if (failure !== null) return;
    failure = Object.freeze({
      purpose,
      stage,
      gate: gateName,
      kind,
      exceptionCode:
        error === undefined ? null : classifyDockerCommandException(error),
      commandHandleObtained: obtained,
      responseObserved: observed,
    });
    if (notificationDeliveryConfirmed && callbacks.current?.onFailure) {
      notificationRequested = true;
      try {
        const delivered = callbacks.current?.onFailure?.(failure);
        if (utilTypes.isPromise(delivered))
          void Promise.prototype.then.call(
            delivered,
            undefined,
            () => undefined,
          );
        if (delivered !== undefined) notificationDeliveryConfirmed = false;
      } catch {
        notificationDeliveryConfirmed = false;
      }
    }
  }

  /**
   * 通知の完了を確認して次の要求との順序を保つ。
   * @responsibility 同期通知と待機可能な通知を区別し、ACKを受け取らない。
   * @trace ARCH-000008
   * @input name: 有限通知名。invoke: 通知呼出し。
   * @returns 通知が完了した場合だけtrue。外部の実行許可ではない。
   * @precondition 上位の意味を下位で再解釈しない。
   * @postcondition 待機可能な通知だけjoinし、通知を再送しない。
   * @effect 登録された通知を呼ぶ。保存方式・保存結果を解釈しない。
   * @failure 不正返値・例外では次要求0、技術清掃は継続。
   * @invariant 通知の失敗と技術cleanupを区別する。
   * @boundary 用途固定の同期／非同期通知。
   * @security 自由文を公開結果へ含めない。
   * @concurrency 再入取消は呼出し直後に再確認する。
   */
  async function gate(
    name: keyof DockerExecutionCallbacks,
    invoke: () => unknown,
  ): Promise<boolean> {
    stage = "gate";
    gateName = name;
    if (!callbacks.current?.[name]) return true;
    if (!notificationDeliveryConfirmed) return false;
    notificationRequested = true;
    try {
      const pending = invoke();
      const asynchronous =
        name === "onCommandSubmitting" ||
        name === "onCommandNotIssued" ||
        name === "onResourceCreated" ||
        name === "onExecutionSubmitting";
      if (!asynchronous && utilTypes.isPromise(pending)) {
        void pending.catch(() => {});
        notificationDeliveryConfirmed = false;
        fail("invalid_return");
        return false;
      }
      const accepted = asynchronous ? await pending : pending;
      if (accepted === undefined) return true;
      if (utilTypes.isPromise(accepted))
        void Promise.prototype.then.call(accepted, undefined, () => undefined);
      notificationDeliveryConfirmed = false;
      fail(accepted === false ? "rejected" : "invalid_return");
    } catch (error) {
      notificationDeliveryConfirmed = false;
      fail("threw", error);
    }
    return false;
  }

  /**
   * 同じ操作へ一回だけ取消をラッチする。
   * @responsibility raw Handleを隠して元Processの終端確認を返す。
   * @trace ARCH-000008
   * @input N/A: 所有する操作だけを取り消す。
   * @returns 取消要求と元Process終端の観測。
   * @precondition 開始APIが返した元の関数を用いる。
   * @postcondition 終了後は新Effectを発行しない。
   * @effect 活動中の所有Handleがある場合だけ終端する。
   * @failure 終端未確認はfalseで返す。
   * @invariant 取消要求を清掃確認と同一視しない。
   * @boundary 同じSessionの取消。
   * @security 別Operationへ作用しない。
   * @concurrency await前に取消をラッチする。
   */
  async function cancel() {
    cancelled = true;
    const handle = activeHandle;
    return Object.freeze({
      cancellationRequested: true as const,
      processTerminationObserved:
        finished || !handle ? true : await terminate(handle),
    });
  }

  const completion = Promise.resolve().then(async () => {
    try {
      if (
        sequence.length !== PURPOSES.length ||
        sequence.some((value, index) => value !== PURPOSES[index])
      ) {
        fail("invalid_plan");
      } else
        for (const current of sequence) {
          purpose = current;
          obtained = false;
          observed = false;
          gateName = null;
          if (cancelled) break;
          if (
            !(await gate("onCommandSubmitting", () =>
              callbacks.current?.onCommandSubmitting?.(current),
            ))
          )
            break;
          if (cancelled) {
            if (CREATE_PURPOSES.has(current))
              await gate("onCommandNotIssued", () =>
                callbacks.current?.onCommandNotIssued?.(current),
              );
            break;
          }
          const isExecution = current === "start_provider_attached";
          if (
            isExecution &&
            (!(await gate("onExecutionSubmitting", () =>
              callbacks.current?.onExecutionSubmitting?.(),
            )) ||
              cancelled)
          )
            break;
          stage = "command_start";
          gateName = null;
          if (CREATE_PURPOSES.has(current))
            receipts[current as keyof typeof receipts].submitted = true;
          const handle = operations.startCommand(current);
          obtained = true;
          activeHandle = handle;
          let providerWait: Promise<
            | Readonly<{ ok: true; result: CommandObservation | null }>
            | Readonly<{ ok: false; error: unknown }>
          > | null = null;
          if (isExecution) {
            stage = "provider_start_observation";
            if (!(await handle.started(GRACE_MS))) {
              fail("start_unconfirmed");
              await terminate(handle);
              activeHandle = null;
              break;
            }
            executionStarted = true;
            stage = "command_wait";
            providerWait = handle.wait(EXECUTION_MS).then(
              (result) => Object.freeze({ ok: true as const, result }),
              (error: unknown) => Object.freeze({ ok: false as const, error }),
            );
            stage = "provider_start_observation";
            gateName = "onExecutionStarted";
            try {
              if (callbacks.current?.onExecutionStarted)
                notificationRequested = true;
              const delivered = callbacks.current?.onExecutionStarted?.();
              if (utilTypes.isPromise(delivered))
                void Promise.prototype.then.call(
                  delivered,
                  undefined,
                  () => undefined,
                );
              if (delivered !== undefined) {
                notificationDeliveryConfirmed = false;
                fail("invalid_return");
                if (await terminate(handle)) await providerWait;
                activeHandle = null;
                break;
              }
            } catch (error) {
              notificationDeliveryConfirmed = false;
              fail("threw", error);
              if (await terminate(handle)) await providerWait;
              activeHandle = null;
              break;
            }
          }
          stage = "command_wait";
          gateName = null;
          let result: CommandObservation | null;
          if (providerWait) {
            const settled = await providerWait;
            if (!settled.ok) throw settled.error;
            result = settled.result;
          } else result = await handle.wait(SETUP_MS);
          observed = result !== null;
          activeHandle = null;
          if (cancelled && !CREATE_PURPOSES.has(current)) break;
          const classification = classifyDockerCommandExecution(result);
          if (
            current === "create_provider" &&
            classification.category === "completed"
          )
            executionContainerCreated = true;
          if (isExecution) {
            executionCompleted = result !== null;
            executionExit = classifyDockerProcessExit(result);
          }
          if (
            !(await gate("onCommandObserved", () =>
              callbacks.current?.onCommandObserved?.(
                current,
                result,
                classification,
              ),
            )) ||
            classification.category !== "completed"
          ) {
            if (failure === null) fail("command_failed");
            if (result === null) await terminate(handle);
            break;
          }
          if (CREATE_PURPOSES.has(current)) {
            const dockerId = result?.stdout.trim() ?? "";
            gateName = "onResourceCreated";
            stage = "gate";
            if (!/^[a-f0-9]{64}$/u.test(dockerId)) {
              fail("rejected");
              break;
            }
            receipts[current as keyof typeof receipts].dockerId = dockerId;
            if (
              !(await gate("onResourceCreated", () =>
                callbacks.current?.onResourceCreated?.(current, dockerId),
              ))
            )
              break;
          }
          if (cancelled) break;
          if (
            result &&
            !(await gate("onCommandCompleted", () =>
              callbacks.current?.onCommandCompleted?.(current, result),
            ))
          )
            break;
        }
    } catch (error) {
      fail("threw", error);
    }
    if (activeHandle) {
      await terminate(activeHandle);
      activeHandle = null;
    }
    let cleanup: DockerSessionCleanup;
    try {
      cleanup = await operations.cleanup(receipts);
    } catch {
      cleanup = Object.freeze({
        confirmed: false,
        processTreeTerminated: false,
        containersAbsent: false,
        networksAbsent: false,
        resourceObservations: null,
      });
    }
    let resourceObservations = cleanup.resourceObservations;
    if (operations.verifyCleanup) {
      try {
        resourceObservations = operations.verifyCleanup(cleanup);
      } catch {
        resourceObservations = null;
      }
    }
    callbacks.current = null;
    finished = true;
    activeHandle = null;
    return Object.freeze({
      failure: failure as DockerSessionFailure | null,
      notificationDeliveryConfirmed: notificationRequested
        ? notificationDeliveryConfirmed
        : null,
      callbackRegistrationReleased: callbacks.current === null,
      cancellationRequested: cancelled,
      executionStarted,
      executionCompleted,
      executionContainerCreated,
      executionExit,
      cleanup,
      resourceObservations,
      processTreeTerminationConfirmed:
        cleanup.confirmed &&
        cleanup.processTreeTerminated &&
        (!operations.verifyCleanup || resourceObservations != null),
    });
  });
  return Object.freeze({ cancel, completion });
}

/**
 * 非本番primitiveだけで固定順序を反証するCandidateを開始する。
 * @responsibility 本番Factoryと区別して同じ実Session本文を試験へ接続する。
 * @trace ARCH-000008
 * @input purposes、operations、hooks: 試験が所有する固定計画と代役。
 * @returns 非本番表示、不透明cancelとcompletion。
 * @precondition 注入primitiveのEffectは試験側が管理する。
 * @postcondition 本番Runtimeの私有Owner・結果検証へ接続しない。
 * @effect 注入した代役のEffectを発行し得る。Effect0を保証しない。
 * @failure 元Sessionの固定失敗を返す。
 * @invariant productionAuthorityは常にfalse。
 * @boundary 明示的な非本番試験。
 * @security 本番Capabilityを生成・差替えしない。
 * @concurrency 本番と同じ返却後開始・取消を使う。
 */
export function startDockerCommandSessionCandidate(
  purposes: readonly DockerIsolationCommand["purpose"][],
  operations: DockerCommandSessionOperations,
  hooks: DockerExecutionCallbacks,
): DockerCommandSession & Readonly<{ productionAuthority: false }> {
  return Object.freeze({
    ...startDockerCommandSession(purposes, operations, hooks),
    productionAuthority: false as const,
  });
}
