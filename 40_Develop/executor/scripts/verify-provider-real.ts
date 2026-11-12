/**
 * 合成入力だけを使うExecutor単段試験の明示CLI。
 * @packageDocumentation
 * @responsibility 計画表示・明示実行・一子の実行と終了後清掃を接続する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @boundary 試験専用。実行前に会話等で用途限定承認を取得する。端末入力は要求しない。
 */

import { fork, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import { readReport, writeReport, removeReport } from "./report.ts";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import type { AttemptDiagnosticNotice } from "../src/index.ts";
import type {
  TaskFixtureReceipt,
  TrialMode,
} from "../tests/support/task-trial.ts";

type TrialResult = Readonly<{
  mode: TrialMode;
  fixtureReceipt: TaskFixtureReceipt | null;
  cancellationConfirmed: boolean;
  reviewToolObservation: Readonly<{
    commandExecutionStartedCount: number;
    fileChangeStartedCount: number;
  }> | null;
  status: "completed" | "blocked" | "cancelled";
  reason: string | null;
  recoveryId: string | null;
  cleanupConfirmed: boolean;
  releaseConfirmed: boolean;
  terminalSaved: boolean;
  operationCleanupConfirmed: boolean;
  contentConfirmed: boolean;
  resultSha256: string | null;
  resultBytes: number;
  diagnostic: Readonly<
    Pick<
      Extract<
        AttemptDiagnosticNotice,
        { event: "coordinator_provider_boundary_settled" }
      >,
      | "primaryFailure"
      | "providerProcessStartedObserved"
      | "processTreeTerminationObserved"
      | "containersAbsentObserved"
      | "networksAbsentObserved"
      | "cleanupConfirmed"
    >
  > | null;
}>;

registerHooks({
  resolve(s, c, n) {
    const r = n(s, c);
    if (r.url.includes("/coordinator/"))
      throw Error("trial_coordinator_forbidden");
    return r;
  },
});

const { resolveModelSelection } = await import("../../ai-adapter/src/index.ts");

const { describeIsolationConfiguration } = await import(
  "../../docker-isolation/src/index.ts"
);

const {
  validateCoordinatorResourceBook,
  validateCoordinatorResourceBookTransition,
  ensureRepositoryRuntimeDataArea,
  requireReadyRepositoryRuntimeDataArea,
  observeRepositoryRuntimeDataArea,
  RepositoryRuntimeDataAreaBlockedError,
} = await import("../../domain-model/src/index.ts");
const { getRepository } = await import("../../version-control/src/index.ts");

const { observeProviderHome } = await import("./provider-home.ts");

const { isPrimaryFailureDiagnostic } = await import(
  "./provider-attempt-host.ts"
);

// 親子通信の待機上限。旧Session由来の現行値を維持する。
const TRIAL_COMPLETION_TIMEOUT_MS = 820_000;
const TRIAL_CANCELLATION_GRACE_MS = 5_000;

const { describeAdviceResultSchema, parseAdviceResult: normalizeAdviceResult } =
  await import("../../ai-adapter/src/provider/advice-result.ts");

const { createStandaloneProviderAttemptHost } = await import(
  "./provider-attempt-host.ts"
);

const {
  describeTaskTrial,
  buildTaskTrialRequest,
  createTaskTrialFixture,
  verifyTaskTrialResult,
  cleanupTaskTrialFixture,
} = await import("../tests/support/task-trial.ts");

const reference = "synthetic-context";

const prompt = [
  "Synthetic Context [synthetic-context]: A demo application has one pending documentation task. No implementation has started. The next option is to write a short plan. Read only this context. Do not use tools. Return the requested structured advice with one short fact and one next option, each referencing synthetic-context. Use empty sharedAnalysis and additionalInferences arrays. Do not include repository paths or credentials.",
  "Return only one JSON object matching this exact JSON Schema:",
  JSON.stringify(describeAdviceResultSchema()),
  `Allowed references: ${JSON.stringify([reference])}`,
].join("\n");

const script = fileURLToPath(import.meta.url);

const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/**
 * 固定合成入力・Model・Imageだけを副作用なしで示す。
 * @responsibility 表示内容と実際の送信内容を同一に固定する。
 * @trace ERB-IT-002
 * @input provider: exact二値。
 * @returns 承認対象の非秘密計画。
 * @effect N/A: 同梱Catalogと純粋builderだけ。
 * @failure 未対応Model／用途は停止。
 * @boundary 計画は現在の認証・Image存在・実行許可を証明しない。
 */
export function describeStandaloneProviderTrial(
  provider: unknown,
  mode: TrialMode = "advice",
) {
  if (provider !== "codex" && provider !== "claude")
    throw Error("trial_provider_invalid");
  if (mode !== "advice") return describeTaskTrial(provider, mode);
  const model = provider === "codex" ? "gpt-6.1-sol" : "claude-opus-5-5";
  const selected = resolveModelSelection({
    provider,
    modelIdentifier: model,
    reasoningEffort: "medium",
    purpose: "advice",
  });
  if (selected.status !== "resolved") throw Error("trial_model_unavailable");
  return Object.freeze({
    contract: "crdd/executor/standalone-trial/v2",
    mode: "advice" as const,
    provider,
    model,
    effort: "medium" as const,
    prompt,
    promptSha256: digest(prompt),
    providerImageDigest:
      provider === "codex"
        ? describeIsolationConfiguration("codex").assets.alternateIdentity
            .fixedImageDigest
        : describeIsolationConfiguration("claude").assets.fixedImageDigest,
    proxyImageDigest:
      describeIsolationConfiguration(provider).proxy.imageDigest,
    repositoryMounted: false,
    workspaceMounted: false,
    toolsAllowed: false,
    sessionPersistenceAllowed: false,
    maximumProviderRequests: 1,
  });
}

/**
 * 同じ固定合成Packetと観測済みHomeを既存計画へ束縛する。
 * @responsibility 選定・Prompt・非共有境界・Commandの相関を保つ。
 * @trace ERB-IT-002
 * @input spec: 固定記述、root: 新品Root、home: 現観測候補。
 * @returns 既存resolveValidatedPlanを満たす固定用途の計画。
 * @effect 暗号学的乱数で今回の名前だけを生成する。
 * @failure 役割・Model・Prompt・Mount差で停止。
 * @boundary 任意Prompt・任意Pathを受け付けず、編集は固定合成Fileだけ。
 */
export function buildStandaloneTrialRequest(
  spec: ReturnType<typeof describeStandaloneProviderTrial>,
  root: string,
  home: Extract<
    ReturnType<typeof observeProviderHome>,
    { status: "candidate" }
  >,
  homePath: string,
): import("../src/index.ts").ExecutorRequest<"attempt"> {
  if (
    JSON.stringify(spec) !==
    JSON.stringify(describeStandaloneProviderTrial(spec.provider, spec.mode))
  )
    throw Error("trial_spec_changed");
  if (spec.mode !== "advice")
    return buildTaskTrialRequest(spec, root, home, homePath);
  const operationId = `OP-${BigInt(`0x${randomBytes(12).toString("hex")}`)
    .toString()
    .padStart(6, "0")}`;
  const selected = resolveModelSelection({
    provider: spec.provider,
    modelIdentifier: spec.model,
    reasoningEffort: spec.effort,
    purpose: "advice",
  });
  if (selected.status !== "resolved") throw Error("trial_selection_invalid");
  const selection = selected.value;
  const technicalSelection = Object.freeze({
    provider: selection.provider,
    modelIdentifier: selection.modelIdentifier,
    identifierKind: selection.identifierKind,
    reasoningEffort: selection.reasoningEffort,
    purpose: selection.purpose,
  });
  return Object.freeze({
    kind: "attempt",
    ...{
      purpose: "advice",
      input: prompt,
      additionalHosts: null,
      allowedReferences: Object.freeze([reference]),
    },
    target: {
      ...{
        provider: home.provider,
        providerHomeIdentityHash: home.providerHomeIdentityHash,
        stableLogicalHomeBindingHash: home.stableLogicalHomeBindingHash,
        operationId,
        grantRef: `PHMGRANT-${randomBytes(12).toString("hex").toUpperCase()}`,
      },
      workspaceSourcePath: path.join(root, "work"),
      temporarySourcePath: path.join(root, "tmp"),
      activeMountCapability: {},
      providerHomeSourcePath: homePath,
    },
    selection: technicalSelection,
  });
}

/**
 * 一つの子Process内で観測・排他・単段実行をjoinする。
 * @responsibility 失敗時にexact参照とRootを保持し、再試行しない。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @input 承認済み固定Provider・IDと同一子の取消通知。
 * @returns 生出力・Home metadataなしの限定結果。
 * @precondition 親の同意とIPC相関、名前付きtests領域の準備が確認済み。
 * @postcondition 元completionを待ち、未確認を成功にしない。
 * @effect 新品Root・Node実体観測・同期排他・固定Executor一回。
 * @failure 取得null／保存拒否／終了不明はRoot保持。
 * @invariant Signalは同じControlへ配送し、Task再送・別回復を作らない。
 * @boundary 試験用Hostだけ。本番Host喪失回復の代替ではない。
 * @security 認証値・AI本文・stdout/stderrを記録しない。
 * @concurrency 同じ試行の取消を一回要求してcompletionをjoinする。
 */
export async function runStandaloneProviderTrial(
  provider: unknown,
  runId: unknown,
  signal: AbortSignal,
  onRoot: (root: string) => Promise<void> = async () => {},
  onRecovery: (id: string) => Promise<void> = async () => {},
  mode: TrialMode = "advice",
): Promise<TrialResult> {
  const spec = describeStandaloneProviderTrial(provider, mode);
  if (
    typeof runId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9-]{7,63}$/u.test(runId)
  )
    throw Error("trial_id_invalid");
  const repository = fs.realpathSync(
    fileURLToPath(new URL("../../../", import.meta.url)),
  );
  const verified = getRepository(repository);
  if (verified.status !== "completed") throw Error(verified.reason);
  const area = observeRepositoryRuntimeDataArea(verified.capability, "tests");
  if (area.status !== "ready") throw Error(area.reason);
  const parent = area.directory;
  if (signal.aborted) throw Error("trial_cancelled_before_root");
  const root = path.join(parent, `executor-real-${spec.provider}-${runId}`);
  fs.mkdirSync(root);
  await onRoot(root);
  let reason: string | null = null,
    recoveryId: string | null = null,
    operationCleanupConfirmed = true,
    releaseConfirmed = false,
    terminalSaved = false,
    cleanupConfirmed = false,
    contentConfirmed = false,
    resultSha256: string | null = null,
    resultBytes = 0;
  let fixtureReceipt: TaskFixtureReceipt | null = null;
  let processStartedCount = 0,
    cancelCount = 0,
    cancellationConfirmed = false;
  let reviewToolObservation: TrialResult["reviewToolObservation"] = null;

  let cancelCurrent: (() => Promise<unknown>) | null = null;
  let diagnostic: TrialResult["diagnostic"] = null;
  let cancellation: Promise<unknown> | null = null;
  const cancel = () => {
    if (cancelCurrent && !cancellation) {
      cancelCount++;
      cancellation = cancelCurrent()
        .then((value) => {
          cancellationConfirmed =
            !!value &&
            typeof value === "object" &&
            Reflect.get(value, "status") === "requested" &&
            Reflect.get(value, "processTerminationObserved") === true;
          return value;
        })
        .catch(() => {
          reason ??= "trial_cancel_unconfirmed";
        });
    }
  };
  signal.addEventListener("abort", cancel);
  try {
    const local = process.env.LOCALAPPDATA;
    if (
      !local ||
      !path.win32.isAbsolute(local) ||
      path.win32.normalize(local) !== local
    )
      throw Error("trial_environment_invalid");
    const homePath = path.win32.join(
      local,
      "Qual-Lab",
      "CRDD",
      "ProviderHomes",
      spec.provider,
    );
    operationCleanupConfirmed = false;
    const first = observeProviderHome(spec.provider, homePath);
    operationCleanupConfirmed = first.filesystemEffectIssued === false;
    if (first.status !== "candidate" || first.filesystemEffectIssued)
      throw Error("trial_home_unconfirmed");
    const request = buildStandaloneTrialRequest(spec, root, first, homePath);
    const host = createStandaloneProviderAttemptHost(root, request, () => {
      processStartedCount++;
      if (mode === "cancel") queueMicrotask(cancel);
    });
    if (mode !== "advice") fixtureReceipt = createTaskTrialFixture(root, mode);
    recoveryId = host.recoveryId;
    await onRecovery(recoveryId);
    fs.mkdirSync(path.join(root, "tmp"));
    fs.mkdirSync(path.join(root, "management"));
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (signal.aborted)
      throw Error("trial_cancelled_or_lease_lost_before_start");
    const started = host.start();
    if (started.status !== "started") {
      reason = started.reason;
      cleanupConfirmed = started.cleanupConfirmed;
    } else {
      cancelCurrent = () =>
        host.runtime.cancel({
          controlCapability: started.controlCapability,
          managementCapability: host.management,
        });
      if (signal.aborted) cancel();
      const result = await started.completion;
      diagnostic = host.readDiagnostic();
      operationCleanupConfirmed &&= host.operationCleanupConfirmed;
      releaseConfirmed = host.releaseConfirmed;
      if (host.homeFailure) reason ??= host.homeFailure;
      if (cancellation) await cancellation;
      if (result.status !== "completed") reason ??= result.reason;
      cleanupConfirmed = result.cleanupConfirmed;
      resultSha256 = result.resultSha256;
      resultBytes = result.resultBytes;
      terminalSaved = host.recordTerminal(result);
      const normalized = result.normalizedResult;
      if (mode === "cancel") {
        contentConfirmed = false;
        if (
          result.status !== "cancelled" ||
          processStartedCount !== 1 ||
          cancelCount !== 1 ||
          !cancellationConfirmed ||
          result.reason !== "provider_operation_cancelled"
        )
          reason = "trial_cancellation_unconfirmed";
      } else if (mode !== "advice" && fixtureReceipt) {
        contentConfirmed = verifyTaskTrialResult(
          root,
          mode,
          fixtureReceipt,
          normalized,
        );
        if (mode === "review" && spec.provider === "codex") {
          const observed =
            normalized && typeof normalized === "object"
              ? Reflect.get(result, "providerExecutionObservation")
              : null;
          if (
            observed &&
            typeof observed === "object" &&
            ["commandExecutionStartedCount", "fileChangeStartedCount"].every(
              (k) =>
                Number.isSafeInteger(Reflect.get(observed, k)) &&
                Number(Reflect.get(observed, k)) >= 0 &&
                Number(Reflect.get(observed, k)) <= 4096,
            )
          )
            reviewToolObservation = Object.freeze({
              commandExecutionStartedCount: Number(
                Reflect.get(observed, "commandExecutionStartedCount"),
              ),
              fileChangeStartedCount: Number(
                Reflect.get(observed, "fileChangeStartedCount"),
              ),
            });
        }
        if (!contentConfirmed) reason ??= "trial_task_content_unconfirmed";
      } else if (
        normalized &&
        typeof normalized === "object" &&
        Object.hasOwn(normalized, "facts")
      ) {
        const advice = normalizeAdviceResult(
          JSON.stringify({
            status: Reflect.get(normalized, "status"),
            facts: Reflect.get(normalized, "facts"),
            sharedAnalysis: Reflect.get(normalized, "sharedAnalysis"),
            additionalInferences: Reflect.get(
              normalized,
              "additionalInferences",
            ),
            nextOptions: Reflect.get(normalized, "nextOptions"),
          }),
          [reference],
        );
        contentConfirmed = advice.status === "confirmed";
        if (result.status === "completed" && terminalSaved && !contentConfirmed)
          reason ??= advice.reason;
      }
      if (
        result.status === "completed" &&
        (!terminalSaved || !contentConfirmed)
      )
        reason ??= "trial_terminal_or_advice_unconfirmed";
    }
  } catch (error) {
    const fixedReason = error instanceof Error ? error.message : null;
    reason ??=
      fixedReason !== null &&
      [
        "trial_environment_invalid",
        "trial_home_unconfirmed",
        "trial_lease_acquisition_unknown",
        "trial_home_changed_or_unconfirmed",
        "trial_cancelled_or_lease_lost_before_start",
      ].includes(fixedReason)
        ? fixedReason
        : "trial_failed_closed";
  } finally {
    signal.removeEventListener("abort", cancel);
  }
  if (signal.aborted) reason ??= "trial_cancelled";
  if (!releaseConfirmed) reason ??= "trial_home_release_unconfirmed";
  if (!operationCleanupConfirmed)
    reason ??= "trial_home_observation_cleanup_unconfirmed";
  return Object.freeze({
    mode,
    fixtureReceipt,
    cancellationConfirmed,
    reviewToolObservation,
    status:
      reason === null &&
      cleanupConfirmed &&
      releaseConfirmed &&
      terminalSaved &&
      operationCleanupConfirmed &&
      contentConfirmed
        ? "completed"
        : signal.aborted ||
            (mode === "cancel" &&
              reason === "provider_operation_cancelled" &&
              cancelCount === 1 &&
              cancellationConfirmed)
          ? "cancelled"
          : "blocked",
    reason,
    recoveryId,
    cleanupConfirmed,
    releaseConfirmed,
    terminalSaved,
    operationCleanupConfirmed,
    contentConfirmed,
    resultSha256,
    resultBytes,
    diagnostic,
  });
}

