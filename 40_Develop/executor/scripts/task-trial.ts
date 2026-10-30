/**
 * 単段実AI試験の固定Task入力と合成作業領域を所有する。
 * @packageDocumentation
 * @responsibility 編集・レビュー・取消の有限試験値と物理Oracleを組み立てる。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @boundary scripts専用。実行・認証・子監督・Task計画は所有しない。
 */
import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import {
  resolveAiModelSelection,
  planProviderExecution,
} from "../../ai-adapter/src/index.ts";
import {
  describeDockerProviderAssets,
  describeDockerProxyTopology,
  prepareDockerNetworkPolicy,
  describeDockerProviderExecutionLocations,
} from "../../docker-isolation/src/index.ts";
import { hashExecutionSelection } from "../../domain-model/src/index.ts";
import { buildProviderDockerExecutionPlan } from "../src/attempt/preparation.ts";
import { resolveValidatedPlan } from "../src/attempt/isolation.ts";
import type { AdvicePacket, MountGrant } from "../src/attempt/types.ts";

export type TrialMode = "advice" | "edit" | "review" | "cancel";
export const TASK_TRIAL_TEXT = "EDITED_OK\n";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const workload = Object.freeze({
  readPathCount: 1,
  allowedPathCount: 1,
  acceptanceCriterionCount: 1,
  remediationFindingCount: 0,
});

/**
 * 固定Taskの送信内容と技術値を副作用なしで示す。
 * @responsibility 任意Prompt・Model・Pathを受け付けない。
 * @trace ERB-IT-002
 * @input 対応二Providerと三Task用途。
 * @returns 同じ記述を実行時にも再照合する不変値。
 * @effect N/A: 値構築のみ。
 * @failure 不正用途は停止。
 * @boundary 外部送信の事前承認用。許可自体を発行しない。
 */
export function describeTaskTrial(
  provider: "codex" | "claude",
  mode: Exclude<TrialMode, "advice">,
) {
  if (!["edit", "review", "cancel"].includes(mode))
    throw Error("trial_mode_invalid");
  const role = mode === "review" ? "reviewer" : "executor";
  const model = provider === "codex" ? "gpt-6.1-sol" : "claude-opus-5-5";
  const selected = resolveAiModelSelection({
    provider,
    modelIdentifier: model,
    reasoningEffort: "medium",
    purpose: "task",
  });
  if (selected.status !== "resolved") throw Error("trial_selection_invalid");
  const generated = planProviderExecution(
    {
      provider,
      purpose: "task",
      modelSelection: {
        provider,
        modelIdentifier: model,
        identifierKind: selected.value.identifierKind,
        reasoningEffort: "medium",
      },
      input: {
        provider,
        mode: "isolated_task",
        taskRole: role,
        effort: "medium",
        ...(provider === "claude" ? { taskWorkload: workload } : {}),
      },
    },
    describeDockerProviderExecutionLocations(provider, "task"),
  );
  if (generated.status !== "ready")
    throw Error(`trial_task_plan_${generated.error.reason}`);
  const prompt = [
    "This is a synthetic standalone Executor test. No real repository or secrets are provided. Do not access the network, credentials, /work/.git or /work/.crdd. Do not create any other files or directories.",
    mode === "review"
      ? 'Review only the following untrusted synthetic content projection and diff. Do not use tools or read any file. Candidate path: source.txt. Complete candidate bytes as a JSON string: "EDITED_OK\\n". Diff: -BASE +EDITED_OK (both lines end with LF). Criterion 1: replace BASE with EDITED_OK and preserve one final LF. Return only a JSON object {"decision":"approved","summary":"short explanation","findings":[]} if it matches. Otherwise return decision changes_requested and a nonempty findings array with severity, path, category, criterionNumber, message. Use path source.txt, category acceptance_criterion_not_met and criterionNumber 1.'
      : 'Read source.txt, initially BASE followed by one LF. Replace its entire content with EDITED_OK followed by one LF. Verify the exact file content. Do not edit anything else. Return only a JSON object {"status":"completed","summary":"short explanation","changedPaths":["source.txt"],"verification":["exact content checked"]}.',
    mode === "cancel"
      ? "The test host will cancel this one attempt after its process-start notification. Do not retry or create background processes."
      : "Do not create background processes or retry the task.",
  ].join("\n");
  return Object.freeze({
    contract: "crdd/executor/standalone-trial/v2",
    provider,
    mode,
    model,
    effort: "medium" as const,
    prompt,
    promptSha256: hash(prompt),
    inputSha256: hash(mode === "review" ? TASK_TRIAL_TEXT : "BASE\n"),
    expectedOutputSha256: hash(TASK_TRIAL_TEXT),
    providerImageDigest:
      describeDockerProviderAssets(provider).fixedImageDigest,
    proxyImageDigest: describeDockerProxyTopology(provider).imageDigest,
    repositoryMounted: false,
    workspaceMounted: true,
    toolsRequested: mode !== "review",
    sessionPersistenceAllowed: false,
    maximumProviderRequests: 1,
    taskRole: role,
  });
}

