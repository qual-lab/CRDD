/**
 * DI／Executorの技術通知とEM資源記録の接続を検証する。
 * @responsibility 作成Intent・Receipt・元実ID・終了と回収の記録相関を確認する。
 * @trace ERB-IT-004
 * @level IT
 * @scope 有限CLI・Process・Filesystem代役と実モデルの値操作。
 * @boundary 実AI・Docker・過去保持物・耐久保存を扱わない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { captureIsolationRequest } from "../../../docker-isolation/src/execution/preparation.ts";
import type { IsolationRequest } from "../../../docker-isolation/src/index.ts";
import { createIsolationFixture } from "../../../docker-isolation/tests/support/isolation.ts";
import {
  applyResourceCleanup,
  applyResourceEvent,
  type OperationResources,
} from "../../../execution-model/src/index.ts";

const ISOLATION_SETTINGS = Object.freeze({
  windowsDirectory: "C:\\Windows",
  userHomeDirectory: "C:\\Users\\test",
});

/**
 * 作成Receiptを構成検査より先に記録し、失敗・取消でも同じIDを回収まで保持する。
 * @responsibility 作成応答・構成確認・保存・技術回収を別の事実として確認する。
 * @trace ERB-IT-004
 * @precondition 実DI共通Ownerと有限CLI／FS代役、純粋Domainだけを使用する。
 * @stimulus 正常、構成・Identity・Image・JSON拒否、通知拒否、応答後取消、不正ID。
 * @observation 通知時点のinspect数、保存ID、後続run、回収後Book。
 * @oracle 完全IDを検査前に通知し、検査拒否を成功にせず、Receipt済みBookは回収結果に接続できる。
 * @cleanup 同じ模擬資源の回収完了を待ち代役を復元する。
 * @boundary 実Docker・AI・保持物は使用しない。物理耐久性の証明ではない。
 */
test("作成Receiptは構成検査前に確定し拒否・取消後も回収記録へ接続する", async (t) => {
  for (const mode of [
    "normal",
    "configuration",
    "identity",
    "image",
    "json",
    "receipt_throw",
    "receipt_reject",
    "cancel",
    "invalid_id",
  ] as const)
    await t.test(mode, async (t) => {
      const f = await createIsolationFixture(t);
      const prepared = f.api.prepareIsolation(f.request, ISOLATION_SETTINGS);
      assert.ok(prepared);
      const cleanup = {
        cleanupOrder: f.request.cleanupOrder,
        setupTimeoutMs: f.request.setupTimeoutMs,
        unreceiptedAbsence: f.request.unreceiptedAbsence,
        verifyLabelAbsence: f.request.verifyLabelAbsence,
      };
      let book: OperationResources | null = null;
      let receipts = 0,
        mutated = false;
      f.observationFilter = (argv, result) => {
        if (!result) return result;
        if (mode === "invalid_id" && argv.includes("create"))
          return { ...result, stdout: "invalid-id\n" };
        if (mutated || !argv.includes("inspect")) return result;
        const image = argv.includes("image");
        if (mode === "image" ? !image : image) return result;
        if (!["configuration", "identity", "image", "json"].includes(mode))
          return result;
        mutated = true;
        if (mode === "json") return { ...result, stdout: "{" };
        const data = JSON.parse(result.stdout);
        if (mode === "configuration") data[0].HostConfig.ReadonlyRootfs = false;
        if (mode === "identity") data[0].Name = "/different";
        if (mode === "image") data[0].Id = `sha256:${"f".repeat(64)}`;
        return { ...result, stdout: JSON.stringify(data) };
      };
      const execution = f.api.executeIsolation(prepared, {
        onSubmitting: (step) => {
          if (step.action !== "create") return;
          book = applyResourceEvent(book, {
            event: "submission",
            key: step.resource,
            snapshot: prepared.resources,
            cleanup,
          });
          assert.ok(book);
        },
        onObserved: (step) => {
          if (mode === "cancel" && step.action === "create")
            void execution.cancel();
        },
        onCreated: (_step, snapshot) => {
          receipts++;
          assert.equal(f.calls.filter((a) => a.includes("inspect")).length, 0);
          assert.equal(
            snapshot.resources[0]?.identity.dockerId,
            "a".repeat(64),
          );
          if (mode === "receipt_throw") throw Error("synthetic_save_failure");
          if (mode === "receipt_reject")
            return Promise.reject(Error("synthetic_save_failure"));
          book = applyResourceEvent(book, {
            event: "receipt",
            key: "container",
            snapshot,
            cleanup,
          });
          assert.ok(book);
          assert.equal(
            book.checkpoints[0]?.receiptSource,
            "docker_create_result",
          );
          assert.equal(book.checkpoints[0]?.observation, "unobserved");
        },
        onResourceIdentified: (key, snapshot) => {
          // 不正create応答から推測せず、既存の再発見通知でだけIDを記録する。
          assert.equal(mode, "invalid_id");
          book = applyResourceEvent(book, {
            event: "identified",
            key,
            snapshot,
            cleanup,
          });
          assert.ok(book);
        },
      });
      const result = await execution.completion;
      assert.equal(receipts, mode === "invalid_id" ? 0 : 1);
      assert.equal(
        f.calls.some((a) => a[0] === "start"),
        mode === "normal",
      );
      assert.equal(
        result.failure === null,
        mode === "normal" || mode === "cancel",
      );
      assert.equal(result.cancellationRequested, mode === "cancel");
      assert.equal(result.cleanup.confirmed, true);
      assert.equal(f.ids.size, 0);
      if (!["invalid_id", "receipt_throw", "receipt_reject"].includes(mode)) {
        assert.ok(book);
        const closed = applyResourceCleanup(
          book,
          result.resources,
          result.cleanup.observations,
          {
            recoveryId: "exact-recovery",
            previousPayloadSha256: "a".repeat(64),
          },
        );
        assert.ok(closed);
        assert.equal(closed.checkpoints[0]?.observation, "absent");
      }
    });
});