/**
 * 既存の非秘密一次故障と終了観測だけを受理する。
 * @responsibility 診断をAuthorityや清掃成功の代用にしない。
 * @trace ERB-IT-004
 * @input IPC又は今回記録の診断値。
 * @returns 閉じた形式ならtrue。
 * @effect N/A: 値検査のみ。
 * @failure 余分field・生例外・不正値は拒否する。
 * @boundary 試験子から親の有限結果。
 */
function isTrialDiagnostic(value: unknown): boolean {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const flags = [
    "providerProcessStartedObserved",
    "processTreeTerminationObserved",
    "containersAbsentObserved",
    "networksAbsentObserved",
    "cleanupConfirmed",
  ];
  return (
    Object.keys(v).sort().join(",") ===
      [...flags, "primaryFailure"].sort().join(",") &&
    isPrimaryFailureDiagnostic(v.primaryFailure) &&
    flags.every((key) => typeof v[key] === "boolean")
  );
}

/**
 * 子の有限結果を閉じた非秘密形式として確認する。
 * @responsibility 例外本文や生出力を親の結果へ混入させない。
 * @trace ERB-IT-004
 * @input IPC値。
 * @returns 正規結果かnull。
 * @effect N/A: 値検査だけ。
 * @failure 欠落・余分field・不正値を拒否。
 * @boundary 子Processから親の表示・清掃判断。
 */
