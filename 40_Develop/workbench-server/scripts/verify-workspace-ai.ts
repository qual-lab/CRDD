/**
 * 合成RepositoryのDirect／Isolatedを公開HTTPと実AIで一回ずつ確認する。
 * @responsibility 固定入力、既存変更保全、候補固定・採用・清掃の実測を結合する。
 * @trace ARCH-000015
 * @security 明示同意した合成内容だけを送信し、本体Repositoryを編集しない。
 */
import assert from "node:assert/strict";
import { readRepositoryNetworkPolicies } from "../../coordinator/src/index.ts";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { devNull } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import {
  verifyRepositoryRoot,
  resolveVerifiedRepositoryRoot,
} from "../../version-control/src/index.ts";
import {
  resolveRepositoryRuntimeDataPaths,
  observeRepositoryRuntimeDataArea,
  readStableBoundedFileSnapshot,
} from "../../domain-model/src/index.ts";
import {
  readRepositoryAiSelection,
  saveRepositoryAiSelection,
} from "../../coordinator/src/index.ts";
import { selectionConfig } from "../../coordinator/tests/fixtures/ai-selection.ts";
import {
  openTaskSession,
  type WorkspaceView,
} from "../../coordinator/src/index.ts";
import { prepareWorkspaceSurface } from "../../coordinator/tests/fixtures/workspace-surface.ts";
import {
  maintainCoordinatorSnapshot,
  transferCoordinatorSnapshotHistory,
} from "../../coordinator/src/state/retirement.ts";
import { deriveCoordinatorRepositoryBindingId } from "../../coordinator/src/state/validation.ts";
import { decodeCoordinatorHistoryRows } from "../../coordinator/src/storage/history.ts";
import { MAX_COORDINATOR_STATE_BYTES } from "../../coordinator/src/storage/state.ts";
import { acquireCoordinatorStorageOwner } from "../../coordinator/src/storage/lock.ts";
import { readCoordinatorStorageSnapshotOwned } from "../../coordinator/src/storage/state.ts";
import { startWorkbench, readWorkbenchProjectSurface } from "../src/index.ts";
import {
  createWorkbenchAiVerificationHttpClient,
  observeVerificationDockerInventory,
  assessVerificationDockerInventory,
  requestInChild,
  readMain,
  projectVerificationTransportFailure,
} from "./ai-verification-http.ts";
import type {
  WorkbenchAiRequestSnapshot,
  WorkbenchAiRequests,
} from "../src/server/ai-request/types.ts";
import { verifyWorkspaceOutputBytes } from "./workspace-output-verification.ts";
import {
  captureWorkspaceTaskDiagnostic,
  type RecoveryDiagnosticIdentity,
} from "./workspace-task-diagnostic.ts";
import { observeRuntimeOwnedDevelopmentSource } from "../../coordinator/src/execution/diagnostics.ts";

const projectId = "project.workspace-verification";
const empty = process.platform === "win32" ? "NUL" : devNull;
const hash = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");

/**
 * 合成Gitだけへ固定操作を発行する。
 * @trace ARCH-000009
 * @effect hooks・外部diff・親Git環境を使わず、指定した試験Rootだけを操作する。
 * @failure 非0・期限超過は停止し再発行しない。
 */
function git(root: string, args: string[]) {
  return execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      `core.hooksPath=${empty}`,
      "-c",
      "commit.gpgSign=false",
      "-c",
      "core.autocrlf=false",
      ...args,
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([k]) => !/^GIT_/iu.test(k)),
        ),
        GIT_CONFIG_GLOBAL: empty,
        GIT_CONFIG_SYSTEM: empty,
      },
    },
  ).trim();
}

/**
 * 固定内容だけの試験Repositoryを作る。
 * @trace ARCH-000015
 * @effect 呼出し元が排他的に作った検証Rootの子だけを作成する。
 * @failure 既存Root・前提不足は上位へ返す。
 */