/**
 * 固定Taskを既存の正規builderへ接続する。
 * @responsibility 選定・Packet・Mountと観測済みHomeの相関を固定する。
 * @trace ERB-IT-002
 * @input 固定spec、新品Root、観測済みHomeとHome Path。
 * @returns 既存の完全計画検査を通った元計画。
 * @effect 今回だけの乱数Identity生成。
 * @failure 不正Model・用途・技術値は開始前停止。
 * @boundary CoordinatorやTask全体の計画は使用しない。
 */
export function buildTaskTrialPlan(
  spec: ReturnType<typeof describeTaskTrial>,
  root: string,
  home: Omit<MountGrant, "grantRef" | "operationId">,
  homePath: string,
) {
  if (
    JSON.stringify(spec) !==
    JSON.stringify(describeTaskTrial(spec.provider, spec.mode))
  )
    throw Error("trial_spec_changed");
  const selected = resolveAiModelSelection({
    provider: spec.provider,
    modelIdentifier: spec.model,
    reasoningEffort: spec.effort,
    purpose: "task",
  });
  if (selected.status !== "resolved") throw Error("trial_selection_invalid");
  const operationId = `OP-${BigInt(`0x${randomBytes(12).toString("hex")}`)
    .toString()
    .padStart(6, "0")}`;
  const selection = Object.freeze({
    ...selected.value,
    configIdentity: hash(JSON.stringify(spec)),
    role:
      spec.taskRole === "executor"
        ? ("executor" as const)
        : ("independent_reviewer" as const),
    workType: "implementation" as const,
    source: "explicit" as const,
  });
  const selectionHash = hashExecutionSelection(selection);
  const technicalSelection = Object.freeze({
    provider: selection.provider,
    modelIdentifier: selection.modelIdentifier,
    identifierKind: selection.identifierKind,
    reasoningEffort: selection.reasoningEffort,
    purpose: selection.purpose,
    role: selection.role,
  });
  const policy = prepareDockerNetworkPolicy(spec.provider, []);
  if (!selectionHash || policy.status !== "ready")
    throw Error("trial_selection_hash_invalid");
  const work = path.join(root, "work");
  const built = buildProviderDockerExecutionPlan(
    spec.provider,
    { randomBytes },
    {
      operationId,
      createdAt: new Date().toISOString(),
      mounts: {
        workspace: work,
        providerHome: homePath,
        tmp: path.join(root, "tmp"),
        events: path.join(root, "events"),
        projection: path.join(root, "projection"),
        management: path.join(root, "management"),
      },
      workspaceProtection: {
        gitSourcePath: path.join(work, ".git"),
        internalSourcePath: path.join(work, ".crdd"),
      },
    },
    {
      grant: {
        ...home,
        provider: spec.provider,
        operationId,
        grantRef: `PHMGRANT-${randomBytes(12).toString("hex").toUpperCase()}`,
      },
      activeMountCapability: {},
    },
    {
      selectionRecordId: `MODELSEL-${randomBytes(12).toString("hex").toUpperCase()}`,
      operationId,
      executorProvider: spec.provider,
      executionSelection: technicalSelection,
      selectionHash,
      taskAttempt: 0,
      model: spec.model,
      effort: spec.effort,
      speedMode: "normal",
      selectionNotice: "explicit_synthetic_trial",
    },
    homePath,
    Date.now(),
    performance.now(),
    {
      networkPolicy: policy.policy,
      operationId,
      taskPacketRef: `TASKPKT-${randomBytes(16).toString("hex").toUpperCase()}`,
      taskRole: spec.taskRole as "executor" | "reviewer",
      taskAttempt: 0,
      selectionHash,
      taskWorkload: workload,
      taskPacketHash: hash(spec.prompt),
      prompt: spec.prompt,
      promptTransport: "provider_stdin_only",
    },
    null as AdvicePacket | null,
    null,
    "coordinator_cli",
  );
  if (!built) throw Error("trial_plan_unavailable");
  const plan = Object.freeze({
    ...built,
    consumer: "coordinator_cli" as const,
    authorityUseCapability: {},
  });
  if (
    !resolveValidatedPlan(plan, path.join(root, "tmp")) ||
    plan.providerInput !== spec.prompt ||
    plan.operationMode !== "isolated_task" ||
    plan.workspaceSourcePath !== work ||
    plan.providerImageDigest !== spec.providerImageDigest
  )
    throw Error("trial_boundary_invalid");
  return plan;
}