function parseMode(value: unknown): TrialMode {
  if (value === undefined) return "advice";
  if (
    value !== "advice" &&
    value !== "edit" &&
    value !== "review" &&
    value !== "cancel"
  )
    throw Error("trial_mode_invalid");
  return value;
}

function validFixtureReceipt(value: unknown): value is TaskFixtureReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const valid = (x: unknown) =>
    typeof x === "string" && /^[0-9]+:[0-9]+:[0-9]+$/.test(x);
  return (
    Object.keys(v).sort().join(",") ===
      "directories,rootIdentity,sourceIdentity" &&
    valid(v.rootIdentity) &&
    Array.isArray(v.directories) &&
    v.directories.length === 3 &&
    v.directories.every(valid) &&
    valid(v.sourceIdentity)
  );
}

function trialResult(
  value: unknown,
  mode: TrialMode = "advice",
): TrialResult | null {
  if (
    !value ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return null;
  const v = value as Record<string, unknown>;
  if (v.mode !== mode || typeof v.cancellationConfirmed !== "boolean")
    return null;
  if (v.reviewToolObservation !== null) {
    if (
      mode !== "review" ||
      !v.reviewToolObservation ||
      typeof v.reviewToolObservation !== "object"
    )
      return null;
    const o = v.reviewToolObservation as Record<string, unknown>;
    if (
      Object.keys(o).sort().join(",") !==
        "commandExecutionStartedCount,fileChangeStartedCount" ||
      Object.values(o).some(
        (n) => !Number.isSafeInteger(n) || Number(n) < 0 || Number(n) > 4096,
      )
    )
      return null;
  }
  if (
    mode === "advice"
      ? v.fixtureReceipt !== null
      : !validFixtureReceipt(v.fixtureReceipt) && !beforeRecoveryFailure(v)
  )
    return null;
  if (
    Object.keys(v).sort().join(",") !==
    [
      "status",
      "mode",
      "fixtureReceipt",
      "cancellationConfirmed",
      "reviewToolObservation",
      "reason",
      "recoveryId",
      "cleanupConfirmed",
      "releaseConfirmed",
      "terminalSaved",
      "operationCleanupConfirmed",
      "contentConfirmed",
      "resultSha256",
      "resultBytes",
      "diagnostic",
    ]
      .sort()
      .join(",")
  )
    return null;
  if (
    !["completed", "blocked", "cancelled"].includes(String(v.status)) ||
    !(
      v.reason === null ||
      (typeof v.reason === "string" && /^[a-z0-9_]{1,160}$/u.test(v.reason))
    ) ||
    !(
      v.recoveryId === null ||
      (typeof v.recoveryId === "string" &&
        /^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
          v.recoveryId,
        ))
    ) ||
    !(
      v.resultSha256 === null ||
      (typeof v.resultSha256 === "string" &&
        /^[a-f0-9]{64}$/u.test(v.resultSha256))
    ) ||
    !Number.isSafeInteger(v.resultBytes) ||
    Number(v.resultBytes) < 0 ||
    !isTrialDiagnostic(v.diagnostic)
  )
    return null;
  if (
    [
      "cleanupConfirmed",
      "releaseConfirmed",
      "terminalSaved",
      "operationCleanupConfirmed",
      "contentConfirmed",
    ].some((key) => typeof v[key] !== "boolean")
  )
    return null;
  if (
    v.status === "completed" &&
    (v.reason !== null ||
      !v.recoveryId ||
      !v.resultSha256 ||
      Number(v.resultBytes) === 0 ||
      [
        "cleanupConfirmed",
        "releaseConfirmed",
        "terminalSaved",
        "operationCleanupConfirmed",
        "contentConfirmed",
      ].some((key) => v[key] !== true))
  )
    return null;
  return Object.freeze({ ...v }) as TrialResult;
}