function fixture(parent: string, mode: "direct" | "isolated") {
  const root = path.join(parent, mode);
  fs.mkdirSync(root);
  git(root, ["init", "--initial-branch=main", "--template="]);
  git(root, ["config", "user.name", "Workspace Verification"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.mkdirSync(path.join(root, ".git", "info"), { recursive: true });
  fs.writeFileSync(path.join(root, ".git", "info", "exclude"), "");
  const verifiedFixture = verifyRepositoryRoot(root);
  assert.equal(verifiedFixture.status, "completed");
  if (verifiedFixture.status !== "completed")
    throw new Error("fixture_root_unverified");
  const paths = resolveRepositoryRuntimeDataPaths(verifiedFixture.capability);
  assert.ok(paths);
  fs.mkdirSync(paths.config, { recursive: true });
  const logo = path.join(
    "04_UI",
    "assets",
    "brand",
    "crdd-brand-icon-512x512.jpg",
  );
  fs.mkdirSync(path.dirname(path.join(root, logo)), { recursive: true });
  fs.copyFileSync(path.join(process.cwd(), logo), path.join(root, logo));
  const context =
    `# Project Context\n\nProject ID: ${projectId}\nRepository ID: repository.workspace-${mode}\nRepository Role: development\n` +
    [
      "今どうなっているか",
      "何が危ない、または止まっているか",
      "今、人間が決めることは何か",
      "なぜこの状態・判断になったか",
      "次に何をすべきか",
    ]
      .map(
        (heading, i) =>
          `\n## ${i + 1}. ${heading}\n\n### 結論\n\n合成Workspace試験。\n\n| 項目 | 内容 |\n|---|---|\n| 対象 | source.txtだけ |\n`,
      )
      .join("");
  fs.writeFileSync(path.join(root, "PROJECT_CONTEXT.md"), context);
  fs.writeFileSync(path.join(root, ".gitignore"), ".crdd/\n");
  for (const file of ["source.txt", "dirty.txt", "staged.txt"])
    fs.writeFileSync(path.join(root, file), "BASE\n");
  fs.writeFileSync(
    path.join(paths.config, "repository-manifest.json"),
    JSON.stringify({
      schema: "crdd/repository-manifest/v2",
      projectId,
      repositoryId: `repository.workspace-${mode}`,
      displayName: "合成Workspace試験",
      repositoryRole: "development",
      capabilities: [],
      contextSurfaces: [],
      externalSendPolicy: "config/external-send-policy.json",
    }),
  );
  // 人間が許可した既存の非秘密送信契約。実Contextや資格は複製しない。
  const policyOwner = verifyRepositoryRoot(process.cwd());
  assert.equal(policyOwner.status, "completed");
  if (policyOwner.status !== "completed")
    throw new Error("policy_owner_unverified");
  const ownerPaths = resolveRepositoryRuntimeDataPaths(policyOwner.capability);
  assert.ok(ownerPaths);
  const policy = fs.readFileSync(
    path.join(ownerPaths.config, "external-send-policy.json"),
  );
  fs.writeFileSync(
    path.join(paths.config, "external-send-policy.json"),
    policy,
  );
  git(root, ["add", "."]);
  git(root, [
    "add",
    "--force",
    ".crdd/config/repository-manifest.json",
    ".crdd/config/external-send-policy.json",
  ]);
  git(root, ["commit", "-m", "Synthetic workspace base"]);
  const base = git(root, ["rev-parse", "HEAD"]);
  prepareWorkspaceSurface(root, projectId, base);
  if (mode === "direct") {
    fs.writeFileSync(path.join(root, "dirty.txt"), "EXISTING_DIRTY\n");
    fs.writeFileSync(path.join(root, "staged.txt"), "EXISTING_STAGE\n");
    git(root, ["add", "staged.txt"]);
    fs.writeFileSync(path.join(root, "unselected.txt"), "EXISTING_UNTRACKED\n");
  }
  return { root, base, contextHash: hash(context), paths };
}

/**
 * 一つの合成Taskと、その方式に必要な公開操作を検証する。
 * @trace ARCH-000015
 * @effect 明示同意後だけ実Providerを利用し、合成Git内だけで固定・採用する。
 * @failure Task再送・Merge再送はせず、元結果と清掃不明を別に保持する。
 */
async function verify(
  parent: string,
  mode: "direct" | "isolated",
  preflight: boolean,
) {
  const { root, base, contextHash, paths } = fixture(parent, mode);
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed", "fixture_root_invalid");
  if (verified.status !== "completed") throw new Error("fixture_root_invalid");
  const savedSelection = saveRepositoryAiSelection(
    verified.capability,
    {
      expectedIdentity: null,
      config: {
        ...selectionConfig(),
        roleDefaults: {
          coordinator: {
            provider: "codex",
            model: "gpt-6.1-sol",
            effort: "medium",
          },
          executor: {
            provider: "codex",
            model: "gpt-6.1-sol",
            effort: "medium",
          },
          independent_reviewer: {
            provider: "claude",
            model: "claude-opus-5-5",
            effort: "medium",
          },
          result_integration: {
            provider: "codex",
            model: "gpt-6.1-sol",
            effort: "medium",
          },
          advice: { provider: "codex", model: "gpt-6.1-sol", effort: "medium" },
        },
      },
    },
    () => true,
  );
  if (savedSelection.status !== "saved")
    throw new Error("fixture_ai_selection_unavailable");
  const configIdentity = savedSelection.snapshot.identity;
  const permitted = () =>
    hash(fs.readFileSync(path.join(root, "PROJECT_CONTEXT.md"))) ===
      contextHash &&
    readRepositoryAiSelection(verified.capability).snapshot?.identity ===
      configIdentity;
  assert.equal(
    (await readWorkbenchProjectSurface(root)).context.projectId,
    projectId,
  );
  const owner = openTaskSession({
    rootCapability: verified.capability,
    projectId,
    principalId: "local-workbench-user",
    authorize: permitted,
  });
  const handle = await startWorkbench({
    workingDirectory: root,
    port: 0,
    aiRequests: owner,
  });
  const workspaceId = randomUUID();
  const common = { projectId, queueId: "queue-a", workspaceId };
  let view: WorkspaceView | null = null;
  let runtimeClean = false;
  let workspaceClean = mode === "direct";
  let acceptedRequestId: string | null = null;
  let client: WorkbenchAiRequests | null = null;
  let clientCleanupUnconfirmed = false;
  let diagnosticCapture: ReturnType<
    typeof captureWorkspaceTaskDiagnostic
  > | null = null;
  let step = "prepare";
  const evidence: Record<string, unknown> = {
    mode,
    base,
    workspaceId: mode === "isolated" ? workspaceId : null,
    limitedProbePassed: false,
  };
  const initialIndex = hash(fs.readFileSync(path.join(root, ".git", "index")));
  const recordTask = (result: WorkbenchAiRequestSnapshot) => {
    assert.equal(
      result.requestId,
      acceptedRequestId,
      "edit_result_identity_mismatch",
    );
    evidence.task = {
      requestId: result.requestId,
      status: result.status,
      reason: result.reason,
      executionStatus: result.executionStatus,
      primaryFailure: result.primaryFailure,
      cleanupConfirmed: result.cleanupConfirmed,
      recoveryIds: result.recoveryIds,
      secondaryFailures: result.secondaryFailures,
      workspaceResult: result.workspaceResult,
    };
    runtimeClean =
      !["accepted", "running"].includes(result.status) &&
      result.cleanupConfirmed === true &&
      result.recoveryIds?.length === 0 &&
      result.secondaryFailures?.length === 0;
  };
  try {
    const model = await readMain(handle.baseUrl);
    const workspace = async (command: Record<string, unknown>) => {
      const response = await requestInChild(
        handle.baseUrl,
        "/workspace/action",
        new URLSearchParams({
          actionToken: model.actionToken,
          repositoryId: `repository.workspace-${mode}`,
          command: JSON.stringify(command),
        }),
        (timing) => {
          const observations =
            (evidence.workspaceHttpTimings as unknown[] | undefined) ?? [];
          observations.push({ operation: command.operation, ...timing });
          evidence.workspaceHttpTimings = observations;
        },
      );
      assert.equal(response.status, 200, "workspace_http_rejected");
      return JSON.parse(response.body) as {
        data: {
          status?: string;
          reason?: string;
          workspace?: WorkspaceView;
          selection?: unknown;
          patch?: string;
        };
      };
    };
    if (mode === "isolated") {
      const created = await workspace({
        ...common,
        operation: "create",
        expectedGeneration: 0,
        baseCommit: base,
        name: "合成Isolated",
      });
      assert.equal(created.data.status, "completed", "workspace_create_failed");
      view = created.data.workspace ?? null;
      assert.ok(view);
      workspaceClean = false;
    }
    const expected = mode === "direct" ? "DIRECT_OK\n" : "ISOLATED_OK\n";
    const tree =
      mode === "direct"
        ? root
        : path.join(paths.workspaces, workspaceId, "worktree");
    if (preflight) {
      fs.writeFileSync(path.join(tree, "source.txt"), expected);
      runtimeClean = true;
      evidence.preflightOnly = true;
    } else {
      diagnosticCapture = captureWorkspaceTaskDiagnostic(process.stderr);
      assert.equal(
        diagnosticCapture.available,
        true,
        "recovery_diagnostic_collector_unavailable",
      );
      client = await createWorkbenchAiVerificationHttpClient(handle.baseUrl);
      step = "start";
      const start = await client.start({
        expectedNetworkPolicyHash: (() => {
          const network = readRepositoryNetworkPolicies(verified.capability);
          if (network.status !== "ready")
            throw new Error("network_policy_unavailable");
          return network.policies.codex.policyHash;
        })(),
        mode: "workspace_edit",
        workType: "coding",
        prompt: `合成試験です。source.txtだけを${JSON.stringify(expected)}という一行（末尾改行あり）に変更してください。他のファイル・Git・.crddは変更せず、Commit等のGit操作をしないでください。完了時のchangedPathsはsource.txtだけです。`,
        contextReferences: ["PROJECT_CONTEXT.md"],
        allowedPaths: ["source.txt"],
        externalSendConfirmed: true,
        workspaceId: mode === "direct" ? null : workspaceId,
      });
      assert.equal(start.status, "accepted", "edit_start_rejected");
      assert.ok(start.requestId);
      evidence.requestId = start.requestId;
      acceptedRequestId = start.requestId;
      const deadline = Date.now() + 20 * 60_000;
      step = "observe";
      let result = await client.observe(start.requestId);
      while (
        ["accepted", "running"].includes(result.status) &&
        Date.now() < deadline
      ) {
        await delay(1500);
        result = await client.observe(start.requestId);
      }
      if (["accepted", "running"].includes(result.status)) {
        step = "cancel_timeout";
        result = await client.cancel(start.requestId);
        evidence.timedOut = true;
      }
      recordTask(result);
      step = "verify_result";
      assert.equal(result.status, "completed", "edit_task_not_completed");
      assert.equal(
        result.executionStatus,
        "completed",
        "edit_execution_not_completed",
      );
      assert.equal(runtimeClean, true, "edit_cleanup_unconfirmed");
      assert.equal(
        result.secondaryFailures?.length,
        0,
        "edit_secondary_failure",
      );
      assert.equal(evidence.timedOut, undefined, "edit_timed_out");
      assert.equal(
        JSON.stringify(result.workspaceResult?.changedPaths),
        JSON.stringify(["source.txt"]),
        "workspace_change_observation_mismatch",
      );
      assert.equal(
        result.workspaceResult?.workspaceId,
        mode === "direct" ? null : workspaceId,
        "workspace_result_identity_mismatch",
      );
    }
    assert.equal(
      git(root, ["rev-parse", "HEAD"]),
      base,
      "task_committed_shared_tree",
    );
    assert.equal(
      hash(fs.readFileSync(path.join(root, ".git", "index"))),
      initialIndex,
      "task_changed_shared_index",
    );
    evidence.outputVerification = verifyWorkspaceOutputBytes(
      fs.readFileSync(path.join(tree, "source.txt")),
      expected,
      ["source.txt"],
      "source.txt",
    );
    if (mode === "direct") {
      for (const [file, content] of [
        ["dirty.txt", "EXISTING_DIRTY\n"],
        ["staged.txt", "EXISTING_STAGE\n"],
        ["unselected.txt", "EXISTING_UNTRACKED\n"],
      ])
        assert.equal(
          fs.readFileSync(path.join(root, file as string), "utf8"),
          content,
          "existing_change_lost",
        );
      assert.equal(
        git(root, ["diff", "--cached", "--name-only"]),
        "staged.txt",
        "stage_selection_changed",
      );
      evidence.existingChangesPreserved = true;
    } else {
      const observed = await workspace({ ...common, operation: "get" });
      view = observed.data.workspace ?? null;
      assert.ok(view);
      const preview = await workspace({
        ...common,
        operation: "inspect",
        path: "source.txt",
      });
      assert.ok(preview.data.selection);
      const fixed = await workspace({
        ...common,
        operation: "freeze",
        expectedGeneration: view.generation,
        operationId: randomUUID(),
        baseCommit: base,
        expectedHead: view.head,
        selection: [preview.data.selection],
        candidateName: "合成候補",
        relatedChangeIds: [],
      });
      assert.equal(fixed.data.status, "completed", "candidate_freeze_failed");
      view = fixed.data.workspace ?? null;
      assert.ok(view?.candidate?.candidateCommit);
      const candidate = view.candidate.candidateCommit;
      assert.equal(
        git(root, [
          "diff-tree",
          "--no-commit-id",
          "--name-only",
          "-r",
          candidate,
        ]),
        "source.txt",
        "candidate_unselected_content",
      );
      assert.equal(
        git(root, ["show", `${candidate}:source.txt`]),
        expected.trim(),
        "fixed_blob_mismatch",
      );
      const patch = await workspace({
        ...common,
        operation: "candidate-diff",
        path: "source.txt",
      });
      assert.ok(
        patch.data.patch?.includes("ISOLATED_OK"),
        "candidate_diff_missing",
      );
      const adopted = await workspace({
        ...common,
        operation: "adopt",
        expectedGeneration: view.generation,
        candidateCommit: candidate,
        targetBranch: "main",
        expectedTargetHead: base,
      });
      assert.equal(adopted.data.status, "completed", "candidate_adopt_failed");
      view = adopted.data.workspace ?? null;
      assert.ok(view?.candidate?.mergeCommit);
      const merge = view.candidate.mergeCommit;
      assert.equal(
        git(root, ["rev-list", "--parents", "-n", "1", merge]),
        `${merge} ${base} ${candidate}`,
        "merge_parent_mismatch",
      );
      assert.equal(
        git(root, ["rev-parse", `${merge}^{tree}`]),
        git(root, ["rev-parse", `${candidate}^{tree}`]),
        "merge_tree_mismatch",
      );
      evidence.candidateCommit = candidate;
      evidence.mergeCommit = merge;
      const closed = await workspace({
        ...common,
        operation: "close-candidate",
        expectedGeneration: view.generation,
        expectedCommit: candidate,
        disposition: "adopted",
      });
      assert.equal(closed.data.status, "completed", "candidate_close_failed");
      view = closed.data.workspace ?? null;
      assert.ok(view);
      const discarded = await workspace({
        ...common,
        operation: "discard",
        expectedGeneration: view.generation,
        expectedHead: view.head,
        discardChanges: true,
      });
      assert.equal(
        discarded.data.status,
        "completed",
        "workspace_discard_failed",
      );
      assert.equal(fs.existsSync(tree), false, "worktree_remaining");
      assert.equal(
        git(root, [
          "for-each-ref",
          "--format=%(refname)",
          `refs/heads/crdd/workspace/${workspaceId}`,
          `refs/heads/crdd/candidate/${workspaceId}`,
        ]),
        "",
        "workspace_ref_remaining",
      );
      workspaceClean = true;
    }
    evidence.limitedProbePassed = true;
  } catch (error) {
    const message =
      error instanceof Error ? error.message.split("\n")[0] : null;
    evidence.primaryFailure =
      message && /^[a-z][a-z0-9_]+$/u.test(message)
        ? message
        : "workspace_verification_exception";
    evidence.failureStep = step;
    evidence.transportFailure = projectVerificationTransportFailure(error);
    clientCleanupUnconfirmed =
      error instanceof Error &&
      (error.message ===
        "workbench_verification_client_process_cleanup_unknown" ||
        (error.message === "workbench_ai_http_start_outcome_unknown" &&
          error.cause !== null &&
          typeof error.cause === "object" &&
          "clientCleanupConfirmed" in error.cause &&
          error.cause.clientCleanupConfirmed === false));
    if (
      error instanceof Error &&
      error.message === "workbench_ai_http_start_outcome_unknown" &&
      error.cause &&
      typeof error.cause === "object" &&
      "requestId" in error.cause &&
      typeof error.cause.requestId === "string"
    )
      acceptedRequestId = error.cause.requestId;
    if (
      (step === "observe" || step === "start") &&
      acceptedRequestId !== null &&
      evidence.task === undefined
    ) {
      // 通信経路が壊れていても、既存Ownerの同じTaskだけを一回取消・回収する。
      // 取消結果と最初の通信失敗は別の事実として保存し、Taskを再送しない。
      try {
        evidence.cancellationRequested = true;
        const result = await owner.cancel(acceptedRequestId);
        recordTask(result);
        evidence.cancellationResultObserved = true;
      } catch {
        evidence.cancellationResultObserved = false;
        evidence.cancellationFailure =
          "workspace_verification_cancel_unconfirmed";
      }
    }
  } finally {
    let clientClosed = false;
    try {
      await client?.close?.();
      clientClosed = !clientCleanupUnconfirmed;
    } catch {
      evidence.clientCloseFailure =
        "workbench_verification_client_process_cleanup_unknown";
    }
    try {
      await handle.close();
      evidence.closeConfirmed = clientClosed;
    } catch {
      evidence.closeConfirmed = false;
      evidence.closeFailure = "workbench_close_failed";
    }
    if (diagnosticCapture) {
      let correlationId: string | null = null;
      const identities: RecoveryDiagnosticIdentity[] = [];
      const historyIdentities: {
        operationId: string;
        recoveryCorrelationId: string | null;
        recoveryId: string;
      }[] = [];
      try {
        const storage = acquireCoordinatorStorageOwner(root);
        if (storage) {
          try {
            const read = readCoordinatorStorageSnapshotOwned(storage);
            if (read.status === "completed") {
              correlationId =
                read.value.snapshot.queueEntries.find(
                  (q) => q.queueId === acceptedRequestId,
                )?.singleTask?.operationId ?? null;
              for (const operation of read.value.snapshot.operations) {
                if (operation.kind !== "docker_task") continue;
                const identity = JSON.parse(operation.identityJson);
                identities.push({
                  provider: identity.provider,
                  taskRole:
                    identity.executionSelection.role === "independent_reviewer"
                      ? "reviewer"
                      : identity.executionSelection.role === "executor"
                        ? "executor"
                        : null,
                  taskAttempt: identity.taskAttempt,
                  operationId: identity.operationId,
                  recoveryCorrelationId: identity.recoveryCorrelationId,
                  recoveryId: operation.recoveryId,
                });
              }
              const historyFile = path.join(
                root,
                ".crdd",
                "coordinator",
                "history.jsonl",
              );
              if (fs.existsSync(historyFile)) {
                const metadata = fs.lstatSync(historyFile);
                assert.equal(metadata.isSymbolicLink(), false);
                assert.equal(metadata.nlink, 1);
                const history = readStableBoundedFileSnapshot(
                  historyFile,
                  MAX_COORDINATOR_STATE_BYTES,
                );
                const rows = decodeCoordinatorHistoryRows(history.bytes);
                assert.ok(rows, "diagnostic_history_invalid");
                for (const row of rows) {
                  const summary = JSON.parse(row.line).summary;
                  if (
                    summary.schema === "crdd-coordinator/operation-summary/v4"
                  )
                    historyIdentities.push({
                      operationId: summary.operationId,
                      recoveryCorrelationId: summary.recoveryCorrelationId,
                      recoveryId: row.recoveryId,
                    });
                }
              }
            }
          } finally {
            if (!storage.release()) {
              correlationId = null;
              identities.length = 0;
              historyIdentities.length = 0;
            }
          }
        }
      } catch {
        correlationId = null;
        identities.length = 0;
        historyIdentities.length = 0;
      }
      const task = evidence.task as Record<string, unknown> | undefined;
      const captured = diagnosticCapture.finish(
        correlationId,
        Array.isArray(task?.recoveryIds) ? (task.recoveryIds as string[]) : [],
        typeof task?.reason === "string" &&
          /^docker_process_controller_recovery_/u.test(task.reason),
        identities,
        task?.reason === "coordinator_task_candidate_revision_invalid" ||
          task?.reason === "coordinator_task_remediated_candidate_invalid",
        historyIdentities,
        task?.reason === "coordinator_task_independent_review_not_approved" ||
          task?.reason === "coordinator_task_workspace_review_completed",
        typeof task?.reason === "string" &&
          task.reason === "coordinator_task_provider_failed",
      );
      const { candidateValidation, stages, boundary, ...recoveryStart } =
        captured;
      evidence.recoveryStartDiagnostic = recoveryStart;
      evidence.candidateValidationDiagnostic = candidateValidation;
      evidence.stageDiagnostic = stages;
      evidence.boundaryDiagnostic = boundary;
      if (!captured.closed) evidence.closeConfirmed = false;
    }
    evidence.runtimeClean = runtimeClean;
    evidence.workspaceClean = workspaceClean;
  }
  return evidence;
}

/**
 * 今回の合成Rootに終了義務や未回収Workspaceが残らないことを確認する。
 * @trace ARCH-000015
 * @effect 同じRootの既存履歴保守と保存Owner、Git読取りだけ。削除は呼出し側が所有する。
 * @failure 観測不能・義務残存・Owner解放失敗は削除不可を返す。
 * @invariant Directの意図した未Commit変更をclean条件で拒否しない。
 */
function assessFixtureRemoval(
  parent: string,
  mode: "direct" | "isolated",
  evidence: Record<string, unknown>,
) {
  try {
    assert.ok(mode === "direct" || mode === "isolated");
    assert.equal(evidence.mode, mode);
    const realTask = evidence.preflightOnly !== true;
    const requestId = realTask ? evidence.requestId : null;
    if (realTask) {
      assert.equal(typeof requestId, "string");
      assert.ok(/^request-[a-f0-9-]+$/u.test(String(requestId)));
      const task = evidence.task as Record<string, unknown> | undefined;
      assert.ok(task);
      assert.equal(task.requestId, requestId);
      assert.equal(task.status, "completed");
      assert.equal(task.executionStatus, "completed");
      assert.equal(task.cleanupConfirmed, true);
      assert.equal(task.primaryFailure, null);
      assert.deepEqual(task.recoveryIds, []);
      assert.deepEqual(task.secondaryFailures, []);
    }
    const root = path.join(parent, mode);
    const checkBoundary = () => {
      assert.equal(path.resolve(parent), parent);
      assert.equal(fs.realpathSync.native(parent), parent);
      assert.equal(path.dirname(root), parent);
      assert.equal(fs.realpathSync.native(root), root);
      const visit = (target: string) => {
        const entry = fs.lstatSync(target);
        assert.equal(entry.isSymbolicLink(), false);
        if (entry.isDirectory())
          for (const name of fs.readdirSync(target))
            visit(path.join(target, name));
      };
      visit(root);
    };
    checkBoundary();
    const readClosed = (historyCount: number, includeTask = false) => {
      const owner = acquireCoordinatorStorageOwner(root);
      assert.ok(owner);
      try {
        const read = readCoordinatorStorageSnapshotOwned(owner);
        assert.equal(read.status, "completed");
        if (read.status !== "completed") throw new Error("snapshot_unobserved");
        let s = read.value.snapshot;
        if (includeTask) {
          const queues = s.queueEntries.filter((q) => q.queueId === requestId);
          assert.equal(queues.length, 1);
          const queue = queues[0];
          assert.ok(queue?.singleTask);
          assert.equal(queue.projectId, projectId);
          assert.equal(queue.milestoneId, null);
          assert.equal(queue.state, "completed");
          assert.ok(
            Number.isSafeInteger(queue.generation) && queue.generation > 0,
          );
          for (const key of [
            "ownerGeneration",
            "workspaceId",
            "resultReference",
            "resumeCondition",
          ] as const)
            assert.equal(queue[key], null);
          const task = queue.singleTask;
          assert.equal(task.principalId, "local-workbench-user");
          assert.equal(task.mode, "workspace_edit");
          assert.equal(task.phase, "settled");
          assert.equal(task.status, "completed");
          assert.equal(
            task.reason,
            (evidence.task as Record<string, unknown>).reason,
          );
          assert.equal(task.cleanupConfirmed, true);
          assert.deepEqual(task.recoveryIds, []);
          assert.equal(
            s.intakeBindings.filter((b) => b.queueId === requestId).length,
            1,
          );
          const rows = s.historyPending.filter((r) => r.id === requestId);
          assert.equal(rows.length, 1);
          assert.equal(rows[0]?.outcome, "completed");
          assert.equal(rows[0]?.cleanup, "confirmed");
          assert.equal(rows[0]?.primaryFailure, null);
          const leases = s.leaseEvidence.filter(
            (r) => r.content.queueId === requestId,
          );
          assert.ok(leases.length >= 2);
          const pairs = new Map<
            string,
            { acquired: number; released: number }
          >();
          for (const [index, item] of leases.entries()) {
            assert.equal(item.repositoryBindingId, s.repositoryBindingId);
            assert.equal(item.projectId, projectId);
            assert.equal(item.content.kind, "project-operation");
            const key = JSON.stringify([
              item.content.ownerGeneration,
              item.content.ownerProcessId,
            ]);
            const pair = pairs.get(key) ?? { acquired: -1, released: -1 };
            assert.ok(
              item.content.disposition === "acquired" ||
                item.content.disposition === "released",
            );
            assert.equal(pair[item.content.disposition], -1);
            pair[item.content.disposition] = index;
            pairs.set(key, pair);
          }
          for (const pair of pairs.values())
            assert.ok(pair.acquired >= 0 && pair.released > pair.acquired);
          s = {
            ...s,
            queueEntries: s.queueEntries.filter((q) => q.queueId !== requestId),
            intakeBindings: s.intakeBindings.filter(
              (b) => b.queueId !== requestId,
            ),
            historyPending: s.historyPending.filter((r) => r.id !== requestId),
            leaseEvidence: s.leaseEvidence.filter(
              (r) => r.content.queueId !== requestId,
            ),
          };
        }
        for (const key of [
          "operations",
          "unresolvedRecoveries",
          "pendingDeliveries",
          "leaseIntents",
          "workspaces",
          "resultReceipts",
          "acceptanceDecisions",
          "decisionRecoveries",
        ] as const)
          assert.equal(s[key].length, 0);
        assert.equal(s.historyPending.length, historyCount);
        if (historyCount) {
          const row = s.historyPending[0];
          assert.ok(row);
          assert.equal(row.id, `workspace-${evidence.workspaceId}`);
          assert.equal(row.outcome, "cancelled");
          assert.equal(row.cleanup, "confirmed");
          assert.equal(row.primaryFailure, null);
        }
        assert.deepEqual(s.queueEntries.map((q) => q.queueId).sort(), [
          "queue-a",
          "queue-b",
        ]);
        assert.deepEqual(s.intakeBindings.map((b) => b.queueId).sort(), [
          "queue-a",
          "queue-b",
        ]);
        for (const q of s.queueEntries) {
          const closed = mode === "isolated" && q.queueId === "queue-a";
          assert.equal(q.generation, closed ? 12 : 1);
          assert.equal(q.state, closed ? "cancelled" : "queued");
          for (const key of [
            "ownerGeneration",
            "workspaceId",
            "resultReference",
            "resumeCondition",
          ] as const)
            assert.equal(q[key], null);
          assert.equal(Object.hasOwn(q, "singleTask"), false);
        }
        assert.equal(s.projects.length, 1);
        assert.equal(s.projects[0]?.projectId, projectId);
        const tasks = s.projects[0]?.tasks ?? [];
        assert.equal(tasks.length, 1);
        const task = tasks[0];
        assert.ok(task);
        assert.equal(task.definition.id, "task-a");
        assert.equal(task.state, "ready");
        assert.equal(task.startPhase, "none");
        assert.equal(task.retryCount, 0);
        for (const key of [
          "attemptId",
          "authorityBindingId",
          "candidateId",
          "operationId",
          "supersededBy",
        ] as const)
          assert.equal(task[key], null);
        assert.deepEqual(task.recoveryObligations, []);
        assert.deepEqual(task.resultAcceptanceIds, []);
        if (mode === "direct") {
          assert.equal(s.results.length, 0);
          assert.equal(s.leaseEvidence.length, 0);
        } else {
          const object = (value: unknown) => {
            assert.ok(
              value !== null &&
                typeof value === "object" &&
                !Array.isArray(value),
            );
            return value as Record<string, unknown>;
          };
          assert.equal(typeof evidence.workspaceId, "string");
          assert.equal(s.results.length, 2);
          const candidate = s.results.find(
            (r) => object(r.value).recordKind === "workspace-candidate",
          );
          const closed = s.results.find(
            (r) => object(r.value).recordKind === "workspace-candidate-close",
          );
          assert.ok(candidate && closed);
          const value = object(candidate.value),
            end = object(closed.value),
            request = object(value.request),
            target = object(value.target);
          for (const result of [candidate, closed]) {
            assert.equal(result.kind, "adoption");
            assert.equal(result.repositoryBindingId, s.repositoryBindingId);
            assert.equal(result.projectId, projectId);
            assert.equal(result.milestoneId, "milestone-a");
            assert.equal(result.queueId, "queue-a");
          }
          assert.equal(request.workspaceId, evidence.workspaceId);
          assert.equal(request.baseCommit, evidence.base);
          assert.equal(target.expectedTargetHead, evidence.base);
          assert.equal(target.targetBranch, "main");
          assert.equal(
            candidate.identity,
            `workspace-candidate-${request.operationId}`,
          );
          assert.equal(
            closed.identity,
            `workspace-candidate-close-${request.operationId}`,
          );
          assert.equal(end.operationId, request.operationId);
          assert.equal(end.workspaceId, evidence.workspaceId);
          for (const record of [value, end]) {
            assert.equal(record.candidateCommit, evidence.candidateCommit);
            assert.equal(record.disposition, "adopted");
          }
          assert.equal(value.mergeCommit, evidence.mergeCommit);
          assert.equal(value.primaryFailure, null);
          assert.equal(end.cleanupFailure, null);
          assert.equal(end.refAbsent, true);
          assert.equal(s.leaseEvidence.length, 12);
          const pairs = new Map<
            string,
            { acquired: number; released: number }
          >();
          let projectPairs = 0;
          for (const [index, item] of s.leaseEvidence.entries()) {
            assert.equal(item.repositoryBindingId, s.repositoryBindingId);
            assert.equal(item.projectId, projectId);
            const content = item.content;
            assert.ok(
              content.kind === "project-operation" ||
                content.kind === "canonical-adoption",
            );
            assert.equal(
              content.queueId,
              content.kind === "project-operation" ? "queue-a" : "canonical",
            );
            const key = JSON.stringify([
              content.kind,
              content.queueId,
              content.ownerGeneration,
              content.ownerProcessId,
            ]);
            const pair = pairs.get(key) ?? { acquired: -1, released: -1 };
            assert.ok(
              content.disposition === "acquired" ||
                content.disposition === "released",
            );
            assert.equal(pair[content.disposition], -1);
            pair[content.disposition] = index;
            pairs.set(key, pair);
            if (
              content.disposition === "acquired" &&
              content.kind === "project-operation"
            )
              projectPairs++;
          }
          assert.equal(pairs.size, 6);
          assert.equal(projectPairs, 5);
          for (const pair of pairs.values())
            assert.ok(pair.acquired >= 0 && pair.released > pair.acquired);
        }
        return s;
      } finally {
        assert.equal(owner.release(), true);
      }
    };
    const historyCount = mode === "isolated" ? 1 : 0;
    const before = readClosed(historyCount, realTask);
    assert.equal(
      git(root, ["worktree", "list", "--porcelain"])
        .split("\n")
        .filter((line) => line.startsWith("worktree ")).length,
      1,
    );
    assert.equal(
      git(root, ["for-each-ref", "--format=%(refname)", "refs/heads/crdd"]),
      "",
    );
    if (evidence.mode === "direct") {
      assert.equal(git(root, ["rev-parse", "HEAD"]), evidence.base);
      assert.equal(
        git(root, ["diff", "--cached", "--name-only"]),
        "staged.txt",
      );
      for (const [file, expected] of [
        ["source.txt", "DIRECT_OK\n"],
        ["dirty.txt", "EXISTING_DIRTY\n"],
        ["staged.txt", "EXISTING_STAGE\n"],
        ["unselected.txt", "EXISTING_UNTRACKED\n"],
      ])
        assert.equal(
          fs.readFileSync(path.join(root, file as string), "utf8"),
          expected,
        );
    } else {
      assert.equal(git(root, ["rev-parse", "HEAD"]), evidence.mergeCommit);
      assert.equal(git(root, ["status", "--porcelain"]), "");
      assert.equal(
        git(root, [
          "rev-list",
          "--parents",
          "-n",
          "1",
          String(evidence.mergeCommit),
        ]),
        `${evidence.mergeCommit} ${evidence.base} ${evidence.candidateCommit}`,
      );
      assert.equal(
        git(root, ["rev-parse", `${evidence.mergeCommit}^{tree}`]),
        git(root, ["rev-parse", `${evidence.candidateCommit}^{tree}`]),
      );
    }
    const leases = path.join(root, ".crdd", "tmp", "orchestrator-leases");
    try {
      const entry = fs.lstatSync(leases);
      assert.equal(entry.isSymbolicLink(), false);
      assert.equal(entry.isDirectory(), true);
      assert.equal(fs.readdirSync(leases).length, 0);
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "ENOENT"
      )
        throw error;
    }
    checkBoundary();
    if (realTask) {
      const maintained = maintainCoordinatorSnapshot(
        root,
        deriveCoordinatorRepositoryBindingId(root),
      );
      assert.equal(maintained.status, "completed");
      if (maintained.status !== "completed")
        throw new Error("fixture_task_retirement_unconfirmed");
      assert.equal(maintained.reason, "orchestrator_terminal_records_retired");
      assert.equal(maintained.value, 1);
      const retired = readClosed(historyCount);
      for (const key of [
        "queueEntries",
        "intakeBindings",
        "projects",
        "results",
        "leaseEvidence",
        "historyPending",
      ] as const)
        assert.deepEqual(retired[key], before[key]);
      checkBoundary();
    }
    const transferred = transferCoordinatorSnapshotHistory(
      root,
      deriveCoordinatorRepositoryBindingId(root),
    );
    assert.equal(transferred.status, "completed");
    if (transferred.status !== "completed")
      throw new Error("fixture_history_unconfirmed");
    assert.equal(transferred.reason, "orchestrator_history_transferred");
    assert.deepEqual(transferred.value, {
      recorded: mode === "isolated" ? 1 : 0,
      expired: 0,
    });
    const after = readClosed(0);
    assert.deepEqual(after.results, before.results);
    assert.deepEqual(after.leaseEvidence, before.leaseEvidence);
    assert.deepEqual(after.queueEntries, before.queueEntries);
    checkBoundary();
    return { eligible: true, reason: "fixture_closed_and_unreferenced" };
  } catch {
    return { eligible: false, reason: "fixture_cleanup_unconfirmed" };
  }
}

/**
 * 承認された新品の一回だけを実行し、自己生成Rootを限定回収する。
 * @trace ARCH-000015
 * @effect 合成Repository・既存Runtime・公開HTTPだけ。Docker再起動や再試行なし。
 * @failure 不明な状態は保持して停止し、既存Rootへ再入場しない。
 */
async function main() {
  const argument = process.argv.slice(2).join(" ");
  const preflight = argument === "--preflight";
  if (!preflight && argument !== "--external-send-confirmed") {
    process.stderr.write(
      "合成編集E2Eの明示承認後に --external-send-confirmed を指定してください。\n",
    );
    process.exitCode = 64;
    return;
  }
  const repository = process.cwd();
  const verified = verifyRepositoryRoot(repository);
  assert.equal(verified.status, "completed", "repository_unverified");
  if (
    verified.status !== "completed" ||
    resolveVerifiedRepositoryRoot(verified.capability) !== repository
  )
    throw new Error("repository_canonical_root_required");
  const runtimePaths = resolveRepositoryRuntimeDataPaths(verified.capability);
  assert.ok(runtimePaths, "runtime_paths_unverified");
  assert.equal(
    observeRepositoryRuntimeDataArea(verified.capability, "tests").status,
    "ready",
    "verification_parent_invalid",
  );
  const sourceBefore = observeRuntimeOwnedDevelopmentSource();
  assert.ok(sourceBefore, "verification_source_unobserved");
  const trialRoot = path.join(runtimePaths.tests, "workspace-ai-20261026");
  if (!fs.existsSync(trialRoot)) fs.mkdirSync(trialRoot);
  assert.equal(fs.realpathSync.native(trialRoot), trialRoot);
  assert.equal(fs.lstatSync(trialRoot).isSymbolicLink(), false);
  const parent = path.join(trialRoot, preflight ? "preflight" : "edit");
  assert.equal(
    fs.existsSync(parent),
    false,
    "verification_root_already_exists",
  );
  const before = observeVerificationDockerInventory();
  assert.ok(before, "docker_unobserved");
  assert.equal(
    before.containers.some(
      (c) => !["created", "exited", "dead"].includes(c.state),
    ),
    false,
    "docker_not_idle",
  );
  fs.mkdirSync(parent);
  const results: Record<string, unknown>[] = [];
  const report: Record<string, unknown> = {
    contract: "crdd/workspace-ai-verification",
    preflightOnly: preflight,
    fullE2eVerified: false,
    rawProviderOutputReported: false,
    results,
    fixtureRootsRemoved: false,
  };
  try {
    for (const mode of ["direct", "isolated"] as const) {
      const result = await verify(parent, mode, preflight);
      results.push(result);
      if (result.limitedProbePassed !== true || result.closeConfirmed !== true)
        break;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message.split("\n")[0] : null;
    report.preflightFailure =
      message && /^[a-z][a-z0-9_]+$/u.test(message)
        ? message
        : "workspace_fixture_or_runtime_unavailable";
  }
  const cleanup =
    results.length > 0 &&
    report.preflightFailure === undefined &&
    results.every(
      (r) =>
        r.runtimeClean === true &&
        r.workspaceClean === true &&
        r.closeConfirmed === true,
    );
  const resources = assessVerificationDockerInventory(
    before,
    observeVerificationDockerInventory(),
    cleanup,
  );
  report.resources = resources;
  if (cleanup && resources.status === "verified") {
    try {
      assert.equal(fs.realpathSync.native(parent), parent);
      assert.equal(path.dirname(parent), trialRoot);
      const failures: string[] = [];
      assert.deepEqual(results.map((result) => result.mode).sort(), [
        "direct",
        "isolated",
      ]);
      for (const mode of ["direct", "isolated"] as const) {
        try {
          const evidence = results.find((result) => result.mode === mode);
          assert.ok(evidence, "fixture_result_missing");
          const root = path.join(parent, mode);
          const gate = assessFixtureRemoval(parent, mode, evidence);
          const gates =
            (report.fixtureRemovalGates as unknown[] | undefined) ?? [];
          gates.push({ mode, ...gate });
          report.fixtureRemovalGates = gates;
          assert.equal(gate.eligible, true, "fixture_cleanup_unconfirmed");
          fs.rmSync(root, { recursive: true, force: true });
        } catch {
          failures.push(`${mode}_fixture_removal_failed`);
        }
      }
      report.fixtureCleanupFailures = failures;
      report.fixtureRootsRemoved =
        failures.length === 0 &&
        ["direct", "isolated"].every(
          (mode) => !fs.existsSync(path.join(parent, mode)),
        );
    } catch {
      report.fixtureCleanupFailures = ["fixture_root_or_removal_unconfirmed"];
    }
  }
  // Taskの待機・取消・Owner終了・試験物処置が終わった後に実行Sourceを再観測する。
  report.sourceUnchanged = false;
  try {
    const after = observeRuntimeOwnedDevelopmentSource();
    report.sourceUnchanged =
      after !== null &&
      after.scope === sourceBefore.scope &&
      after.sourceSha256 === sourceBefore.sourceSha256 &&
      after.sourceIdentitySha256 === sourceBefore.sourceIdentitySha256;
  } catch {
    report.sourceUnchanged = false;
  }
  // 外部対話端末からの短命な結果引渡し。読取り・CHG要約後にFront AIが親ごと回収する。
  // 不明なRuntimeやWorktreeを再帰削除せず、同じ試験物の処置へ戻れるようにする。
  try {
    fs.writeFileSync(
      path.join(parent, "result.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
  } catch {
    report.resultWriteFailure = "verification_result_write_failed";
  }
  console.log(JSON.stringify(report));
  process.exitCode =
    results.length === 2 &&
    results.every((r) => r.limitedProbePassed === true) &&
    cleanup &&
    resources.status === "verified" &&
    report.fixtureRootsRemoved === true &&
    report.resultWriteFailure === undefined &&
    report.sourceUnchanged === true
      ? 0
      : 2;
}
await main().catch(() => {
  process.stderr.write("workspace_verification_preflight_failed\n");
  process.exitCode = 2;
});