/** 元準備だけを一回実行し、Receipt→結果→回収→Completionを確認する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-IT-004
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-IT-004=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("両Providerの通常Attemptは実Executorから実DIの共通Ownerと有限CLIへ接続する", async (t) => {
  const f = await createIsolationFixture(t);
  const di = await import("../../../docker-isolation/src/index.ts");
  let selected: "codex" | "claude" = "codex",
    released = 0;
  t.mock.module(new URL("../../../lock/src/index.ts", import.meta.url).href, {
    namedExports: {
      ...(await import(
        new URL("../../../lock/src/index.ts", import.meta.url).href
      )),
      acquireLock: () => ({
        status: "acquired",
        lock: {
          release: () => {
            released++;
            return true;
          },
          assertLive: () => true,
        },
      }),
    },
  });
  t.mock.module("../../../docker-isolation/src/index.ts", {
    namedExports: {
      ...di,
      prepareIsolation: (request: IsolationRequest) => {
        f.useRequest(captureIsolationRequest(request), selected);
        return f.api.prepareIsolation(request, ISOLATION_SETTINGS);
      },
      executeIsolation: f.api.executeIsolation,
    },
  });
  const { createExecutor }: typeof import("../../../executor/src/index.ts") =
    await import(
      `../../../executor/src/index.ts?common-chain=${Math.random()}`
    );
  for (const provider of ["codex", "claude"] as const)
    for (const mode of [
      "normal",
      "notice_failure",
      "cancel",
      "configuration_failure",
    ] as const)
      await t.test(`${provider}:${mode}`, async () => {
        selected = provider;
        released = 0;
        const callOffset = f.calls.length;
        let book: OperationResources | null = null;
        let mutated = false,
          closed = false;
        let diagnostic:
          | import("../../../executor/src/index.ts").PrimaryFailureDiagnostic
          | null = null;
        f.observationFilter = (argv, result) => {
          if (
            mode !== "configuration_failure" ||
            mutated ||
            !result ||
            !argv.includes("inspect") ||
            argv.includes("image")
          )
            return result;
          const data = JSON.parse(result.stdout);
          if (!data[0]?.HostConfig) return result;
          mutated = true;
          data[0].HostConfig.ReadonlyRootfs = false;
          return { ...result, stdout: JSON.stringify(data) };
        };
        const target = {
          provider,
          operationId: "OP-123456",
          grantRef: "PHMGRANT-123456",
          workspaceSourcePath: "C:\\fixture\\workspace",
          temporarySourcePath: "C:\\fixture\\tmp",
          providerHomeSourcePath: "C:\\fixture\\home",
          providerHomeIdentityHash: "a".repeat(64),
          stableLogicalHomeBindingHash: "d".repeat(64),
          activeMountCapability: {},
          workspaceProtection: {
            gitSourcePath: "C:\\fixture\\git-reference",
            internalSourcePath: "C:\\fixture\\internal",
          },
        };
        const executor =
          provider === "codex"
            ? createExecutor(
                {
                  kind: "attempt",
                  purpose: "task",
                  target,
                  selection: {
                    provider,
                    modelIdentifier: "gpt-5.5",
                    identifierKind: "exact",
                    reasoningEffort: "low",
                    purpose: "task",
                  },
                  input: "synthetic task input",
                  taskRole: "executor",
                  additionalHosts: [],
                },
                {
                  settings: ISOLATION_SETTINGS,
                  paths: {
                    tmp: target.temporarySourcePath,
                    management: "C:\\fixture\\management",
                  },
                },
              )
            : createExecutor(
                {
                  kind: "attempt",
                  purpose: "probe",
                  target,
                  selection: {
                    provider,
                    modelIdentifier: "opus",
                    identifierKind: "alias",
                    reasoningEffort: "low",
                    purpose: "task",
                  },
                },
                {
                  ...{
                    paths: {
                      tmp: target.temporarySourcePath,
                      management: "C:\\fixture\\management",
                    },
                  },
                  settings: Object.freeze({
                    windowsDirectory: "C:\\Windows",
                    userHomeDirectory: "C:\\Users\\test",
                  }),
                },
              );
        assert.ok(executor);
        const management = {};
        const started = executor.start({
          managementCapability: management,
          reference: {
            recoveryId: `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`,
            recoveryCapability: {},
          },
          callbacks: {
            onCommandSubmitting: async (purpose, resources) => {
              if (
                mode === "configuration_failure" &&
                purpose.startsWith("create_")
              ) {
                book = applyResourceEvent(book, {
                  ...resources,
                  event: "submission",
                  key: purpose,
                });
                assert.ok(book);
              }
              if (purpose === "create_provider") {
                if (mode === "notice_failure")
                  throw Error("synthetic_checkpoint_refusal");
                if (mode === "cancel" && started.status === "started")
                  await executor.cancel({
                    controlCapability: started.controlCapability,
                    managementCapability: management,
                  });
              }
            },
            onResourceCreated: (purpose, _id, resources) => {
              if (mode !== "configuration_failure") return;
              book = applyResourceEvent(book, {
                ...resources,
                event: "receipt",
                key: purpose,
              });
              assert.ok(book);
            },
            onCleanupCompleted: (observation) => {
              if (mode !== "configuration_failure") return;
              assert.ok(book);
              const final = applyResourceCleanup(
                book,
                observation.resourceSnapshot,
                observation.resources,
                {
                  recoveryId: observation.recoveryId,
                  previousPayloadSha256: "a".repeat(64),
                },
              );
              assert.ok(final);
              assert.equal(
                final.checkpoints.find(
                  (c) => c.key === "create_subscription_auth_probe",
                )?.observation,
                "absent",
              );
              closed = true;
            },
            onDiagnostic: (notice) => {
              if (notice.event === "coordinator_provider_boundary_settled")
                diagnostic = notice.primaryFailure;
            },
          },
        });
        assert.equal(started.status, "started");
        if (started.status !== "started") return;
        const result = await started.completion;
        assert.equal(
          result.status,
          mode === "normal"
            ? "completed"
            : mode === "cancel"
              ? "cancelled"
              : "blocked",
          JSON.stringify({ provider, mode, reason: result.reason }),
        );
        assert.equal(result.cleanupConfirmed, true);
        assert.equal(result.homeLeaseReleased, true);
        assert.equal(released, 1);
        assert.equal(f.ids.size, 0);
        assert.equal(result.resourceSnapshot?.resources.length, 5);
        assert.equal(result.hostPathReported, true);
        if (mode === "configuration_failure") {
          assert.equal(closed, true);
          assert.ok(diagnostic);
          const captured =
            diagnostic as import("../../../executor/src/index.ts").PrimaryFailureDiagnostic;
          assert.equal(captured.receiptRecorded, true);
          assert.equal(captured.isolationFailure?.stage, "observation");
          assert.equal(
            captured.isolationFailure?.reason,
            "docker_isolation_root_readonly_mismatch",
          );
          assert.equal(
            f.calls.slice(callOffset).some((argv) => argv[0] === "start"),
            false,
          );
        }
        assert.equal(
          JSON.stringify(result.resourceSnapshot).includes(
            "synthetic task input",
          ),
          false,
        );
        if (provider === "codex" && mode === "normal") {
          assert.ok(f.inputBodies.includes("synthetic task input"));
          assert.ok(
            f.protectedIdentities.includes(
              target.workspaceProtection.gitSourcePath,
            ),
          );
          assert.ok(
            f.calls.some((argv) =>
              argv.some((value) => value.includes("seccomp=")),
            ),
          );
        }
      });
});