/**
 * 回復参照発行前の準備拒否を、清掃成功とは別に搬送する。
 * @responsibility 元の固定理由を落とさず、資源終了・実行成功を補完しない。
 * @trace ERB-IT-004
 * @effect N/A: 閉形式結果の値照合だけ。
 * @boundary 回復ACK前の失敗結果だけ。ACK後は元回復参照一致が必須。
 */
function beforeRecoveryFailure(value: Readonly<Record<string, unknown>>) {
  return (
    [
      "trial_environment_invalid",
      "trial_home_unconfirmed",
      "trial_lease_acquisition_unknown",
      "trial_home_changed_or_unconfirmed",
      "trial_failed_closed",
    ].includes(String(value.reason)) &&
    value.status === "blocked" &&
    value.recoveryId === null &&
    value.fixtureReceipt === null &&
    value.cancellationConfirmed === false &&
    value.cleanupConfirmed === false &&
    value.terminalSaved === false &&
    value.contentConfirmed === false &&
    value.resultSha256 === null &&
    value.resultBytes === 0 &&
    value.diagnostic === null &&
    value.reviewToolObservation === null
  );
}

/**
 * 試験Rootの現在実体を非秘密の文字列組へ投影する。
 * @responsibility 親子間と清掃直前の対象取り違えを拒否する。
 * @trace ERB-IT-004
 * @input exact Path。
 * @returns dev・ino・birthtimeNs。
 * @effect metadata読取り。
 * @failure 非Directory・linkは停止。
 * @boundary 今回の自己生成Rootのみ。
 */
function rootIdentity(root: string) {
  const s = fs.lstatSync(root, { bigint: true });
  if (!s.isDirectory() || s.isSymbolicLink()) throw Error("trial_root_changed");
  return [s.dev, s.ino, s.birthtimeNs].map(String).join(":");
}

/**
 * 元確定JSON・検査済み作業領域・試験所有tmpを終了後に回収する。
 * @responsibility 子closeと元終端確認を清掃の前提にする。
 * @trace ERB-IT-004
 * @input exact Root・初回Identity・元限定結果。
 * @returns 回収と不存在の確認結果。
 * @precondition 親が同一子の正常closeと単一相関結果を確認済み。
 * @effect 今回Root内だけで通常unlink・内側からのrmdir・確定JSON除去を行う。
 * @failure link・特殊File・実体差・棚卸し超過・記録不整合は保持。再試行なし。
 * @boundary 過去保持物やDocker資源を削除しない。
 */