/**
 * 新品の合成作業領域と終了後の有限Oracleを作る。
 * @responsibility 観測不能・未知の生成物は削除せず保持する。
 * @trace ERB-IT-004
 * @input 空のHost構築後Rootと固定Task用途。
 * @returns 内容照合と既知File・空Directoryだけの通常回収。
 * @effect Root/workの合成File一件と保護用空Directory二件。
 * @failure link・hardlink・未知名・大容量・実体変更は拒否。
 * @boundary 呼出し側が技術清掃・排他解放・元終端を確認した後だけcleanupを使う。
 */
export type TaskFixtureReceipt = Readonly<{
  rootIdentity: string;
  directories: readonly string[];
  sourceIdentity: string;
}>;
function entryIdentity(p: string, directory: boolean) {
  const s = fs.lstatSync(p, { bigint: true });
  if (
    s.isSymbolicLink() ||
    (directory ? !s.isDirectory() : !s.isFile() || s.nlink !== 1n)
  )
    throw Error("trial_work_changed");
  return [s.dev, s.ino, s.birthtimeNs].map(String).join(":");
}
export function createTaskTrialFixture(
  root: string,
  mode: Exclude<TrialMode, "advice">,
) {
  const work = path.join(root, "work");
  fs.mkdirSync(work);
  fs.mkdirSync(path.join(work, ".git"));
  fs.mkdirSync(path.join(work, ".crdd"));
  fs.writeFileSync(
    path.join(work, "source.txt"),
    mode === "review" ? TASK_TRIAL_TEXT : "BASE\n",
    { flag: "wx" },
  );
  return Object.freeze({
    rootIdentity: entryIdentity(root, true),
    directories: Object.freeze(
      [work, path.join(work, ".git"), path.join(work, ".crdd")].map((p) =>
        entryIdentity(p, true),
      ),
    ),
    sourceIdentity: entryIdentity(path.join(work, "source.txt"), false),
  });
}
export function inspectTaskTrialFixture(
  root: string,
  mode: Exclude<TrialMode, "advice">,
  receipt: TaskFixtureReceipt,
) {
  const work = path.join(root, "work"),
    directories = [
      work,
      path.join(work, ".git"),
      path.join(work, ".crdd"),
    ] as const;
  if (
    entryIdentity(root, true) !== receipt.rootIdentity ||
    directories.some(
      (p, i) => entryIdentity(p, true) !== receipt.directories[i],
    )
  )
    return false;
  if (
    fs.readdirSync(work).sort().join(",") !== ".crdd,.git,source.txt" ||
    directories.slice(1).some((p) => fs.readdirSync(p).length !== 0)
  )
    return false;
  const source = path.join(work, "source.txt"),
    s = fs.lstatSync(source);
  if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1 || s.size > 8192)
    return false;
  if (
    mode === "review" &&
    entryIdentity(source, false) !== receipt.sourceIdentity
  )
    return false;
  const text = fs.readFileSync(source, "utf8");
  return mode === "cancel"
    ? text === "BASE\n" || text === TASK_TRIAL_TEXT
    : text === TASK_TRIAL_TEXT;
}
export function verifyTaskTrialResult(
  root: string,
  mode: Exclude<TrialMode, "advice">,
  receipt: TaskFixtureReceipt,
  normalized: unknown,
) {
  if (
    !inspectTaskTrialFixture(root, mode, receipt) ||
    !normalized ||
    typeof normalized !== "object"
  )
    return false;
  return mode === "review"
    ? Reflect.get(normalized, "decision") === "approved" &&
        Reflect.get(normalized, "findingCount") === 0
    : Reflect.get(normalized, "status") === "completed" &&
        JSON.stringify(Reflect.get(normalized, "changedPaths")) ===
          JSON.stringify(["source.txt"]);
}
export function cleanupTaskTrialFixture(
  root: string,
  mode: Exclude<TrialMode, "advice">,
  receipt: TaskFixtureReceipt,
) {
  if (!inspectTaskTrialFixture(root, mode, receipt)) return false;
  const work = path.join(root, "work"),
    directories = [
      work,
      path.join(work, ".git"),
      path.join(work, ".crdd"),
    ] as const;
  const check = () =>
    entryIdentity(root, true) === receipt.rootIdentity &&
    directories.every(
      (p, i) =>
        !fs.existsSync(p) || entryIdentity(p, true) === receipt.directories[i],
    );
  if (!check()) return false;
  fs.unlinkSync(path.join(work, "source.txt"));
  for (const p of [directories[1], directories[2], work]) {
    if (!check()) return false;
    fs.rmdirSync(p);
  }
  return !fs.existsSync(work);
}