export function cleanupStandaloneTrialRoot(
  root: string,
  identity: string,
  result: TrialResult,
  mode: TrialMode = "advice",
) {
  try {
    if (
      result.mode !== mode ||
      rootIdentity(root) !== identity ||
      (mode === "cancel"
        ? result.status !== "cancelled" ||
          result.reason !== "provider_operation_cancelled" ||
          !result.cancellationConfirmed ||
          result.contentConfirmed ||
          result.resultSha256 !== null ||
          result.resultBytes !== 0 ||
          result.diagnostic?.providerProcessStartedObserved !== true
        : result.status !== "completed" || !result.contentConfirmed)
    )
      return false;
    if (
      ![
        result.cleanupConfirmed,
        result.releaseConfirmed,
        result.terminalSaved,
        result.operationCleanupConfirmed,
      ].every((v) => v === true)
    )
      return false;
    const repository = fs.realpathSync(
      fileURLToPath(new URL("../../../", import.meta.url)),
    );
    const verified = getRepository(repository);
    if (verified.status !== "completed") return false;
    const area = observeRepositoryRuntimeDataArea(verified.capability, "tests");
    if (area.status !== "ready") return false;
    const expectedParent = area.directory;
    const provider = /^executor-real-(codex|claude)-[A-Za-z0-9-]{8,64}$/u.exec(
      path.basename(root),
    )?.[1];
    if (
      !provider ||
      path.dirname(root).toLowerCase() !== expectedParent.toLowerCase() ||
      fs.realpathSync(root).toLowerCase() !== root.toLowerCase() ||
      result.recoveryId?.split(".")[2] !== digest(root)
    )
      return false;
    const names = fs.readdirSync(root);
    const files = names
      .filter((name) => /^event-[0-9]{3}\.json$/u.test(name))
      .sort();
    const allowed = new Set([
      ...files,
      ...files.map((name) => `${name}.crdd-commit.json`),
      "tmp",
      "management",
      ...(mode === "advice" ? [] : ["work"]),
    ]);
    if (
      !files.length ||
      files.length > 100 ||
      names.length !== files.length * 2 + 2 + (mode === "advice" ? 0 : 1) ||
      names.some((name) => !allowed.has(name))
    )
      return false;
    let operationId: string | null = null;
    let ownershipLabel: string | null = null;
    let priorResources:
      | import("../../domain-model/src/index.ts").CoordinatorResourceBook
      | null = null;
    const kinds: string[] = [];
    for (const [i, name] of files.entries()) {
      if (name !== `event-${String(i + 1).padStart(3, "0")}.json`) return false;
      for (const file of [name, `${name}.crdd-commit.json`]) {
        const stat = fs.lstatSync(path.join(root, file));
        if (
          !stat.isFile() ||
          stat.isSymbolicLink() ||
          stat.nlink !== 1 ||
          stat.size > 32 * 1024
        )
          return false;
      }
      const record = readReport(path.join(root, name), name).value;
      if (!record || typeof record !== "object") return false;
      const v = record as Record<string, unknown>;
      if (
        typeof v.operationId !== "string" ||
        !/^OP-[A-Z0-9-]{6,80}$/u.test(v.operationId) ||
        v.recoveryId !== result.recoveryId ||
        v.sequence !== i + 1 ||
        typeof v.recordedAt !== "string" ||
        !Number.isFinite(Date.parse(v.recordedAt)) ||
        v.provider !== provider ||
        typeof v.kind !== "string"
      )
        return false;
      operationId ??= v.operationId;
      if (v.operationId !== operationId) return false;
      kinds.push(v.kind);
      const fixed = [
        "kind",
        "recordedAt",
        "operationId",
        "provider",
        "recoveryId",
        "sequence",
      ];
      const fields: Record<string, string[]> = {
        recovery_opened: [],
        recovery_handoff: [],
        submission_planned: ["resources"],
        receipt_recorded: ["resources"],
        resource_not_issued: ["resources"],
        provider_submission: [],
        absence_observed: ["resources"],
        home_released: [],
        mount_recorded: [],
        recovery_closed: [],
        terminal_received: ["status", "reason", "resultSha256", "resultBytes"],
        execution_settled: [
          "primaryFailure",
          "providerProcessStartedObserved",
          "processTreeTerminationObserved",
          "containersAbsentObserved",
          "networksAbsentObserved",
          "cleanupConfirmed",
        ],
      };
      if (
        !Object.hasOwn(fields, v.kind) ||
        Object.keys(v).sort().join(",") !==
          [...fixed, ...(fields[v.kind] ?? [])].sort().join(",")
      )
        return false;
      if (
        [
          "submission_planned",
          "receipt_recorded",
          "resource_not_issued",
          "absence_observed",
        ].includes(v.kind)
      ) {
        if (
          !validateCoordinatorResourceBook(v.resources) ||
          !v.resources ||
          !validateCoordinatorResourceBookTransition(
            priorResources,
            v.resources,
          )
        )
          return false;
        const book = v.resources;
        if (book.snapshot.resources.length !== 5) return false;
        const names: Record<string, string> = {
          create_provider: provider,
          create_proxy: "proxy",
          create_subscription_auth_probe: "auth",
          create_internal_network: "internal",
          create_egress_network: "egress",
        };
        for (const resource of book.snapshot.resources) {
          const label = resource.identity.ownershipLabel;
          if (
            !/^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(label) ||
            (ownershipLabel !== null && label !== ownershipLabel) ||
            !Object.hasOwn(names, resource.key) ||
            !/^crdd-[a-z]+-[a-f0-9]{16}$/u.test(resource.identity.name) ||
            (resource.key === "create_provider"
              ? !resource.identity.name.startsWith(`crdd-${provider}-`)
              : resource.identity.name !==
                `crdd-${names[resource.key]}-${label.split("=")[1]}`)
          )
            return false;
          ownershipLabel = label;
        }
        const changes = book.checkpoints.filter(
          (c) =>
            JSON.stringify(c) !==
            JSON.stringify(
              priorResources?.checkpoints.find((p) => p.key === c.key) ?? {
                ...c,
                submission: "none",
              },
            ),
        );
        if (
          v.kind === "submission_planned" &&
          (changes.length !== 1 || changes[0]?.submission !== "intent_saved")
        )
          return false;
        if (
          v.kind === "receipt_recorded" &&
          (changes.length !== 1 ||
            changes[0]?.receiptSource !== "docker_create_result")
        )
          return false;
        if (
          v.kind === "resource_not_issued" &&
          (changes.length !== 1 || changes[0]?.submission !== "not_issued")
        )
          return false;
        if (
          v.kind === "absence_observed" &&
          book.checkpoints.some(
            (c) => !["absent", "not_requested"].includes(c.observation),
          )
        )
          return false;
        priorResources = book;
      }
      if (v.kind === "execution_settled") {
        const projection = Object.fromEntries(
          Object.entries(v).filter(([key]) => !fixed.includes(key)),
        );
        if (
          !isTrialDiagnostic(projection) ||
          !isDeepStrictEqual(projection, result.diagnostic)
        )
          return false;
      }
      if (
        v.kind === "terminal_received" &&
        (v.status !== (mode === "cancel" ? "cancelled" : "completed") ||
          (mode === "cancel"
            ? v.reason !== "provider_operation_cancelled"
            : v.reason !== null &&
              v.reason !== "provider_operation_completed") ||
          v.resultSha256 !== result.resultSha256 ||
          v.resultBytes !== result.resultBytes)
      )
        return false;
    }
    if (
      kinds[0] !== "recovery_opened" ||
      kinds[1] !== "recovery_handoff" ||
      kinds.at(-1) !== "terminal_received" ||
      !kinds.includes("recovery_closed") ||
      !kinds.includes("home_released") ||
      !kinds.includes("absence_observed")
    )
      return false;
    if (
      [
        "recovery_opened",
        "recovery_handoff",
        "absence_observed",
        "home_released",
        "recovery_closed",
        "terminal_received",
        "execution_settled",
      ].some((kind) => kinds.filter((value) => value === kind).length !== 1) ||
      !(
        kinds.indexOf("home_released") < kinds.indexOf("absence_observed") &&
        kinds.indexOf("absence_observed") < kinds.indexOf("recovery_closed")
      )
    )
      return false;
    const directoryIdentities = new Map<string, string>();
    for (const name of ["tmp", "management"]) {
      const target = path.join(root, name);
      directoryIdentities.set(name, rootIdentity(target));
      if (name === "management" && fs.readdirSync(target).length !== 0)
        return false;
    }
    const temporaryRoot = path.join(root, "tmp");
    const metadataLimit = 10_000;
    const childNames = (target: string) => {
      const directory = fs.opendirSync(target);
      const names: string[] = [];
      try {
        for (
          let entry = directory.readSync();
          entry;
          entry = directory.readSync()
        ) {
          if (names.length === metadataLimit)
            throw Error("trial_tmp_inventory_limit");
          names.push(entry.name);
        }
      } finally {
        directory.closeSync();
      }
      return names.sort();
    };
    const remainingRootNames = new Set(names);
    const verifyRootInventory = () => {
      if (
        rootIdentity(root) !== identity ||
        !isDeepStrictEqual(childNames(root), [...remainingRootNames].sort())
      )
        throw Error("trial_root_inventory_changed");
    };
    const temporaryMetadata = (target: string) => {
      const relative = path.relative(temporaryRoot, target);
      if (
        path.isAbsolute(relative) ||
        relative === ".." ||
        relative.startsWith(`..${path.sep}`)
      )
        throw Error("trial_tmp_outside");
      const stat = fs.lstatSync(target, { bigint: true });
      if (
        stat.isSymbolicLink() ||
        (!stat.isDirectory() && (!stat.isFile() || stat.nlink !== 1n)) ||
        fs.realpathSync(target) !== target
      )
        throw Error("trial_tmp_entry_invalid");
      return {
        identity: [stat.dev, stat.ino, stat.birthtimeNs].map(String).join(":"),
        directory: stat.isDirectory(),
        mode: stat.mode,
        size: stat.size,
        modified: stat.mtimeNs,
      };
    };
    const inventory = new Map<
      string,
      {
        metadata: ReturnType<typeof temporaryMetadata>;
        children: string[] | null;
      }
    >();
    const pending = [temporaryRoot];
    while (pending.length) {
      const target = pending.pop() as string;
      const metadata = temporaryMetadata(target);
      const children = metadata.directory ? childNames(target) : null;
      inventory.set(target, { metadata, children });
      if (
        inventory.size + pending.length + (children?.length ?? 0) >
        metadataLimit
      )
        return false;
      for (const child of children ?? [])
        pending.push(path.join(target, child));
    }
    const verifyTemporaryEntry = (target: string) => {
      const expected = inventory.get(target);
      if (!expected) throw Error("trial_tmp_entry_missing");
      const current = temporaryMetadata(target);
      if (
        current.identity !== expected.metadata.identity ||
        current.directory !== expected.metadata.directory ||
        current.mode !== expected.metadata.mode ||
        (!current.directory &&
          (current.size !== expected.metadata.size ||
            current.modified !== expected.metadata.modified)) ||
        (expected.children !== null &&
          !isDeepStrictEqual(childNames(target), expected.children))
      )
        throw Error("trial_tmp_entry_changed");
    };
    if (
      rootIdentity(root) !== identity ||
      inventory.get(temporaryRoot)?.metadata.identity !==
        directoryIdentities.get("tmp")
    )
      return false;
    for (const target of inventory.keys()) verifyTemporaryEntry(target);
    verifyRootInventory();
    for (const [target, entry] of [...inventory].reverse()) {
      if (target === temporaryRoot) continue;
      verifyRootInventory();
      const ancestors: string[] = [];
      for (
        let ancestor = path.dirname(target);
        ;
        ancestor = path.dirname(ancestor)
      ) {
        ancestors.push(ancestor);
        if (ancestor === temporaryRoot) break;
      }
      for (const ancestor of ancestors.reverse())
        verifyTemporaryEntry(ancestor);
      verifyTemporaryEntry(target);
      if (entry.children !== null) {
        if (entry.children.length !== 0) return false;
        fs.rmdirSync(target);
      } else fs.unlinkSync(target);
      const parent = inventory.get(path.dirname(target));
      if (!parent?.children) return false;
      parent.children = parent.children.filter(
        (name) => name !== path.basename(target),
      );
    }
    verifyTemporaryEntry(temporaryRoot);
    verifyRootInventory();
    if (
      mode !== "advice" &&
      (!result.fixtureReceipt ||
        !cleanupTaskTrialFixture(root, mode, result.fixtureReceipt))
    )
      return false;
    if (mode !== "advice") remainingRootNames.delete("work");
    verifyRootInventory();
    for (const [name, expected] of directoryIdentities)
      if (rootIdentity(path.join(root, name)) !== expected) return false;
    for (const name of files) {
      verifyRootInventory();
      removeReport(path.join(root, name), name);
      remainingRootNames.delete(name);
      remainingRootNames.delete(`${name}.crdd-commit.json`);
    }
    for (const name of ["tmp", "management"]) {
      verifyRootInventory();
      if (
        rootIdentity(root) !== identity ||
        rootIdentity(path.join(root, name)) !== directoryIdentities.get(name)
      )
        return false;
      fs.rmdirSync(path.join(root, name));
      remainingRootNames.delete(name);
    }
    verifyRootInventory();
    fs.rmdirSync(root);
    return !fs.existsSync(root);
  } catch {
    return false;
  }
}

/**
 * 事前承認された明示実行の一子だけを監督し、close後に限定清掃する。
 * @responsibility 通信結果と子終了・記録・回収を別々に確認する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @input CLI引数。Providerとrun-id以外を受け付けない。
 * @returns 表示済み有限結果に対応する終了値。
 * @precondition 実行前に用途限定の人間承認を取得済み。
 * @postcondition 実行・取消・終了不明で自動再送・強制清掃しない。
 * @effect Node子一件、今回Rootの結果記録と限定清掃。
 * @failure 不明時はexact Rootを表示し七日後を再評価時刻とする。
 * @invariant 計画表示・不正引数ではHome・Root・Docker・AI Effect零。
 * @boundary 検証CLIのみ。製品Coordinatorには変更しない。
 * @security 子stdout/stderrは常時drainし、本文を保持・表示しない。
 * @concurrency 同じnonceの一結果と子closeを要求し、期限超過は取消して不明として保持する。
 */
export async function runStandaloneProviderTrialCli(args: readonly string[]) {
  if (args[0] === "--describe" && (args.length === 2 || args.length === 3)) {
    process.stdout.write(
      `${JSON.stringify(describeStandaloneProviderTrial(args[1], parseMode(args[2])))}\n`,
    );
    return 0;
  }
  if (
    args[0] !== "--run" ||
    (args.length !== 3 && args.length !== 4) ||
    typeof args[2] !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9-]{7,63}$/u.test(args[2])
  )
    throw Error("usage_describe_provider_or_run_provider_runid");
  const mode = parseMode(args[3]);
  const spec = describeStandaloneProviderTrial(args[1], mode),
    runId = args[2];
  const repository = fs.realpathSync(
    fileURLToPath(new URL("../../../", import.meta.url)),
  );
  const verified = getRepository(repository);
  if (verified.status !== "completed") throw Error(verified.reason);
  const parent = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataArea(verified.capability, "tests"),
    "trial_parent_invalid",
  ).directory;
  const root = path.join(parent, `executor-real-${spec.provider}-${runId}`);
  if (fs.existsSync(root)) throw Error("trial_root_already_exists");
  const cancellation = new AbortController();
  const abort = () => cancellation.abort();
  process.once("SIGINT", abort);
  try {
    const git = spawnSync(
      "git",
      ["-C", path.dirname(script), "rev-parse", "--show-toplevel"],
      { encoding: "utf8", timeout: 15000, windowsHide: true },
    );
    if (
      git.error ||
      git.signal ||
      git.status !== 0 ||
      fs.realpathSync(git.stdout.trim()).toLowerCase() !==
        repository.toLowerCase()
    )
      throw Error("trial_repository_invalid");
    const nonce = randomBytes(32).toString("hex"),
      specHash = digest(JSON.stringify(spec));
    const environment: Record<string, string> = {};
    for (const name of [
      "SystemRoot",
      "WINDIR",
      "LOCALAPPDATA",
      "USERPROFILE",
    ]) {
      const value = process.env[name];
      if (value) environment[name] = value;
    }
    const child = fork(script, ["--worker", nonce], {
      cwd: repository,
      env: environment,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    let identity: string | null = null,
      result: TrialResult | null = null,
      protocolFailure = false,
      resultCount = 0,
      outputSeen = false,
      cancelSent = false,
      closeObserved = false,
      recoveryAckIssued = false,
      recoveryAcknowledged = false;
    let knownRecoveryId: string | null = null;
    const sendCancel = () => {
      if (!cancelSent && child.connected) {
        cancelSent = true;
        child.send({ kind: "cancel", nonce }, () => {});
      }
    };
    cancellation.signal.addEventListener("abort", sendCancel);
    child.stdout?.on("data", (chunk) => {
      if (chunk.length) outputSeen = true;
    });
    child.stderr?.on("data", () => {});
    const closed = await new Promise<boolean>((resolve) => {
      let graceTimer: ReturnType<typeof setTimeout> | null = null;
      let ackSettled = false,
        closeSucceeded = false;
      const settle = () => {
        if (!closeObserved || (recoveryAckIssued && !ackSettled)) return;
        clearTimeout(timer);
        if (graceTimer) clearTimeout(graceTimer);
        resolve(closeSucceeded);
      };
      const timer = setTimeout(() => {
        protocolFailure = true;
        sendCancel();
        graceTimer = setTimeout(() => {
          if (child.connected) child.disconnect();
          child.unref();
          child.stdout?.destroy();
          child.stderr?.destroy();
          resolve(false);
        }, TRIAL_CANCELLATION_GRACE_MS);
      }, TRIAL_COMPLETION_TIMEOUT_MS);
      child.on("message", (raw: unknown) => {
        if (!raw || typeof raw !== "object") {
          protocolFailure = true;
          sendCancel();
          return;
        }
        const v = raw as Record<string, unknown>;
        if (v.nonce !== nonce) {
          protocolFailure = true;
          sendCancel();
          return;
        }
        if (
          v.kind === "recovery" &&
          Object.keys(v).length === 3 &&
          identity !== null &&
          knownRecoveryId === null &&
          typeof v.recoveryId === "string" &&
          /^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
            v.recoveryId,
          ) &&
          v.recoveryId.split(".")[2] === digest(root)
        ) {
          knownRecoveryId = v.recoveryId;
          recoveryAckIssued = true;
          child.send({ kind: "recovery_ack", nonce }, (error) => {
            ackSettled = true;
            if (error) {
              protocolFailure = true;
              sendCancel();
            } else recoveryAcknowledged = true;
            settle();
          });
          return;
        }
        if (
          v.kind === "root" &&
          Object.keys(v).length === 2 &&
          identity === null
        ) {
          try {
            identity = rootIdentity(root);
            child.send({ kind: "root_ack", nonce }, () => {});
          } catch {
            protocolFailure = true;
            sendCancel();
          }
          return;
        }
        if (
          v.kind === "result" &&
          Object.keys(v).length === 3 &&
          identity !== null &&
          resultCount++ === 0
        ) {
          result = trialResult(v.result, mode);
          if (
            !result ||
            (knownRecoveryId === null
              ? recoveryAckIssued || !beforeRecoveryFailure(result)
              : !recoveryAckIssued || result.recoveryId !== knownRecoveryId)
          ) {
            protocolFailure = true;
            sendCancel();
          }
          return;
        }
        protocolFailure = true;
        sendCancel();
      });
      child.once("error", () => {
        protocolFailure = true;
      });
      child.once("close", (code, signal) => {
        closeObserved = true;
        closeSucceeded = signal === null && code === 0;
        settle();
      });
      child.once("spawn", () =>
        child.send(
          {
            kind: "run",
            nonce,
            provider: spec.provider,
            runId,
            specHash,
            mode,
          },
          (error) => {
            if (error) {
              protocolFailure = true;
              sendCancel();
            }
          },
        ),
      );
    });
    cancellation.signal.removeEventListener("abort", sendCancel);
    const finalResult = result as TrialResult | null;
    if (closeObserved && identity !== null && knownRecoveryId === null) {
      try {
        if (rootIdentity(root) !== identity) throw Error("trial_root_changed");
        const saved = readReport(
          path.join(root, "event-001.json"),
          "event-001.json",
        ).value;
        if (saved && typeof saved === "object") {
          const v = saved as Record<string, unknown>;
          if (
            v.kind === "recovery_opened" &&
            typeof v.recoveryId === "string" &&
            /^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
              v.recoveryId,
            ) &&
            v.recoveryId.split(".")[2] === digest(root)
          )
            knownRecoveryId = v.recoveryId;
          if (
            knownRecoveryId !== null &&
            finalResult?.recoveryId !== knownRecoveryId
          )
            protocolFailure = true;
        }
      } catch {}
    }
    const clean =
      closed &&
      !cancellation.signal.aborted &&
      !cancelSent &&
      !protocolFailure &&
      recoveryAcknowledged &&
      !outputSeen &&
      resultCount === 1 &&
      finalResult !== null &&
      identity !== null &&
      cleanupStandaloneTrialRoot(root, identity, finalResult, mode);
    const reviewAfter = new Date(Date.now() + 7 * 86400_000).toISOString();
    let retentionRecordConfirmed = false;
    if (!clean && identity !== null && closeObserved) {
      try {
        if (rootIdentity(root) !== identity) throw Error("trial_root_changed");
        const value = {
          contract: "crdd/executor/trial-outcome/v2",
          provider: spec.provider,
          runId,
          reviewAfter,
          childCloseConfirmed: closed,
          childCloseObserved: closeObserved,
          recoveryId: knownRecoveryId,
          protocolFailure,
          unexpectedStdout: outputSeen,
          result: finalResult,
        };
        const written = writeReport(root, "outcome.json", runId, value);
        const read = readReport(written.target, runId);
        retentionRecordConfirmed =
          read.hash === written.hash &&
          JSON.stringify(read.value) === JSON.stringify(value);
      } catch {
        retentionRecordConfirmed = false;
      }
    }
    process.stdout.write(
      `${JSON.stringify({
        status: clean ? "completed" : "blocked",
        reason: clean
          ? null
          : (finalResult?.reason ??
            (cancellation.signal.aborted
              ? "trial_cancelled"
              : "trial_completion_unconfirmed")),
        provider: spec.provider,
        mode,
        runId,
        childCloseConfirmed: closed,
        childCloseObserved: closeObserved,
        recoveryId: knownRecoveryId,
        result: finalResult,
        fixtureCleanupConfirmed: clean,
        fixtureRoot: clean ? null : root,
        reviewAfter: clean ? null : reviewAfter,
        retentionRecordConfirmed,
      })}\n`,
    );
    return clean ? 0 : 2;
  } finally {
    process.removeListener("SIGINT", abort);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === script) {
  if (process.argv[2] === "--worker") {
    const nonce = process.argv[3];
    if (
      !process.send ||
      !process.connected ||
      process.argv.length !== 4 ||
      !nonce ||
      !/^[a-f0-9]{64}$/u.test(nonce)
    )
      throw Error("trial_worker_parent_required");
    const controller = new AbortController();
    let received = false,
      ack: (() => void) | null = null,
      expectedAck: string | null = null;
    process.on("disconnect", () => controller.abort());
    process.on("message", (raw: unknown) => {
      if (!raw || typeof raw !== "object") {
        controller.abort();
        return;
      }
      const value = raw as Record<string, unknown>;
      if (value.nonce !== nonce) {
        controller.abort();
        return;
      }
      if (value.kind === "cancel" && Object.keys(value).length === 2) {
        controller.abort();
        return;
      }
      if (
        value.kind === expectedAck &&
        Object.keys(value).length === 2 &&
        ack
      ) {
        const ready = ack;
        ack = null;
        expectedAck = null;
        ready();
        return;
      }
      if (received || value.kind !== "run" || Object.keys(value).length !== 6) {
        controller.abort();
        return;
      }
      received = true;
      void (async () => {
        const mode = parseMode(value.mode);
        const spec = describeStandaloneProviderTrial(value.provider, mode);
        if (
          value.specHash !== digest(JSON.stringify(spec)) ||
          controller.signal.aborted
        )
          throw Error("trial_worker_request_invalid");
        const result = await runStandaloneProviderTrial(
          value.provider,
          value.runId,
          controller.signal,
          async () => {
            await new Promise<void>((resolve, reject) => {
              ack = resolve;
              expectedAck = "root_ack";
              controller.signal.addEventListener(
                "abort",
                () => reject(Error("trial_root_ack_cancelled")),
                { once: true },
              );
              process.send?.({ kind: "root", nonce }, (error: Error | null) => {
                if (error) reject(error);
              });
            });
          },
          async (recoveryId) => {
            await new Promise<void>((resolve, reject) => {
              if (controller.signal.aborted) {
                reject(Error("trial_recovery_ack_cancelled"));
                return;
              }
              expectedAck = "recovery_ack";
              ack = resolve;
              const abort = () => reject(Error("trial_recovery_ack_cancelled"));
              controller.signal.addEventListener("abort", abort, {
                once: true,
              });
              process.send?.(
                { kind: "recovery", nonce, recoveryId },
                (error: Error | null) => {
                  if (error) reject(error);
                },
              );
            });
          },
          mode,
        );
        await new Promise<void>((resolve, reject) =>
          process.send?.(
            { kind: "result", nonce, result },
            (error: Error | null) => (error ? reject(error) : resolve()),
          ),
        );
      })()
        .catch(() => {
          process.exitCode = 2;
        })
        .finally(() => {
          if (process.connected) process.disconnect();
        });
    });
  } else {
    try {
      process.exitCode = await runStandaloneProviderTrialCli(
        process.argv.slice(2),
      );
    } catch (error) {
      process.stdout.write(
        `${JSON.stringify({
          status: "blocked",
          ...(error instanceof RepositoryRuntimeDataAreaBlockedError
            ? {
                reason: error.reason,
                recoveryReference: error.recoveryReference,
                effectIssued: error.effectIssued,
                effectStateUnknown: error.effectStateUnknown,
                cleanupConfirmed: error.cleanupConfirmed,
                retryAllowed: error.retryAllowed,
              }
            : { reason: "trial_entry_failed_closed" }),
        })}\n`,
      );
      process.exitCode = 2;
    }
  }
}
