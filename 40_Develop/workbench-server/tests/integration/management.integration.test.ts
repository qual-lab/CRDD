/**
 * 通常管理のStandalone／CROSの直接HTTP入口を検証する。
 * @packageDocumentation
 * @responsibility 七保存、本人表示、現在認可と非開示を実保存へ接続する。
 * @trace RFD-IT-013
 * @trace RFD-IT-021
 * @trace RFD-IT-024
 * @trace EST-IT-002
 * @trace EST-IT-010
 * @trace EST-IT-014
 * @trace RCM-IT-005
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @level IT
 * @scope Workbench Server→AM→選択RootのDomain／Git／Coordinator活動読取り。MCPは使用しない。
 * @boundary 自己生成AM／登録Repositoryだけ。公開Launcherと実Browserは別評価。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import {
  type ClientRequest,
  request as httpRequest,
  ServerResponse,
} from "node:http";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createCredentialMaterial } from "../../../access-management/src/credential/token.ts";
import { deriveRepositoryBindingId } from "../../../access-management/src/repository/binding.ts";
import type { AccessManagementState } from "../../../access-management/src/storage/types.ts";
import { selectionConfig } from "../../../coordinator/tests/fixtures/ai-selection.ts";
import { createFilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import {
  createTaskAttemptSettledEvent,
  usageNotObserved,
  verifyExecutionIntelligenceRepositoryRoot,
  writeExecutionIntelligenceEvent,
} from "../../../execution-intelligence/src/index.ts";
import { observeLocalListener } from "../../../visual-preview/src/index.ts";
import { inspectWorkbenchClientModel } from "../../src/shared/view/validation.ts";
import { authenticateWorkbenchConnection } from "../../src/server/credential/administration.ts";
import { startWorkbench } from "../../src/index.ts";
import { inspectManagementResult } from "../../src/shared/management/validation.ts";
import {
  readAccessPortfolio,
  resolveAccessRepository,
} from "../../src/server/project/access-reader.ts";
import { resolveAccessTopicMeeting } from "../../src/server/topic-meeting/access-resolver.ts";
import { validateTopicMeetingActionForm } from "../../src/server/topic-meeting/action.ts";

/**
 * 自己生成Repositoryへ非秘密の活動履歴を準備する。
 * @responsibility 実EI Writerの履歴からProject絞込みとページングを反証する。
 * @trace EST-IT-014
 * @trace RFD-IT-024
 * @precondition 親Caseが作成・回収するRootだけを使用する。
 * @stimulus 実行しない模擬Attemptの識別子と現在時刻を既存Writerへ渡す。
 * @observation Writer結果と後続Workbench公開Event。
 * @oracle Provider未観測・非秘密の記録だけを準備し、実AI実行の根拠にしない。
 * @cleanup 親CaseがServer close後に自己生成Rootを削除する。
 * @boundary EI実保存と認可済み活動取得。
 */
function recordFixtureActivity(
  root: string,
  projectId: string,
  taskId: string,
) {
  const value = createTaskAttemptSettledEvent({
    occurredAt: new Date().toISOString(),
    identity: {
      projectId,
      milestoneId: "milestone.fixture",
      objectiveId: "objective.fixture",
      taskId,
      attemptId: `attempt.${taskId}`,
      operationId: `operation.${taskId}`,
    },
    outcome: {
      status: "completed",
      reason: "fixture_task_completed",
      effectState: "settled",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
    },
    execution: {
      role: "executor",
      provider: { state: "not_observed", reason: "provider_not_reported" },
      model: { state: "not_observed", reason: "model_not_reported" },
      inputStrategyRef: { state: "not_observed", reason: "input_not_reported" },
      durationMs: { state: "not_observed", reason: "duration_not_reported" },
      usage: usageNotObserved("usage_not_reported"),
      humanActiveMs: {
        state: "not_observed",
        reason: "human_time_not_reported",
      },
    },
    quality: {
      state: "not_applicable",
      reason: "attempt_settlement_is_not_acceptance",
    },
  });
  const verified = verifyExecutionIntelligenceRepositoryRoot(root);
  assert.ok(verified.status === "completed");
  assert.equal(
    writeExecutionIntelligenceEvent(verified.root, value).status,
    "completed",
  );
  return value;
}

/**
 * 管理Formの未完了Bodyを自己生成Serverへ搬送する。
 * @responsibility 保存前の切断・Server終了を実streamで作る。
 * @trace EST-IT-010
 * @input 所有Workbenchのloopback URL。
 * @returns Body終端前の所有ClientRequest。
 * @precondition 当該試験がServer終了とRequest破棄を所有する。
 * @stimulus Content-Length未満の無効なFormを一回送信する。
 * @observation Body未完了のClientRequestをcallerへ返す。
 * @oracle 未完了Bodyから有効な管理保存を開始しない。
 * @cleanup callerがRequestを破棄し、所有Server終了と合わせて確認する。
 * @postcondition Content-Length分のBodyを送らず、操作を完結しない。
 * @effect 同Originの部分POST一回。
 * @failure write失敗は試験失敗。自動再送しない。
 * @invariant 資格・Action Token・有効操作を本文へ入れない。
 * @boundary 実HTTPのBody待機と利用側の切断。
 * @security 自己生成loopback以外へ接続しない。
 * @concurrency callerがcloseを待ち、必要時にServerもcloseする。
 */
async function openIncompleteManagementBody(
  baseUrl: string,
): Promise<ClientRequest> {
  const request = httpRequest(`${baseUrl}/access-management/action`, {
    method: "POST",
    headers: {
      origin: baseUrl,
      "content-type": "application/x-www-form-urlencoded",
      "content-length": "1024",
    },
  });
  request.on("error", () => {});
  await new Promise<void>((resolve, reject) => {
    request.write("incomplete=", (error) =>
      error ? reject(error) : resolve(),
    );
  });
  await delay(50);
  return request;
}

for (const mode of ["local", "cros"] as const) {
  /**
   * 共通六操作とRepository登録を実HTTPで確認する。
   * @responsibility Root・資格を公開せず、保存結果と現在投影を照合する。
   * 登録解除の刺激: 認可済み本文読取りを開始後に保留し、登録とExposureを解除する。
   * 登録解除の観測: 解除完了時の旧読取り未終了、保留解放後の403とjoinを別々に確認する。
   * 登録解除のOracle: 解除成功を旧処理終了へ読み替えず、旧本文は公開せず、本体は保持する。
   * @trace RFD-IT-013
   * @trace RFD-IT-021
   * @trace RFD-IT-024
   * @trace EST-IT-010
   * @trace EST-IT-014
   * @trace RCM-IT-005
   * @trace CPR-IT-010
   * @trace CPR-IT-012
   * @trace EST-IT-002
   * @precondition 自己生成完了AM、登録可能Git Repository、本番ServerとBundle。
   * @stimulus 本人・四read・通常保存・不正Token／Origin・明示登録と選択GET、内容読取り中のExposure／資格／sibling／Binding／manifest変更、同値集合順序変更、重複ID正逆・同値とAI設定欠測、活動開始前および履歴open中のClient破棄を適用する。Repository AI設定は三RoleのGET／CAS保存、競合・重複入力・失効・設定故障を適用する。 Snapshot直後と保存直後の降格／失効、保存直後の例外／Client切断も適用する。
   * @observation HTTP閉結果と実File改訂・保持状態、活動履歴のopen-close件数、Server成功本文、取消後の新しいHTTP接続の結果を観測する。選択Repositoryの設定Identityと保存回数も観測する。 後段の403／503、成功本文0、保存済み改訂のfresh再観測を区別する。
   * @oracle 明示保存だけ一回、登録だけでは公開0、他User／Root／資格非公開。指定ID／Context／manifest相関、AI設定欠測とAI未接続、直前結果null、全集合変更後の部分公開0、同値順序変更許容、重複IDのopen／read 0。活動開始前は履歴読取り0、開始後は対象二Rootを各一回closeまでjoinし、成功本文0・再実行0・次要求正常を満たす。 非管理Role・失効では設定保存0、管理Roleと選択Repository development認可の明示保存一回、競合でIdentity不変、設定故障でfallback0を満たす。 観測後の許可失効は非公開、保存後不明・切断は改訂維持・保存一回・次要求再観測でありrollbackを行わない。
   * @cleanup 所有Serverをclose後、exact自己生成Rootだけを回収する。
   * @boundary 単体と同Host CROSの同じAM保存Owner。選択Root以外へfallbackせず、Browser描画の代替ではない。
   */
  test(`Workbench通常管理 ${mode}の実保存と閉結果`, async (t) => {
    const repository = path.resolve(import.meta.dirname, "../../../..");
    const base = path.join(repository, ".crdd", "tests");
    fs.mkdirSync(base, { recursive: true });
    const owned = fs.mkdtempSync(path.join(base, "workbench-management-"));
    t.after(() => {
      assert.equal(path.dirname(owned), base);
      assert.equal(fs.realpathSync.native(owned), owned);
      fs.rmSync(owned, { recursive: true });
      assert.equal(fs.existsSync(owned), false);
    });
    const root = createFilesystemStoreRoot(owned);
    assert.ok(root);
    const userId = randomUUID(),
      operationId = randomUUID(),
      material = createCredentialMaterial();
    const state: AccessManagementState = {
      contract: "crdd-access-management/state",
      schemaRevision: 2,
      revision: 1,
      operationId,
      users: [{ userId, username: "管理者", role: "administrator" }],
      roleContentAccess: [
        { role: "developer", workspaceIds: ["development"] },
        { role: "manager", workspaceIds: ["development", "management"] },
        { role: "administrator", workspaceIds: [] },
      ],
      credentials: [
        {
          credentialId: material.credentialId,
          userId,
          tokenVersion: 1,
          tokenSalt: material.tokenSalt,
          tokenVerifier: material.tokenVerifier,
          revoked: false,
          operationId,
          presentation: "confirmed",
        },
      ],
      registeredRepositories: [],
      exposure: [],
      unresolvedKeyExchanges: [],
      initialization: {
        stage: "completed",
        attemptId: operationId,
        initialUserId: userId,
        initialCredentialId: material.credentialId,
        confirmationCredentialId: material.credentialId,
        connection: "confirmed",
      },
    };
    const current = path.join(owned, "access-management.json");
    fs.writeFileSync(current, JSON.stringify(state));
    if (mode === "local") {
      const actionToken = "a".repeat(43);
      const form = new URLSearchParams({
        actionToken,
        operation: "connect",
        token: material.token,
      });
      const signal = new AbortController().signal;
      const original = fs.readFileSync(current);
      const authenticated = authenticateWorkbenchConnection(
        root,
        form,
        actionToken,
        signal,
      );
      assert.equal(authenticated.root, root);
      assert.equal(authenticated.token, material.token);
      assert.deepEqual(fs.readFileSync(current), original);
      for (const invalid of [
        new URLSearchParams([...form, ["token", material.token]]),
        new URLSearchParams([...form, ["root", owned]]),
        new URLSearchParams({ actionToken, operation: "connect" }),
        new URLSearchParams({
          actionToken: "wrong",
          operation: "connect",
          token: material.token,
        }),
      ]) {
        assert.throws(
          () =>
            authenticateWorkbenchConnection(root, invalid, actionToken, signal),
          { message: "workbench_local_connection_input_invalid" },
        );
        assert.deepEqual(fs.readFileSync(current), original);
      }
      const cancelled = new AbortController();
      cancelled.abort();
      assert.throws(
        () =>
          authenticateWorkbenchConnection(
            root,
            form,
            actionToken,
            cancelled.signal,
          ),
        { message: "workbench_local_connection_cancelled" },
      );
      assert.deepEqual(fs.readFileSync(current), original);
      assert.throws(
        () =>
          authenticateWorkbenchConnection(
            root,
            new URLSearchParams({
              actionToken,
              operation: "connect",
              token: "invalid",
            }),
            actionToken,
            signal,
          ),
        { message: "workbench_local_connection_unavailable" },
      );
      assert.deepEqual(fs.readFileSync(current), original);
      const initial: AccessManagementState = JSON.parse(
        original.toString("utf8"),
      );
      initial.initialization = {
        stage: "credential_stored",
        attemptId: operationId,
        userId,
        initialCredentialId: material.credentialId,
        confirmationCredentialId: material.credentialId,
      };
      fs.writeFileSync(current, JSON.stringify(initial));
      const pending = fs.readFileSync(current);
      assert.throws(
        () =>
          authenticateWorkbenchConnection(
            root,
            new URLSearchParams([...form, ["extra", "x"]]),
            actionToken,
            signal,
          ),
        { message: "workbench_local_connection_input_invalid" },
      );
      assert.deepEqual(fs.readFileSync(current), pending);
      const connected = authenticateWorkbenchConnection(
        root,
        form,
        actionToken,
        signal,
      );
      assert.equal(connected.token, material.token);
      const confirmed: AccessManagementState = JSON.parse(
        fs.readFileSync(current, "utf8"),
      );
      assert.equal(confirmed.initialization.stage, "completed");
      assert.equal(confirmed.revision, initial.revision + 1);
      assert.equal(confirmed.credentials.length, initial.credentials.length);
      assert.equal(confirmed.users.length, initial.users.length);
      const completedBytes = fs.readFileSync(current);
      authenticateWorkbenchConnection(root, form, actionToken, signal);
      assert.deepEqual(fs.readFileSync(current), completedBytes);
      fs.writeFileSync(current, original);
    }
    const target = path.join(owned, "repository");
    fs.mkdirSync(target);
    const git = spawnSync("git", ["init", "--quiet", target], {
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(git.status, 0);
    fs.mkdirSync(path.join(target, ".crdd", "config"), { recursive: true });
    fs.writeFileSync(
      path.join(target, ".crdd", "config", "repository-manifest.json"),
      JSON.stringify({
        schema: "crdd/repository-manifest/v2",
        projectId: "project.fixture",
        repositoryId: "repository.fixture",
        displayName: "試験",
        repositoryRole: "development",
        capabilities: [],
        contextSurfaces: [],
        externalSendPolicy: null,
      }),
    );
    fs.writeFileSync(
      path.join(target, "PROJECT_CONTEXT.md"),
      "# Project Context\n\nProject ID: project.fixture\nRepository ID: repository.fixture\nRepository Role: development\n" +
        [
          "今どうなっているか",
          "何が危ない、または止まっているか",
          "今、人間が決めることは何か",
          "なぜこの状態・判断になったか",
          "次に何をすべきか",
        ]
          .map(
            (heading, index) =>
              `\n## ${index + 1}. ${heading}\n\n### 結論\n\n自己生成試験。\n\n| 項目 | 内容 |\n|---|---|\n| 試験 | 固定 |\n`,
          )
          .join(""),
    );
    if (mode === "local") {
      const startup = path.join(owned, "startup");
      fs.mkdirSync(startup);
      assert.equal(
        spawnSync("git", ["init", "--quiet", startup], {
          encoding: "utf8",
          windowsHide: true,
        }).status,
        0,
      );
      const logoDirectory = path.join(startup, "04_UI", "assets", "brand");
      fs.mkdirSync(logoDirectory, { recursive: true });
      fs.copyFileSync(
        path.join(
          repository,
          "04_UI",
          "assets",
          "brand",
          "crdd-brand-icon-512x512.jpg",
        ),
        path.join(logoDirectory, "crdd-brand-icon-512x512.jpg"),
      );
      const forbiddenBody =
        "BROKEN STARTUP REPOSITORY CONTENT MUST NOT BE READ";
      fs.writeFileSync(path.join(startup, "PROJECT_CONTEXT.md"), forbiddenBody);
      const before = fs.readFileSync(current);
      const local = await startWorkbench({
        workingDirectory: startup,
        localAccessRoot: root,
      });
      try {
        const access = inspectWorkbenchClientModel(
          await (await fetch(`${local.baseUrl}/api/workbench-view`)).json(),
        );
        assert.ok(access.view === "access");
        assert.equal(access.authenticated, false);
        assert.equal(access.portfolio, null);
        assert.equal(access.credentials.state, "not_configured");
        assert.deepEqual(fs.readFileSync(current), before);
        for (const route of [
          "/",
          "/workbench.css",
          "/assets/crdd-brand-icon.jpg",
          "/assets/workbench-client.js",
          "/.well-known/crdd-workbench-health",
        ]) {
          const reply = await fetch(`${local.baseUrl}${route}`);
          assert.equal(reply.status, 200);
          if (route !== "/assets/crdd-brand-icon.jpg")
            assert.equal((await reply.text()).includes(forbiddenBody), false);
        }
        /**
         * 接続専用Formを同Originの実HTTPへ一回送信する。
         * @responsibility 接続・拒否・確認出版の応答を自動再送なしに観測する。
         * @trace RFD-IT-024
         * @trace EST-IT-010
         * @precondition 自己生成ServerとAction Tokenだけを使用する。
         * @stimulus 完全Formまたは固定反例をPOSTする。
         * @observation HTTP状態と親試験による状態byte観測。
         * @oracle 非秘密303、拒否400、拒否時確認出版0。
         * @cleanup Serverは親CaseがcloseしてListener不存在を観測する。
         * @boundary 実HTTP接続FormとAM確認保存。
         */
        async function submitConnection(
          form: URLSearchParams,
          origin: string | null = local.baseUrl,
          host?: string,
        ) {
          if (host !== undefined) {
            const body = form.toString();
            return new Promise<Response>((resolve, reject) => {
              const outgoing = httpRequest(
                `${local.baseUrl}/local-connection/action`,
                {
                  method: "POST",
                  headers: {
                    host,
                    ...(origin === null ? {} : { origin }),
                    "content-type": "application/x-www-form-urlencoded",
                    "content-length": String(Buffer.byteLength(body)),
                  },
                },
                (incoming) => {
                  let text = "";
                  incoming.setEncoding("utf8");
                  incoming.on("data", (chunk: string) => {
                    text += chunk;
                  });
                  incoming.once("error", reject);
                  incoming.once("end", () =>
                    resolve(
                      new Response(text, {
                        status: incoming.statusCode ?? 500,
                      }),
                    ),
                  );
                },
              );
              outgoing.once("error", reject);
              outgoing.setTimeout(5000, () =>
                outgoing.destroy(new Error("fixture_http_timeout")),
              );
              outgoing.end(body);
            });
          }
          return fetch(`${local.baseUrl}/local-connection/action`, {
            method: "POST",
            redirect: "manual",
            headers: {
              ...(origin === null ? {} : { origin }),
              "content-type": "application/x-www-form-urlencoded",
            },
            body: form,
          });
        }
        const connect = new URLSearchParams({
          actionToken: access.actionToken,
          operation: "connect",
          token: material.token,
        });
        assert.equal(
          (await submitConnection(connect, "http://example.invalid")).status,
          400,
        );
        assert.deepEqual(fs.readFileSync(current), before);
        assert.equal((await submitConnection(connect, null)).status, 400);
        assert.deepEqual(fs.readFileSync(current), before);
        assert.equal(
          (await submitConnection(connect, local.baseUrl, "example.invalid"))
            .status,
          400,
        );
        assert.deepEqual(fs.readFileSync(current), before);
        const accepted = await submitConnection(connect);
        assert.equal(accepted.status, 200);
        assert.equal(accepted.headers.get("location"), null);
        assert.match(
          accepted.headers.get("content-type") ?? "",
          /^application\/json/u,
        );
        assert.deepEqual(await accepted.json(), { status: "completed" });
        assert.deepEqual(fs.readFileSync(current), before);
        const modelText = await (
          await fetch(`${local.baseUrl}/api/workbench-view`, {
            headers: { authorization: `Bearer ${material.token}` },
          })
        ).text();
        for (const hidden of [
          material.token,
          material.tokenSalt,
          material.tokenVerifier,
          owned,
          startup,
          forbiddenBody,
        ])
          assert.equal(modelText.includes(hidden), false);
        const connected = inspectWorkbenchClientModel(JSON.parse(modelText));
        assert.ok(connected.view === "access");
        assert.equal(connected.authenticated, true);
        assert.deepEqual(connected.portfolio?.projects, []);
        const otherBrowser = inspectWorkbenchClientModel(
          await (await fetch(`${local.baseUrl}/api/workbench-view`)).json(),
        );
        assert.ok(otherBrowser.view === "access");
        assert.equal(otherBrowser.authenticated, false);
        assert.equal(otherBrowser.portfolio, null);
        assert.equal(otherBrowser.credentials.state, "not_configured");
        const actor = inspectManagementResult(
          await (
            await fetch(`${local.baseUrl}/api/access-management?view=current`, {
              headers: { authorization: `Bearer ${material.token}` },
            })
          ).json(),
          "current",
        );
        assert.equal(actor.status, "completed");
        for (const route of [
          "/owner-artifact?path=PROJECT_CONTEXT.md",
          "/change?id=CHG-000001",
        ]) {
          const shell = await fetch(`${local.baseUrl}${route}`);
          assert.equal(shell.status, 200);
          assert.match(shell.headers.get("content-type") ?? "", /text\/html/u);
          const body = await shell.text();
          assert.ok(body.includes("data-workbench-react-root"));
          for (const hidden of [material.token, owned, startup, forbiddenBody])
            assert.equal(body.includes(hidden), false);
        }
        assert.equal(
          (
            await fetch(
              `${local.baseUrl}/api/workbench-view?repositoryId=repository.fixture&route=%2Ftopic&id=TOPIC-000001`,
            )
          ).status,
          403,
        );
        const unauthenticatedArtifact = inspectWorkbenchClientModel(
          await (
            await fetch(
              `${local.baseUrl}/api/workbench-view?repositoryId=repository.fixture&route=%2Fchange&id=CHG-000001`,
            )
          ).json(),
        );
        assert.equal(unauthenticatedArtifact.view, "access");
        if (unauthenticatedArtifact.view === "access") {
          assert.equal(unauthenticatedArtifact.authenticated, false);
          assert.equal(unauthenticatedArtifact.portfolio, null);
          assert.equal(
            unauthenticatedArtifact.credentials.state,
            "not_configured",
          );
        }
        assert.equal(
          (
            await submitConnection(
              new URLSearchParams({
                actionToken: access.actionToken,
                operation: "disconnect",
              }),
            )
          ).status,
          200,
        );
        const disconnected = inspectWorkbenchClientModel(
          await (await fetch(`${local.baseUrl}/api/workbench-view`)).json(),
        );
        assert.ok(disconnected.view === "access");
        assert.equal(disconnected.authenticated, false);
        const initial: AccessManagementState = JSON.parse(
          before.toString("utf8"),
        );
        initial.initialization = {
          stage: "credential_stored",
          attemptId: operationId,
          userId,
          initialCredentialId: material.credentialId,
          confirmationCredentialId: material.credentialId,
        };
        fs.writeFileSync(current, JSON.stringify(initial));
        const pending = fs.readFileSync(current);
        await fetch(`${local.baseUrl}/api/workbench-view`);
        assert.deepEqual(fs.readFileSync(current), pending);
        assert.equal((await submitConnection(connect, null)).status, 400);
        assert.deepEqual(fs.readFileSync(current), pending);
        assert.equal(
          (await submitConnection(connect, local.baseUrl, "example.invalid"))
            .status,
          400,
        );
        assert.deepEqual(fs.readFileSync(current), pending);
        assert.equal(
          (
            await submitConnection(
              new URLSearchParams([...connect, ["token", material.token]]),
            )
          ).status,
          400,
        );
        assert.deepEqual(fs.readFileSync(current), pending);
        const confirmed = await submitConnection(connect);
        assert.equal(confirmed.status, 200);
        assert.deepEqual(await confirmed.json(), { status: "completed" });
        const currentState: AccessManagementState = JSON.parse(
          fs.readFileSync(current, "utf8"),
        );
        assert.equal(currentState.initialization.stage, "completed");
        assert.equal(currentState.revision, initial.revision + 1);
        const onlyCredential = currentState.credentials[0];
        assert.ok(onlyCredential);
        onlyCredential.revoked = true;
        const secondUserId = randomUUID();
        const secondMaterial = createCredentialMaterial();
        currentState.users.push({
          userId: secondUserId,
          username: "別の利用者",
          role: "developer",
        });
        currentState.credentials.push({
          credentialId: secondMaterial.credentialId,
          userId: secondUserId,
          tokenVersion: 1,
          tokenSalt: secondMaterial.tokenSalt,
          tokenVerifier: secondMaterial.tokenVerifier,
          revoked: false,
          operationId: randomUUID(),
          presentation: "confirmed",
        });
        fs.writeFileSync(current, JSON.stringify(currentState));
        const revoked = inspectWorkbenchClientModel(
          await (
            await fetch(`${local.baseUrl}/api/workbench-view`, {
              headers: { authorization: `Bearer ${material.token}` },
            })
          ).json(),
        );
        assert.ok(revoked.view === "access");
        assert.equal(revoked.authenticated, false);
        assert.equal(revoked.portfolio, null);
        const secondActor = inspectManagementResult(
          await (
            await fetch(`${local.baseUrl}/api/access-management?view=current`, {
              headers: { authorization: `Bearer ${secondMaterial.token}` },
            })
          ).json(),
          "current",
        );
        assert.ok(secondActor.status === "completed" && "user" in secondActor);
        assert.equal(secondActor.user.userId, secondUserId);
        assert.equal(secondActor.user.role, "developer");
        const secondModel = inspectWorkbenchClientModel(
          await (
            await fetch(`${local.baseUrl}/api/workbench-view`, {
              headers: { authorization: `Bearer ${secondMaterial.token}` },
            })
          ).json(),
        );
        assert.ok(secondModel.view === "access");
        assert.equal(secondModel.authenticated, true);
        assert.equal(secondModel.credentials.snapshot, null);
        const duplicateBody = await new Promise<string>((resolve, reject) => {
          const outgoing = httpRequest(
            `${local.baseUrl}/api/workbench-view`,
            {
              headers: [
                "Host",
                new URL(local.baseUrl).host,
                "Authorization",
                `Bearer ${secondMaterial.token}`,
                "Authorization",
                `Bearer ${secondMaterial.token}`,
              ],
            },
            (incoming) => {
              let body = "";
              incoming.setEncoding("utf8");
              incoming.on("data", (chunk: string) => {
                body += chunk;
              });
              incoming.once("error", reject);
              incoming.once("end", () => resolve(body));
            },
          );
          outgoing.once("error", reject);
          outgoing.setTimeout(5000, () =>
            outgoing.destroy(new Error("fixture_http_timeout")),
          );
          outgoing.end();
        });
        const duplicateModel = inspectWorkbenchClientModel(
          JSON.parse(duplicateBody),
        );
        assert.ok(duplicateModel.view === "access");
        assert.equal(duplicateModel.authenticated, false);
        assert.equal(duplicateModel.portfolio, null);
        const malformedModel = inspectWorkbenchClientModel(
          await (
            await fetch(`${local.baseUrl}/api/workbench-view`, {
              headers: {
                authorization: `Bearer ${secondMaterial.token} extra`,
              },
            })
          ).json(),
        );
        assert.ok(malformedModel.view === "access");
        assert.equal(malformedModel.authenticated, false);
        const noAuthority = inspectManagementResult(
          await (
            await fetch(`${local.baseUrl}/api/access-management?view=current`)
          ).json(),
          "current",
        );
        assert.equal(noAuthority.status, "unavailable");
        assert.equal(fs.existsSync(path.join(startup, ".crdd")), false);
        assert.equal(
          fs.readFileSync(path.join(startup, "PROJECT_CONTEXT.md"), "utf8"),
          forbiddenBody,
        );
      } finally {
        await local.close();
        assert.equal(
          await observeLocalListener(Number(new URL(local.baseUrl).port)),
          "absent",
        );
        fs.writeFileSync(current, before);
      }
    }
    const handle = await startWorkbench({
      workingDirectory: repository,
      ...(mode === "cros"
        ? {
            localAccessRoot: root,
          }
        : { credentialAdministration: { root, token: material.token } }),
    });
    /**
     * 当該要求だけにCROS資格を搬送する。
     * @responsibility 明示Bearerを同じ所有Workbenchへ送り、別Serverや共有Sessionを作らない。
     * @trace RFD-IT-013
     * @trace EST-IT-010
     * @precondition 自己生成Workbenchとfixture資格だけを使う。
     * @stimulus 同じHTTP操作をStandaloneとCROSで要求する。
     * @observation 入力Headerと閉結果・実保存を確認する。
     * @oracle CROSは毎要求認証し、入力と改訂を同じAMへ渡す。
     * @cleanup N/A: 個々のResponseはCaseが読み切る。
     * @boundary 自己生成HTTPとAMの直接接続。
     */
    async function fetchWorkbench(input: string, options: RequestInit = {}) {
      const headers = new Headers(options.headers);
      if (mode === "cros")
        headers.set("authorization", `Bearer ${material.token}`);
      return fetch(input, { ...options, headers });
    }
    try {
      const model = await (
        await fetchWorkbench(`${handle.baseUrl}/api/workbench-view`)
      ).json();
      assert.equal(model.view, mode === "cros" ? "access" : "main");
      const actorReply = await fetchWorkbench(
        `${handle.baseUrl}/api/access-management?view=current`,
      );
      assert.equal(actorReply.headers.get("x-crdd-management-mode"), "local");
      const actor = inspectManagementResult(await actorReply.json(), "current");
      assert.equal(actor.status, "completed");
      assert.ok("user" in actor);
      assert.equal(actor.user.userId, userId);
      if (mode === "cros") {
        const originalManagement = fs.readFileSync(current);
        const scopedSelection = JSON.parse(
          originalManagement.toString("utf8"),
        ) as AccessManagementState;
        scopedSelection.registeredRepositories.push({
          repositoryId: "repository.fixture",
          repositoryRoot: target,
          bindingId: deriveRepositoryBindingId("repository.fixture", target),
        });
        scopedSelection.exposure = [
          { repositoryId: "repository.fixture", workspaceIds: ["development"] },
        ];
        const adminContent = scopedSelection.roleContentAccess.find(
          (entry) => entry.role === "administrator",
        );
        assert.ok(adminContent);
        adminContent.workspaceIds = ["development"];
        const saved = Buffer.from(JSON.stringify(scopedSelection));
        fs.writeFileSync(current, saved);
        const configPath = path.join(
          target,
          ".crdd",
          "config",
          "ai-selection.json",
        );
        const endpoint = `${handle.baseUrl}/api/ai-selection?repositoryId=repository.fixture`;
        const action = `${handle.baseUrl}/ai-selection/action`;
        const headers = {
          origin: handle.baseUrl,
          "content-type": "application/x-www-form-urlencoded",
        };
        /**
         * Repository設定の明示保存を一回送る。
         * @responsibility 固定Originと既存接続資格を使い同じ選択Rootへ配送する。
         * @trace RCM-IT-005
         * @precondition 本番Serverと合成Form。
         * @stimulus 設定POSTを一回発行する。
         * @observation HTTP結果と保存回数。
         * @oracle 自動再送せず現在認可を迂回しない。
         * @cleanup 親CaseがServerと合成Rootを回収する。
         * @boundary 自己生成設定と本番HTTP。実AIなし。
         */
        const post = (form: URLSearchParams) =>
          fetchWorkbench(action, { method: "POST", headers, body: form });
        /**
         * 合成設定と期待Identityの閉Formを作る。
         * @responsibility 同じRepositoryのCAS反証入力を用意する。
         * @trace RCM-IT-005
         * @precondition 固定五役割の合成設定。
         * @stimulus ラベルと期待Hashだけを指定する。
         * @observation 実送信Form。
         * @oracle 秘密値・別Repository Rootを含めない。
         * @cleanup 局所文字列のみ。
         * @boundary 自己生成設定と本番HTTP。実AIなし。
         */
        const makeForm = (identity: string | null, label: string) => {
          const config = selectionConfig();
          config.workTypes.coding.label = label;
          return new URLSearchParams({
            actionToken: model.actionToken,
            repositoryId: "repository.fixture",
            expectedIdentity: identity ?? "",
            config: JSON.stringify(config),
          });
        };
        /**
         * 自己生成AMの現在資格だけを変更する。
         * @responsibility 保存又は読取り後の再認可を反証する。
         * @trace RCM-IT-005
         * @precondition 元状態をfinallyで復元する。
         * @stimulus 降格・失効。
         * @observation HTTP拒否と正本保持。
         * @oracle 過去の許可を流用しない。
         * @cleanup 親Caseが復元・清掃する。
         * @boundary 合成AMと本番設定受付。
         */
        function changeSelectionActor(kind: "role" | "credential"): void {
          const state = JSON.parse(
            saved.toString("utf8"),
          ) as AccessManagementState;
          state.revision++;
          state.operationId = randomUUID();
          if (kind === "role") {
            const user = state.users.find((entry) => entry.userId === userId);
            assert.ok(user);
            user.role = "developer";
          } else {
            const credential = state.credentials[0];
            assert.ok(credential);
            credential.revoked = true;
          }
          fs.writeFileSync(current, JSON.stringify(state));
        }
        try {
          for (const role of [
            "developer",
            "manager",
            "administrator",
          ] as const) {
            const state = JSON.parse(
              saved.toString("utf8"),
            ) as AccessManagementState;
            const user = state.users.find((entry) => entry.userId === userId);
            assert.ok(user);
            user.role = role;
            fs.writeFileSync(current, JSON.stringify(state));
            const before = fs.existsSync(configPath)
              ? fs.readFileSync(configPath)
              : null;
            const listed = await fetchWorkbench(endpoint);
            assert.equal(listed.status, role === "developer" ? 403 : 200);
            if (role === "developer") {
              assert.equal((await post(makeForm(null, role))).status, 400);
              assert.equal(fs.existsSync(configPath), before !== null);
              continue;
            }
            const initial = await listed.json();
            const form = makeForm(initial.snapshot?.identity ?? null, role);
            const result = await post(form);
            assert.equal(result.status, 200);
            const body = await result.json();
            assert.equal(body.status, "saved");
            assert.equal(body.snapshot.config.workTypes.coding.label, role);
            const stale = makeForm(null, "stale");
            assert.equal((await (await post(stale)).json()).status, "conflict");
            const invalid = new URLSearchParams(form);
            invalid.append("expectedIdentity", "");
            assert.equal((await post(invalid)).status, 400);
            const currentConfig = await (await fetchWorkbench(endpoint)).json();
            assert.equal(
              currentConfig.snapshot.identity,
              body.snapshot.identity,
            );
          }
          fs.writeFileSync(current, saved);
          for (const kind of ["role", "credential"] as const) {
            const open = fs.openSync,
              close = fs.closeSync;
            let owned: number | null = null,
              reads = 0;
            const opened = t.mock.method(
              fs,
              "openSync",
              (...args: Parameters<typeof fs.openSync>) => {
                const fd = open(...args);
                if (String(args[0]) === configPath) owned = fd;
                return fd;
              },
            );
            const closed = t.mock.method(fs, "closeSync", (fd: number) => {
              close(fd);
              if (fd === owned) {
                owned = null;
                reads++;
                changeSelectionActor(kind);
              }
            });
            syncBuiltinESMExports();
            try {
              const reply = await fetchWorkbench(endpoint);
              assert.equal(reply.status, 403);
              assert.equal(reads, 1);
            } finally {
              opened.mock.restore();
              closed.mock.restore();
              syncBuiltinESMExports();
              fs.writeFileSync(current, saved);
            }
          }
          for (const kind of ["role", "credential", "throw", "cut"] as const) {
            const before = await (await fetchWorkbench(endpoint)).json();
            const label = `after-save-${kind}`;
            const form = makeForm(before.snapshot.identity, label);
            const client: { request: ClientRequest | null } = { request: null };
            let publications = 0;
            const rename = fs.renameSync;
            const afterSave = t.mock.method(
              fs,
              "renameSync",
              (source: fs.PathLike, destination: fs.PathLike) => {
                rename(source, destination);
                if (String(destination) !== configPath) return;
                publications++;
                if (kind === "role" || kind === "credential")
                  changeSelectionActor(kind);
                if (kind === "throw")
                  throw Error("fixture_after_selection_publication");
                if (kind === "cut") client.request?.destroy();
              },
            );
            syncBuiltinESMExports();
            try {
              if (kind === "cut") {
                await new Promise<void>((resolve) => {
                  client.request = httpRequest(action, {
                    method: "POST",
                    agent: false,
                    headers: {
                      ...headers,
                      authorization: `Bearer ${material.token}`,
                      "content-length": String(
                        Buffer.byteLength(form.toString()),
                      ),
                    },
                  });
                  client.request.on("error", () => {});
                  client.request.once("close", resolve);
                  client.request.setTimeout(5000, () =>
                    client.request?.destroy(),
                  );
                  client.request.end(form.toString());
                });
                await delay(100);
                assert.equal(client.request?.destroyed, true);
              } else {
                const reply = await post(form);
                assert.equal(reply.status, kind === "throw" ? 200 : 503);
                if (kind === "throw")
                  assert.equal((await reply.json()).status, "unknown");
              }
              assert.equal(publications, 1);
            } finally {
              client.request?.destroy();
              afterSave.mock.restore();
              syncBuiltinESMExports();
              fs.writeFileSync(current, saved);
            }
            const currentConfig = await (await fetchWorkbench(endpoint)).json();
            assert.equal(
              currentConfig.snapshot.config.workTypes.coding.label,
              label,
            );
            assert.equal(publications, 1);
          }
          const open = fs.openSync;
          const broken = t.mock.method(
            fs,
            "openSync",
            (...args: Parameters<typeof fs.openSync>) => {
              if (String(args[0]) === configPath)
                throw Object.assign(Error("fixture_read_unavailable"), {
                  code: "EACCES",
                });
              return open(...args);
            },
          );
          syncBuiltinESMExports();
          try {
            assert.equal(
              (await (await fetchWorkbench(endpoint)).json()).status,
              "blocked",
            );
          } finally {
            broken.mock.restore();
            syncBuiltinESMExports();
          }
          changeSelectionActor("credential");
          assert.equal((await fetchWorkbench(endpoint)).status, 403);
          assert.equal((await fetch(endpoint)).status, 403);
        } finally {
          fs.writeFileSync(current, originalManagement);
        }
      }
      for (const view of [
        "users",
        "roles",
        "repositories",
        "exposure",
      ] as const) {
        const reply = await fetchWorkbench(
          `${handle.baseUrl}/api/access-management?view=${view}`,
        );
        const text = await reply.text();
        inspectManagementResult(JSON.parse(text), view);
        for (const hidden of [
          material.token,
          material.tokenSalt,
          material.tokenVerifier,
          owned,
          target,
          "bindingId",
        ])
          assert.equal(text.includes(hidden), false);
      }

      /**
       * 同じUI Form形式で明示管理操作を一回送信する。
       * @responsibility 現在改訂・受付ID・Action Tokenを保った実POSTを作る。
       * @trace RFD-IT-021
       * @trace EST-IT-010
       * @precondition 本番ModelからAction Tokenを取得済み。
       * @stimulus 操作固有fieldと現在改訂をURL Formへ渡す。
       * @observation HTTP結果と保存改訂。
       * @oracle 既知保存と入力拒否を固定共通結果で検査する。
       * @cleanup N/A: ServerとRootは親Caseが回収する。
       * @boundary UI Form相当→本番HTTP→保存Owner。
       */
      async function submitMutation(
        operation: string,
        fields: Record<string, string | readonly string[]>,
        overrides: Record<string, string> = {},
      ) {
        const revision = (
          JSON.parse(fs.readFileSync(current, "utf8")) as AccessManagementState
        ).revision;
        const body = new URLSearchParams({
          actionToken: model.actionToken,
          operation,
          operationId: randomUUID(),
          expectedRevision: String(revision),
        });
        for (const [key, value] of Object.entries(fields))
          for (const entry of typeof value === "string" ? [value] : value)
            body.append(key, entry);
        const response = await fetchWorkbench(
          `${handle.baseUrl}/access-management/action`,
          {
            method: "POST",
            body,
            headers: {
              "content-type": "application/x-www-form-urlencoded",
              origin: handle.baseUrl,
              ...overrides,
            },
          },
        );
        const value: unknown = await response.json();
        if (response.ok) return inspectManagementResult(value, "mutation");
        return { httpStatus: response.status };
      }

      const beforeInvalid = fs.readFileSync(current);
      const incomplete = await openIncompleteManagementBody(handle.baseUrl);
      const incompleteClosed = new Promise<void>((resolve) =>
        incomplete.once("close", resolve),
      );
      incomplete.destroy();
      await incompleteClosed;
      await delay(50);
      assert.deepEqual(fs.readFileSync(current), beforeInvalid);
      assert.deepEqual(
        await submitMutation(
          "registerUser",
          { username: "拒否", plannedRole: "developer" },
          { origin: "https://invalid.example" },
        ),
        { httpStatus: 400 },
      );
      assert.deepEqual(fs.readFileSync(current), beforeInvalid);
      for (const extra of [
        { actionToken: "invalid" },
        { unknownField: "not-accepted" },
        { username: "duplicate" },
      ]) {
        const invalidBody = new URLSearchParams({
          actionToken: model.actionToken,
          operation: "registerUser",
          operationId: randomUUID(),
          expectedRevision: String(
            (
              JSON.parse(
                fs.readFileSync(current, "utf8"),
              ) as AccessManagementState
            ).revision,
          ),
          username: "不正入力",
          plannedRole: "developer",
        });
        for (const [key, value] of Object.entries(extra))
          invalidBody.append(key, value);
        const invalidReply = await fetchWorkbench(
          `${handle.baseUrl}/access-management/action`,
          {
            method: "POST",
            body: invalidBody,
            headers: { origin: handle.baseUrl },
          },
        );
        assert.equal(invalidReply.status, 400);
        await invalidReply.arrayBuffer();
        assert.deepEqual(fs.readFileSync(current), beforeInvalid);
      }
      const registered = await submitMutation("registerUser", {
        username: "追加",
        plannedRole: "developer",
      });
      assert.ok(
        "status" in registered &&
          registered.status === "completed" &&
          "userId" in registered &&
          registered.userId,
      );
      const newUser = registered.userId;
      for (const [operation, fields] of [
        ["updateUserName", { userId: newUser, username: "改名" }],
        [
          "updateUserRole",
          { userId: newUser, currentRole: "developer", nextRole: "manager" },
        ],
        [
          "updateRoleContentAccess",
          { targetRole: "developer", workspaceIds: [] },
        ],
      ] as const) {
        const result = await submitMutation(operation, { ...fields });
        assert.ok("status" in result && result.status === "completed");
      }
      const registration = await submitMutation("registerRepository", {
        repositoryId: "repository.fixture",
        repositoryRoot: target,
      });
      assert.ok(
        "status" in registration && registration.status === "completed",
      );
      const beforeLocalProjection = fs.readFileSync(current);
      const contextBody = fs.readFileSync(
        path.join(target, "PROJECT_CONTEXT.md"),
      );
      try {
        const context = { root, token: material.token };
        const signal = new AbortController().signal;
        assert.equal(readAccessPortfolio(context, signal).projects.length, 0);
        assert.equal(
          resolveAccessRepository(context, "repository.fixture", signal),
          null,
        );
        assert.equal(
          resolveAccessRepository(context, "repository.absent", signal),
          null,
        );
        const projectionState = JSON.parse(
          beforeLocalProjection.toString("utf8"),
        ) as AccessManagementState;
        const administrator = projectionState.roleContentAccess.find(
          (entry) => entry.role === "administrator",
        );
        assert.ok(administrator);
        administrator.workspaceIds = ["development"];
        projectionState.exposure = [
          { repositoryId: "repository.fixture", workspaceIds: ["development"] },
        ];
        fs.writeFileSync(current, JSON.stringify(projectionState));
        const projected = readAccessPortfolio(context, signal);
        const records = resolveAccessTopicMeeting(
          context,
          "repository.fixture",
          signal,
        );
        assert.ok(records);
        assert.equal(records.topic.getDocument("TOPIC-000001"), null);
        const createdTopic = records.topic.create(
          "# 自己生成Topic\n\n成果物種別: Topic\nTopic ID: `TOPIC-000001`\nProject ID: `project.fixture`\n状態: `open`\n改訂: `1`\n維持責任者: `試験担当`\n\n## 1. 現在の論点\n\n### 結論\n\n現在許可対象への保存を確認する。\n",
        );
        assert.equal(createdTopic.status, "completed");
        assert.ok(records.topic.getDocument("TOPIC-000001"));
        if (mode === "cros") {
          for (const kind of ["topic", "meeting"] as const) {
            const id = kind === "topic" ? "TOPIC-000077" : "MTG-000077";
            const markdown = `# 保存試験\n\n成果物種別: ${kind === "topic" ? "Topic" : "Meeting"}\n${kind === "topic" ? "Topic" : "Meeting"} ID: \`${id}\`\nProject ID: \`project.fixture\`\n状態: \`${kind === "topic" ? "open" : "recorded"}\`\n${kind === "meeting" ? "開催日時: `2026-10-13 09:00 JST`\n" : ""}改訂: \`1\`\n維持責任者: \`試験担当\`\n\n## 1. 現在の論点\n\n### 結論\n\n指定先への保存だけを行う。\n`;
            const form = new URLSearchParams({
              actionToken: model.actionToken,
              repositoryId: "repository.fixture",
              kind,
              operation: "create",
              markdown:
                kind === "meeting"
                  ? markdown +
                    "\n## 4. Outcome\n\n| Local ID | 状態 |\n|---|---|\n"
                  : markdown,
            });
            const options = {
              method: "POST",
              headers: {
                origin: handle.baseUrl,
                "content-type": "application/x-www-form-urlencoded",
              },
              body: form,
            };
            const endpoint = `${handle.baseUrl}/topic-meeting/action`;
            for (const rejected of [
              new URLSearchParams([
                ...form,
                ["repositoryId", "repository.fixture"],
              ]),
              new URLSearchParams([...form, ["unknown", "value"]]),
              new URLSearchParams({
                ...Object.fromEntries(form),
                repositoryId: "repository.absent",
              }),
            ]) {
              const denied = await fetchWorkbench(endpoint, {
                ...options,
                body: rejected,
              });
              assert.equal(denied.status, 400);
              assert.equal(
                await denied.text(),
                "topic_meeting_action_rejected\n",
              );
              assert.equal(records[kind].getDocument(id), null);
            }
            const created = await fetchWorkbench(endpoint, options);
            assert.doesNotThrow(
              () => validateTopicMeetingActionForm(form),
              `record_form_${kind}`,
            );
            assert.equal(created.status, 200, `record_create_${kind}`);
            assert.equal((await created.json()).filesystemEffectCount, 1);
            const savedMarkdown = form.get("markdown") ?? "";
            assert.equal(
              records[kind].getDocument(id)?.markdown,
              savedMarkdown,
            );
            form.set("operation", "update");
            form.set("id", id);
            form.set("expectedRevision", "9");
            form.set(
              "markdown",
              savedMarkdown.replace("改訂: `1`", "改訂: `2`"),
            );
            const conflict = await fetchWorkbench(endpoint, options);
            assert.equal(conflict.status, 200);
            assert.equal(
              (await conflict.json()).reason,
              "record_revision_conflict",
            );
            assert.equal(
              records[kind].getDocument(id)?.markdown,
              savedMarkdown,
            );
            form.set("expectedRevision", "1");
            const updated = await fetchWorkbench(endpoint, options);
            assert.equal(updated.status, 200);
            assert.equal((await updated.json()).filesystemEffectCount, 1);
            assert.equal(
              records[kind].getDocument(id)?.markdown,
              form.get("markdown"),
            );
            form.set("operation", "delete");
            form.delete("markdown");
            form.set("expectedRevision", "2");
            const beforeDelete: string | undefined =
              records[kind].getDocument(id)?.markdown;
            for (const value of [null, "invalid"] as const) {
              const malformed = new URLSearchParams(form);
              if (value !== null) malformed.set("confirmed", value);
              const denied = await fetchWorkbench(endpoint, {
                ...options,
                body: malformed,
              });
              assert.equal(denied.status, 400);
              assert.equal(
                records[kind].getDocument(id)?.markdown,
                beforeDelete,
              );
            }
            form.set("confirmed", "false");
            const unconfirmed = await fetchWorkbench(endpoint, options);
            assert.equal(unconfirmed.status, 200);
            assert.equal(
              (await unconfirmed.json()).reason,
              "record_delete_confirmation_required",
            );
            assert.ok(records[kind].getDocument(id));
            form.set("confirmed", "true");
            const deleted = await fetchWorkbench(endpoint, options);
            assert.equal(deleted.status, 200);
            assert.equal((await deleted.json()).filesystemEffectCount, 1);
            assert.equal(records[kind].getDocument(id), null);
          }
          const outcomeForm = new URLSearchParams({
            actionToken: model.actionToken,
            repositoryId: "repository.fixture",
            kind: "meeting",
            operation: "treat-outcome",
            id: "MTG-000088",
            expectedRevision: "1",
            outcomeId: "OUT-001",
            disposition: "completed",
            owner: "試験担当",
            reviewTrigger: "試験終了",
            targetKind: "none",
            targetReference: "",
            treatment: "処置済み",
            completionCondition: "確認済み",
            result: "確認済み",
            closeMeeting: "false",
          });
          const beforeInvalid = fs.readFileSync(current);
          let domainReads = 0;
          const originalRecordRead = fs.readFileSync;
          const observation = t.mock.method(
            fs,
            "readFileSync",
            (...args: Parameters<typeof fs.readFileSync>) => {
              if (
                ["22_Topics", "23_Meetings"].some((folder) =>
                  String(args[0]).startsWith(
                    path.join(target, folder) + path.sep,
                  ),
                )
              )
                domainReads += 1;
              return originalRecordRead(...args);
            },
          );
          syncBuiltinESMExports();
          try {
            for (const field of [
              "closeMeeting",
              "disposition",
              "targetKind",
              "outcomeId",
              "owner",
            ] as const) {
              for (const missing of [true, false]) {
                if (!missing && field === "owner") continue;
                const invalid = new URLSearchParams(outcomeForm);
                if (missing) invalid.delete(field);
                else invalid.set(field, "invalid");
                const response = await fetchWorkbench(
                  `${handle.baseUrl}/topic-meeting/action`,
                  {
                    method: "POST",
                    headers: {
                      origin: handle.baseUrl,
                      "content-type": "application/x-www-form-urlencoded",
                    },
                    body: invalid,
                  },
                );
                assert.equal(
                  response.status,
                  400,
                  `invalid_outcome_${field}_${missing}`,
                );
                assert.equal(
                  await response.text(),
                  "topic_meeting_action_rejected\n",
                );
                assert.equal(domainReads, 0);
                assert.deepEqual(fs.readFileSync(current), beforeInvalid);
              }
            }
            assert.ok(records.topic.getDocument("TOPIC-000001"));
            assert.ok(
              domainReads > 0,
              "record_read_observation_positive_control",
            );
          } finally {
            observation.mock.restore();
            syncBuiltinESMExports();
          }
          const savedBeforeFailure = fs.readFileSync(current);
          for (const [index, failure] of [
            "exposure",
            "credential",
            "throw",
            "cancel",
            "normal",
          ].entries()) {
            const id = `TOPIC-${String(88 + index).padStart(6, "0")}`;
            const markdown = `# 保存後反例\n\n成果物種別: Topic\nTopic ID: \`${id}\`\nProject ID: \`project.fixture\`\n状態: \`open\`\n改訂: \`1\`\n維持責任者: \`試験担当\`\n\n## 1. 現在の論点\n\n### 結論\n\n保存後の失敗を未保存へ畳まない。\n`;
            const targetFile = path.join(target, "22_Topics", id, "topic.md");
            const form = new URLSearchParams({
              actionToken: model.actionToken,
              repositoryId: "repository.fixture",
              kind: "topic",
              operation: "create",
              markdown,
            });
            const client: { request: ClientRequest | null } = { request: null };
            let writes = 0;
            let successBodies = 0;
            let serverClosed = false;
            let observeClose: (() => void) | undefined;
            const closed = new Promise<void>((resolve) => {
              observeClose = resolve;
            });
            const originalAssign = ServerResponse.prototype.assignSocket;
            const assigned = t.mock.method(
              ServerResponse.prototype,
              "assignSocket",
              function (
                this: ServerResponse,
                socket: Parameters<typeof originalAssign>[0],
              ) {
                if (
                  this.req.method === "POST" &&
                  this.req.url === "/topic-meeting/action"
                )
                  this.once("close", () => {
                    serverClosed = true;
                    observeClose?.();
                  });
                return originalAssign.call(this, socket);
              },
            );
            const originalEnd = ServerResponse.prototype.end;
            const publication = t.mock.method(
              ServerResponse.prototype,
              "end",
              function (
                this: ServerResponse,
                ...args: Parameters<typeof originalEnd>
              ) {
                const url = new URL(this.req.url ?? "/", "http://127.0.0.1");
                if (
                  this.req.method === "POST" &&
                  `${url.pathname}${url.search}` === "/topic-meeting/action" &&
                  this.statusCode === 200 &&
                  args[0] !== undefined
                )
                  successBodies += 1;
                return originalEnd.apply(this, args);
              },
            );
            const originalRename = fs.renameSync;
            const injected = t.mock.method(
              fs,
              "renameSync",
              (...args: Parameters<typeof fs.renameSync>) => {
                originalRename(...args);
                if (String(args[1]) !== targetFile) return;
                writes += 1;
                if (failure === "normal") return;
                if (failure === "throw")
                  throw new Error("fixture_after_record_publication");
                if (failure === "cancel") {
                  client.request?.destroy();
                  return;
                }
                const state = JSON.parse(
                  savedBeforeFailure.toString("utf8"),
                ) as AccessManagementState;
                state.revision += 1;
                if (failure === "exposure") state.exposure = [];
                else {
                  const credential = state.credentials[0];
                  assert.ok(credential);
                  credential.revoked = true;
                }
                fs.writeFileSync(current, JSON.stringify(state));
              },
            );
            syncBuiltinESMExports();
            try {
              if (failure === "cancel") {
                await new Promise<void>((resolve, reject) => {
                  const data = form.toString();
                  const outgoing = httpRequest(
                    `${handle.baseUrl}/topic-meeting/action`,
                    {
                      method: "POST",
                      agent: false,
                      headers: {
                        authorization: `Bearer ${material.token}`,
                        origin: handle.baseUrl,
                        "content-type": "application/x-www-form-urlencoded",
                        "content-length": Buffer.byteLength(data),
                      },
                    },
                  );
                  client.request = outgoing;
                  outgoing.once("error", () => resolve());
                  outgoing.once("response", (reply) => {
                    reply.resume();
                    reply.once("end", () =>
                      reject(new Error("cancelled_record_success_unexpected")),
                    );
                  });
                  outgoing.end(data);
                });
              } else {
                const reply = await fetchWorkbench(
                  `${handle.baseUrl}/topic-meeting/action`,
                  {
                    method: "POST",
                    headers: {
                      origin: handle.baseUrl,
                      "content-type": "application/x-www-form-urlencoded",
                    },
                    body: form,
                  },
                );
                if (failure === "normal") {
                  assert.equal(reply.status, 200);
                  assert.equal((await reply.json()).filesystemEffectCount, 1);
                } else {
                  assert.equal(reply.status, 503, failure);
                  assert.equal(
                    await reply.text(),
                    "topic_meeting_action_outcome_unconfirmed\n",
                  );
                }
              }
              let deadline: ReturnType<typeof setTimeout> | undefined;
              try {
                await Promise.race([
                  closed,
                  new Promise<never>((_, reject) => {
                    deadline = setTimeout(
                      () =>
                        reject(new Error("record_server_close_unconfirmed")),
                      5000,
                    );
                  }),
                ]);
              } finally {
                if (deadline !== undefined) clearTimeout(deadline);
              }
              assert.equal(serverClosed, true, failure);
              assert.equal(
                successBodies,
                failure === "normal" ? 1 : 0,
                failure,
              );
              assert.equal(writes, 1, failure);
              assert.equal(fs.readFileSync(targetFile, "utf8"), markdown);
              fs.writeFileSync(current, savedBeforeFailure);
              const beforeFresh = fs.readFileSync(targetFile);
              const fresh = await fetchWorkbench(
                `${handle.baseUrl}/api/workbench-view?repositoryId=repository.fixture`,
              );
              assert.equal(fresh.status, 200);
              await fresh.arrayBuffer();
              assert.deepEqual(fs.readFileSync(targetFile), beforeFresh);
              assert.equal(writes, 1, "fresh_record_read_does_not_retry");
              assert.equal(
                successBodies,
                failure === "normal" ? 1 : 0,
                "late_record_success_body_absent",
              );
            } finally {
              injected.mock.restore();
              assigned.mock.restore();
              publication.mock.restore();
              syncBuiltinESMExports();
              fs.writeFileSync(current, savedBeforeFailure);
            }
          }
          const promotionMarkdown =
            "# 昇格試験\n\n成果物種別: Topic\nTopic ID: `TOPIC-000099`\nProject ID: `project.fixture`\n状態: `open`\n改訂: `1`\n維持責任者: `試験担当`\n\n## 1. 現在の論点\n\n### 結論\n\n昇格を確認する。\n\n## 3. 関係\n\n| 関係種別 | 対象ID／参照 | このTopicとの関係 |\n|---|---|---|\n\n## 5. 終了・昇格\n\n| 項目 | 内容 |\n|---|---|\n| 処置 | N/A: 未処置 |\n| 昇格先 | N/A: 未昇格 |\n| 終了理由 | N/A: 未終了 |\n| 残る影響 | N/A: 未終了 |\n";
          assert.equal(
            records.topic.create(promotionMarkdown).status,
            "completed",
          );
          const promote = new URLSearchParams({
            actionToken: model.actionToken,
            repositoryId: "repository.fixture",
            kind: "topic",
            operation: "promote-topic",
            id: "TOPIC-000099",
            expectedRevision: "1",
            changeId: "CHG-000099",
            reason: "具体変更として扱う",
            remainingResponsibility: "CHG終了時に再確認",
          });
          const actionHeaders = {
            origin: handle.baseUrl,
            "content-type": "application/x-www-form-urlencoded",
          };
          const missingChange = await fetchWorkbench(
            `${handle.baseUrl}/topic-meeting/action`,
            { method: "POST", headers: actionHeaders, body: promote },
          );
          assert.equal(missingChange.status, 200);
          assert.equal(
            (await missingChange.json()).reason,
            "topic_promotion_target_not_found",
          );
          assert.equal(
            records.topic.getDocument("TOPIC-000099")?.markdown,
            promotionMarkdown,
          );
          const changeDirectory = path.join(
            target,
            "99_Roadmap",
            "Changes",
            "CHG-000099",
          );
          fs.mkdirSync(changeDirectory, { recursive: true });
          fs.writeFileSync(
            path.join(changeDirectory, "change.md"),
            "# 自己生成変更\n",
          );
          const promoted = await fetchWorkbench(
            `${handle.baseUrl}/topic-meeting/action`,
            { method: "POST", headers: actionHeaders, body: promote },
          );
          assert.equal(promoted.status, 200);
          assert.equal((await promoted.json()).filesystemEffectCount, 1);
          assert.equal(
            records.topic.getDocument("TOPIC-000099")?.record.state,
            "promoted",
          );
          const promotionConflict = await fetchWorkbench(
            `${handle.baseUrl}/topic-meeting/action`,
            { method: "POST", headers: actionHeaders, body: promote },
          );
          assert.equal(promotionConflict.status, 200);
          assert.equal(
            (await promotionConflict.json()).reason,
            "record_revision_conflict",
          );
          const meetingMarkdown =
            "# Outcome試験\n\n成果物種別: Meeting\nMeeting ID: `MTG-000099`\nProject ID: `project.fixture`\n状態: `recorded`\n開催日時: `2026-10-13 09:00 JST`\n改訂: `1`\n維持責任者: `試験担当`\n\n## 1. 目的と要約\n\n### 結論\n\n二件のOutcomeを処置する。\n\n## 4. Outcome\n\n| Local ID | 種別 | 内容 | 状態 | Owner | 期限／再評価契機 | 追跡先 |\n|---|---|---|---|---|---|---|\n| `OUT-001` | Action | 一件目 | `pending` | 試験担当 | 次回 | N/A: 未移管 |\n| `OUT-002` | Action | 二件目 | `pending` | 試験担当 | 次回 | N/A: 未移管 |\n\n## 5. Actionと移管\n\n| Outcome | 処置 | 追跡先 | 完了条件 | 結果 |\n|---|---|---|---|---|\n| `OUT-001` | | | | |\n| `OUT-002` | | | | |\n\n## 6. Close・訂正\n\n| 項目 | 内容 |\n|---|---|\n| Close判定 | OPEN: 未処置 |\n| 未処置Outcome | OUT-001、OUT-002 |\n| 訂正元／訂正先 | N/A: 訂正ではない |\n| 残る影響 | 未処置 |\n";
          assert.equal(
            records.meeting.create(meetingMarkdown).status,
            "completed",
          );
          const treatment = new URLSearchParams(outcomeForm);
          treatment.set("id", "MTG-000099");
          treatment.set("targetReference", "N/A: 自己完結");
          treatment.set("closeMeeting", "true");
          const pendingClose = await fetchWorkbench(
            `${handle.baseUrl}/topic-meeting/action`,
            { method: "POST", headers: actionHeaders, body: treatment },
          );
          assert.equal(pendingClose.status, 200);
          assert.equal(
            (await pendingClose.json()).reason,
            "meeting_outcome_invalid",
          );
          assert.equal(
            records.meeting.getDocument("MTG-000099")?.markdown,
            meetingMarkdown,
          );
          treatment.set("closeMeeting", "false");
          const firstOutcome = await fetchWorkbench(
            `${handle.baseUrl}/topic-meeting/action`,
            { method: "POST", headers: actionHeaders, body: treatment },
          );
          assert.equal(firstOutcome.status, 200);
          assert.equal((await firstOutcome.json()).filesystemEffectCount, 1);
          assert.equal(
            records.meeting.getDocument("MTG-000099")?.record.state,
            "recorded",
          );
          treatment.set("expectedRevision", "2");
          treatment.set("outcomeId", "OUT-002");
          treatment.set("closeMeeting", "true");
          const closedMeeting = await fetchWorkbench(
            `${handle.baseUrl}/topic-meeting/action`,
            { method: "POST", headers: actionHeaders, body: treatment },
          );
          assert.equal(closedMeeting.status, 200);
          assert.equal(
            (await closedMeeting.json()).reason,
            "meeting_outcome_treated",
          );
          assert.equal(
            records.meeting.getDocument("MTG-000099")?.record.state,
            "closed",
          );
          const reply = await fetchWorkbench(
            `${handle.baseUrl}/api/workbench-view?repositoryId=repository.fixture`,
          );
          assert.equal(reply.status, 200);
          const body = await reply.text();
          const selectedModel = inspectWorkbenchClientModel(JSON.parse(body));
          assert.ok(selectedModel.view === "main");
          assert.equal(
            selectedModel.selectedRepositoryId,
            "repository.fixture",
          );
          assert.equal(
            selectedModel.surface.context.repositoryId,
            "repository.fixture",
          );
          assert.equal(
            selectedModel.surface.context.projectId,
            "project.fixture",
          );
          assert.equal(
            selectedModel.aiSelection?.selection.status,
            "available",
          );
          assert.equal(selectedModel.runtimeActivity?.state, "unknown");
          assert.equal(selectedModel.aiRequest.configured, false);
          assert.equal("candidateConfigured" in selectedModel.aiRequest, false);
          assert.equal(selectedModel.repositoryResult, null);
          assert.equal(selectedModel.topicMeetingResult, null);
          assert.ok(selectedModel.aiSelectionManagement.snapshot);
          assert.equal(selectedModel.aiSelectionManagement.allowed, true);
          for (const secret of [material.token, root.root, target, "bindingId"])
            assert.equal(body.includes(secret), false);
          for (const invalidProfile of [{}, undefined]) {
            const invalid = structuredClone(selectedModel);
            Object.defineProperty(invalid, "aiSelection", {
              value: invalidProfile,
              enumerable: true,
            });
            assert.throws(
              () => inspectWorkbenchClientModel(invalid),
              /workbench_client_model_invalid/u,
            );
          }
          const detail = await fetchWorkbench(
            `${handle.baseUrl}/api/workbench-view?repositoryId=repository.fixture&route=%2Ftopic&id=TOPIC-000001`,
          );
          const documentModel = inspectWorkbenchClientModel(
            await detail.json(),
          );
          assert.ok(documentModel.view === "record-detail");
          assert.equal(documentModel.record.id, "TOPIC-000001");
          assert.equal(documentModel.repositoryId, "repository.fixture");
          const absent = await fetchWorkbench(
            `${handle.baseUrl}/api/workbench-view?repositoryId=repository.absent`,
          );
          assert.equal(absent.status, 403);
          assert.equal(
            await absent.text(),
            "local_repository_access_unavailable\n",
          );
          const anonymous = await fetch(
            `${handle.baseUrl}/api/workbench-view?repositoryId=repository.fixture`,
          );
          assert.equal(anonymous.status, 403);
          const portal = inspectWorkbenchClientModel(
            await (
              await fetchWorkbench(
                `${handle.baseUrl}/api/workbench-view?repositoryId=`,
              )
            ).json(),
          );
          assert.equal(portal.view, "access");
          const sibling = path.join(owned, "sibling");
          fs.mkdirSync(path.join(sibling, ".crdd", "config"), {
            recursive: true,
          });
          assert.equal(
            spawnSync("git", ["init", "--quiet", sibling], {
              windowsHide: true,
            }).status,
            0,
          );
          const manifestPath = path.join(
            target,
            ".crdd",
            "config",
            "repository-manifest.json",
          );
          const originalManifest = fs.readFileSync(manifestPath, "utf8");
          const siblingManifest = {
            ...JSON.parse(originalManifest),
            repositoryId: "repository.sibling",
          };
          fs.writeFileSync(
            path.join(sibling, ".crdd", "config", "repository-manifest.json"),
            JSON.stringify(siblingManifest),
          );
          fs.writeFileSync(
            path.join(sibling, "PROJECT_CONTEXT.md"),
            contextBody
              .toString("utf8")
              .replaceAll("repository.fixture", "repository.sibling"),
          );
          const replacement = path.join(owned, "replacement");
          fs.mkdirSync(path.join(replacement, ".crdd", "config"), {
            recursive: true,
          });
          assert.equal(
            spawnSync("git", ["init", "--quiet", replacement], {
              windowsHide: true,
            }).status,
            0,
          );
          fs.writeFileSync(
            path.join(
              replacement,
              ".crdd",
              "config",
              "repository-manifest.json",
            ),
            originalManifest,
          );
          fs.writeFileSync(
            path.join(replacement, "PROJECT_CONTEXT.md"),
            contextBody,
          );
          const scoped = structuredClone(projectionState);
          scoped.registeredRepositories.push({
            repositoryId: "repository.sibling",
            repositoryRoot: sibling,
            bindingId: deriveRepositoryBindingId("repository.sibling", sibling),
          });
          scoped.exposure.push({
            repositoryId: "repository.sibling",
            workspaceIds: ["development"],
          });
          const foreign = path.join(owned, "foreign");
          fs.mkdirSync(path.join(foreign, ".crdd", "config"), {
            recursive: true,
          });
          assert.equal(
            spawnSync("git", ["init", "--quiet", foreign], {
              windowsHide: true,
            }).status,
            0,
          );
          fs.writeFileSync(
            path.join(foreign, ".crdd", "config", "repository-manifest.json"),
            JSON.stringify({
              ...JSON.parse(originalManifest),
              projectId: "project.other",
              repositoryId: "repository.foreign",
            }),
          );
          fs.writeFileSync(
            path.join(foreign, "PROJECT_CONTEXT.md"),
            contextBody
              .toString("utf8")
              .replaceAll("project.fixture", "project.other")
              .replaceAll("repository.fixture", "repository.foreign"),
          );
          scoped.registeredRepositories.push({
            repositoryId: "repository.foreign",
            repositoryRoot: foreign,
            bindingId: deriveRepositoryBindingId("repository.foreign", foreign),
          });
          scoped.exposure.push({
            repositoryId: "repository.foreign",
            workspaceIds: ["development"],
          });
          for (const directory of [target, sibling, foreign]) {
            assert.equal(
              spawnSync(
                "git",
                [
                  "-C",
                  directory,
                  "-c",
                  "user.name=Fixture",
                  "-c",
                  "user.email=fixture@example.invalid",
                  "commit",
                  "--allow-empty",
                  "--quiet",
                  "-m",
                  "fixture",
                ],
                { windowsHide: true },
              ).status,
              0,
            );
          }
          for (let index = 0; index < 25; index++)
            recordFixtureActivity(
              index % 2 === 0 ? target : sibling,
              "project.fixture",
              `task.fixture-${index}`,
            );
          recordFixtureActivity(foreign, "project.other", "task.foreign");
          fs.writeFileSync(current, JSON.stringify(scoped));
          const siblingState = fs.readFileSync(current);
          const siblingRecordFile = path.join(
            target,
            "22_Topics",
            "TOPIC-000100",
            "topic.md",
          );
          const siblingMarkdown =
            "# Sibling公開変更\n\n成果物種別: Topic\nTopic ID: `TOPIC-000100`\nProject ID: `project.fixture`\n状態: `open`\n改訂: `1`\n維持責任者: `試験担当`\n\n## 1. 現在の論点\n\n### 結論\n\n同Project集合を再確認する。\n";
          let siblingWrites = 0;
          const originalSiblingRename = fs.renameSync;
          const siblingPublication = t.mock.method(
            fs,
            "renameSync",
            (...args: Parameters<typeof fs.renameSync>) => {
              originalSiblingRename(...args);
              if (String(args[1]) !== siblingRecordFile) return;
              siblingWrites += 1;
              const removed = structuredClone(scoped);
              removed.revision += 1;
              removed.exposure = removed.exposure.filter(
                (entry) => entry.repositoryId !== "repository.sibling",
              );
              fs.writeFileSync(current, JSON.stringify(removed));
            },
          );
          syncBuiltinESMExports();
          try {
            const reply = await fetchWorkbench(
              `${handle.baseUrl}/topic-meeting/action`,
              {
                method: "POST",
                headers: actionHeaders,
                body: new URLSearchParams({
                  actionToken: model.actionToken,
                  repositoryId: "repository.fixture",
                  kind: "topic",
                  operation: "create",
                  markdown: siblingMarkdown,
                }),
              },
            );
            assert.equal(reply.status, 503);
            assert.equal(
              await reply.text(),
              "topic_meeting_action_outcome_unconfirmed\n",
            );
            assert.equal(siblingWrites, 1);
            assert.equal(
              fs.readFileSync(siblingRecordFile, "utf8"),
              siblingMarkdown,
            );
            fs.writeFileSync(current, siblingState);
            const fresh = await fetchWorkbench(
              `${handle.baseUrl}/api/workbench-view?repositoryId=repository.fixture`,
            );
            assert.equal(fresh.status, 200);
            await fresh.arrayBuffer();
            assert.equal(siblingWrites, 1);
            assert.equal(
              fs.readFileSync(siblingRecordFile, "utf8"),
              siblingMarkdown,
            );
          } finally {
            siblingPublication.mock.restore();
            syncBuiltinESMExports();
            fs.writeFileSync(current, siblingState);
          }
          const activityReply = await fetchWorkbench(
            `${handle.baseUrl}/api/workbench-view?repositoryId=repository.fixture`,
          );
          const activityModel = inspectWorkbenchClientModel(
            await activityReply.json(),
          );
          assert.ok(activityModel.view === "main");
          assert.equal(activityModel.runtimeActivity?.state, "absent");
          assert.equal(activityModel.runtimeActivity?.eventState, "observed");
          assert.equal(activityModel.runtimeActivity?.events.length, 20);
          assert.equal(
            activityModel.runtimeActivity?.events.some(
              (entry) => entry.taskId === "task.foreign",
            ),
            false,
          );
          assert.ok(
            activityModel.runtimeActivity?.events.some(
              (entry) => Number(entry.taskId.split("-").at(-1)) % 2 === 0,
            ),
          );
          assert.ok(
            activityModel.runtimeActivity?.events.some(
              (entry) => Number(entry.taskId.split("-").at(-1)) % 2 === 1,
            ),
          );
          const cursor = activityModel.runtimeActivity?.eventContinuation;
          assert.ok(cursor);
          const continuation = inspectWorkbenchClientModel(
            await (
              await fetchWorkbench(
                `${handle.baseUrl}/api/workbench-view?repositoryId=repository.fixture&runtimeCursor=${encodeURIComponent(cursor)}`,
              )
            ).json(),
          );
          assert.ok(continuation.view === "main");
          assert.equal(continuation.runtimeActivity?.events.length, 5);
          assert.equal(continuation.runtimeActivity?.eventContinuation, null);
          assert.deepEqual(
            [
              ...new Set(
                [
                  ...(activityModel.runtimeActivity?.events ?? []),
                  ...(continuation.runtimeActivity?.events ?? []),
                ].map((entry) => entry.taskId),
              ),
            ].sort(),
            Array.from(
              { length: 25 },
              (_, index) => `task.fixture-${index}`,
            ).sort(),
          );
          const invalidCursor = inspectWorkbenchClientModel(
            await (
              await fetchWorkbench(
                `${handle.baseUrl}/api/workbench-view?repositoryId=repository.fixture&runtimeCursor=invalid`,
              )
            ).json(),
          );
          assert.ok(invalidCursor.view === "main");
          assert.equal(invalidCursor.runtimeActivity?.state, "unknown");
          assert.equal(invalidCursor.runtimeActivity?.events.length, 0);
          assert.equal(invalidCursor.runtimeActivity?.eventContinuation, null);
          const historyPath = path.join(
            sibling,
            ".crdd",
            "execution-intelligence",
            "history.jsonl",
          );
          const savedHistory = fs.readFileSync(historyPath);
          try {
            fs.writeFileSync(historyPath, "invalid-history\n");
            const unknown = inspectWorkbenchClientModel(
              await (
                await fetchWorkbench(
                  `${handle.baseUrl}/api/workbench-view?repositoryId=repository.fixture`,
                )
              ).json(),
            );
            assert.ok(unknown.view === "main");
            assert.equal(unknown.runtimeActivity?.state, "absent");
            assert.equal(unknown.runtimeActivity?.eventState, "unknown");
            assert.equal(unknown.runtimeActivity?.events.length, 0);
          } finally {
            fs.writeFileSync(historyPath, savedHistory);
          }
          for (const cancelStage of ["before", "during"] as const) {
            const client: { request: ClientRequest | null } = { request: null };
            const reads: string[] = [];
            let successBodies = 0;
            let cancelled = false;
            const originalClose = fs.closeSync;
            const originalOpen = fs.openSync;
            const historyHandles = new Map<number, string>();
            const originalAsyncRead = fs.promises.readFile;
            const originalEnd = ServerResponse.prototype.end;
            const selectedUrl =
              "/api/workbench-view?repositoryId=repository.fixture";
            const opened = t.mock.method(
              fs,
              "openSync",
              (...args: Parameters<typeof fs.openSync>) => {
                const name = String(args[0]);
                const isHistory = [target, sibling].some(
                  (directory) =>
                    name ===
                    path.join(
                      directory,
                      ".crdd",
                      "execution-intelligence",
                      "history.jsonl",
                    ),
                );
                const descriptor = originalOpen(...args);
                if (isHistory) {
                  historyHandles.set(descriptor, name);
                  if (cancelStage === "during" && !cancelled) {
                    cancelled = true;
                    client.request?.destroy();
                  }
                }
                return descriptor;
              },
            );
            const scan = t.mock.method(
              fs,
              "closeSync",
              (...args: Parameters<typeof fs.closeSync>) => {
                const name = historyHandles.get(args[0]);
                originalClose(...args);
                if (name !== undefined) {
                  reads.push(name);
                  historyHandles.delete(args[0]);
                }
              },
            );
            const early = t.mock.method(
              fs.promises,
              "readFile",
              async (...args: Parameters<typeof fs.promises.readFile>) => {
                const body = await originalAsyncRead(...args);
                if (
                  cancelStage === "before" &&
                  !cancelled &&
                  String(args[0]) === path.join(target, "PROJECT_CONTEXT.md")
                ) {
                  cancelled = true;
                  client.request?.destroy();
                }
                return body;
              },
            );
            const publication = t.mock.method(
              ServerResponse.prototype,
              "end",
              function (
                this: ServerResponse,
                ...args: Parameters<ServerResponse["end"]>
              ) {
                const url = new URL(this.req.url ?? "/", "http://127.0.0.1");
                if (
                  `${url.pathname}${url.search}` === selectedUrl &&
                  this.statusCode === 200 &&
                  args[0] !== undefined
                )
                  successBodies += 1;
                return originalEnd.apply(this, args);
              },
            );
            syncBuiltinESMExports();
            try {
              await new Promise<void>((resolve) => {
                client.request = httpRequest(
                  `${handle.baseUrl}${selectedUrl}`,
                  {
                    agent: false,
                    headers: { authorization: `Bearer ${material.token}` },
                  },
                );
                client.request.on("error", () => {});
                client.request.once("close", resolve);
                client.request.setTimeout(5000, () =>
                  client.request?.destroy(),
                );
                client.request.end();
              });
              await delay(100);
              assert.equal(cancelled, true, cancelStage);
              assert.equal(client.request?.destroyed, true);
              assert.equal(
                successBodies,
                0,
                "cancelled_activity_success_body_zero",
              );
              assert.equal(reads.length, cancelStage === "before" ? 0 : 2);
              assert.equal(
                new Set(reads).size,
                reads.length,
                "activity_no_repeat",
              );
              assert.equal(
                reads.filter((name) => name === historyPath).length,
                cancelStage === "before" ? 0 : 1,
                "started_reader_joins_sibling",
              );
            } finally {
              client.request?.destroy();
              scan.mock.restore();
              opened.mock.restore();
              early.mock.restore();
              publication.mock.restore();
              syncBuiltinESMExports();
            }
            const next = inspectWorkbenchClientModel(
              await new Promise<unknown>((resolve, reject) => {
                const request = httpRequest(
                  `${handle.baseUrl}${selectedUrl}`,
                  {
                    agent: false,
                    headers: { authorization: `Bearer ${material.token}` },
                  },
                  (response) => {
                    const chunks: Buffer[] = [];
                    response.on("data", (chunk: Buffer) => chunks.push(chunk));
                    response.once("error", reject);
                    response.once("end", () => {
                      try {
                        assert.equal(
                          response.statusCode,
                          200,
                          `activity_next_after_${cancelStage}`,
                        );
                        resolve(
                          JSON.parse(Buffer.concat(chunks).toString("utf8")),
                        );
                      } catch (error) {
                        reject(error);
                      }
                    });
                  },
                );
                request.once("error", reject);
                request.setTimeout(5000, () =>
                  request.destroy(
                    new Error(`activity_next_after_${cancelStage}_timeout`),
                  ),
                );
                request.end();
              }),
            );
            assert.ok(next.view === "main");
            assert.equal(next.runtimeActivity?.eventState, "observed");
            assert.equal(next.runtimeActivity?.events.length, 20);
          }
          for (const directory of [target, sibling, foreign])
            assert.equal(
              fs.existsSync(path.join(directory, ".crdd", "orchestrator")),
              false,
              "activity_reader_no_initialization",
            );
          try {
            for (const scenario of [
              "selected-exposure",
              "credential",
              "sibling-exposure",
              "binding",
              "manifest",
              "reorder",
            ] as const) {
              fs.writeFileSync(current, JSON.stringify(scoped));
              let changed = false;
              const originalRead = fs.promises.readFile;
              const observation = t.mock.method(
                fs.promises,
                "readFile",
                async (...args: Parameters<typeof fs.promises.readFile>) => {
                  const body = await originalRead(...args);
                  if (
                    !changed &&
                    String(args[0]) === path.join(target, "PROJECT_CONTEXT.md")
                  ) {
                    changed = true;
                    const next = structuredClone(scoped);
                    if (scenario === "manifest")
                      fs.writeFileSync(
                        manifestPath,
                        JSON.stringify({
                          ...JSON.parse(originalManifest),
                          displayName: "変更後",
                        }),
                      );
                    else {
                      if (scenario !== "reorder") next.revision++;
                      if (scenario === "reorder") {
                        next.registeredRepositories.reverse();
                        next.exposure.reverse();
                      }
                      if (scenario === "credential") {
                        const credential = next.credentials[0];
                        assert.ok(credential);
                        credential.revoked = true;
                      }
                      if (scenario === "selected-exposure")
                        next.exposure = next.exposure.filter(
                          (entry) =>
                            entry.repositoryId !== "repository.fixture",
                        );
                      if (scenario === "sibling-exposure")
                        next.exposure = next.exposure.filter(
                          (entry) =>
                            entry.repositoryId !== "repository.sibling",
                        );
                      if (scenario === "binding") {
                        const registration = next.registeredRepositories.find(
                          (entry) =>
                            entry.repositoryId === "repository.fixture",
                        );
                        assert.ok(registration);
                        registration.repositoryRoot = replacement;
                        registration.bindingId = deriveRepositoryBindingId(
                          "repository.fixture",
                          replacement,
                        );
                      }
                      fs.writeFileSync(current, JSON.stringify(next));
                    }
                  }
                  return body;
                },
              );
              syncBuiltinESMExports();
              try {
                const stale = await fetchWorkbench(
                  `${handle.baseUrl}/api/workbench-view?repositoryId=repository.fixture`,
                );
                assert.equal(changed, true, scenario);
                if (scenario === "reorder") {
                  assert.equal(stale.status, 200);
                  const reordered = inspectWorkbenchClientModel(
                    await stale.json(),
                  );
                  assert.ok(reordered.view === "main");
                  assert.equal(
                    reordered.surface.context.repositoryId,
                    "repository.fixture",
                  );
                } else {
                  assert.equal(stale.status, 403, scenario);
                  assert.equal(
                    await stale.text(),
                    "local_repository_access_unavailable\n",
                    scenario,
                  );
                }
              } finally {
                observation.mock.restore();
                syncBuiltinESMExports();
                fs.writeFileSync(manifestPath, originalManifest);
              }
            }
          } finally {
            fs.writeFileSync(current, JSON.stringify(projectionState));
          }
          let reads = 0,
            opens = 0;
          const originalSyncRead = fs.readFileSync;
          const readObservation = t.mock.method(
            fs,
            "readFileSync",
            (...args: Parameters<typeof fs.readFileSync>) => {
              reads++;
              return originalSyncRead(...args);
            },
          );
          const originalOpen = fs.openSync;
          const openObservation = t.mock.method(
            fs,
            "openSync",
            (...args: Parameters<typeof fs.openSync>) => {
              opens++;
              return originalOpen(...args);
            },
          );
          syncBuiltinESMExports();
          try {
            for (const selection of [
              "repository.fixture&repositoryId=repository.absent",
              "repository.absent&repositoryId=repository.fixture",
              "repository.fixture&repositoryId=repository.fixture",
            ]) {
              reads = 0;
              opens = 0;
              const duplicate = await fetchWorkbench(
                `${handle.baseUrl}/api/workbench-view?repositoryId=${selection}`,
              );
              assert.equal(duplicate.status, 403);
              assert.equal(
                await duplicate.text(),
                "local_repository_access_unavailable\n",
              );
              assert.equal(reads, 0);
              assert.equal(opens, 0);
            }
            await fetchWorkbench(
              `${handle.baseUrl}/api/workbench-view?repositoryId=repository.fixture`,
            );
            assert.ok(reads > 0, "valid_request_read_counter_positive");
            assert.ok(opens > 0, "valid_request_open_counter_positive");
          } finally {
            readObservation.mock.restore();
            openObservation.mock.restore();
            syncBuiltinESMExports();
          }
        }
        assert.equal(
          resolveAccessTopicMeeting(context, "repository.absent", signal),
          null,
        );
        assert.equal(
          resolveAccessRepository(context, "repository.fixture", signal)
            ?.repositoryId,
          "repository.fixture",
        );
        assert.equal(
          resolveAccessRepository(context, "repository.absent", signal),
          null,
        );
        assert.equal(resolveAccessRepository(context, "", signal), null);
        assert.equal(projected.projects.length, 1);
        assert.equal(projected.projects[0]?.projectId, "project.fixture");
        assert.equal(
          projected.projects[0]?.sources[0]?.repositoryId,
          "repository.fixture",
        );
        assert.equal(JSON.stringify(projected).includes(material.token), false);
        assert.equal(JSON.stringify(projected).includes(root.root), false);
        fs.writeFileSync(
          path.join(target, "PROJECT_CONTEXT.md"),
          "synthetic-invalid-context",
        );
        const incomplete = readAccessPortfolio(context, signal);
        assert.equal(incomplete.projects[0]?.state, "partial");
        assert.deepEqual(incomplete.projects[0]?.sources[0], {
          repositoryId: "repository.fixture",
          state: "unavailable",
          revision: null,
          repositoryRole: null,
          context: null,
        });
        fs.writeFileSync(path.join(target, "PROJECT_CONTEXT.md"), contextBody);
        projectionState.exposure = [];
        fs.writeFileSync(current, JSON.stringify(projectionState));
        if (mode === "cros") {
          const withdrawn = await fetchWorkbench(
            `${handle.baseUrl}/api/workbench-view?repositoryId=repository.fixture`,
          );
          assert.equal(withdrawn.status, 403);
          assert.equal(
            await withdrawn.text(),
            "local_repository_access_unavailable\n",
          );
        }
        assert.equal(readAccessPortfolio(context, signal).projects.length, 0);
        assert.equal(
          resolveAccessTopicMeeting(context, "repository.fixture", signal),
          null,
        );
        assert.equal(
          resolveAccessRepository(context, "repository.fixture", signal),
          null,
        );
        const credential = projectionState.credentials[0];
        assert.ok(credential);
        credential.revoked = true;
        fs.writeFileSync(current, JSON.stringify(projectionState));
        assert.throws(() => readAccessPortfolio(context, signal));
        assert.throws(() =>
          resolveAccessRepository(context, "repository.fixture", signal),
        );
        assert.throws(() =>
          resolveAccessTopicMeeting(context, "repository.fixture", signal),
        );
        const cancelled = new AbortController();
        cancelled.abort();
        assert.throws(() => readAccessPortfolio(context, cancelled.signal));
        assert.throws(() =>
          resolveAccessRepository(
            context,
            "repository.fixture",
            cancelled.signal,
          ),
        );
        assert.throws(() =>
          resolveAccessTopicMeeting(
            context,
            "repository.fixture",
            cancelled.signal,
          ),
        );
      } finally {
        fs.writeFileSync(current, beforeLocalProjection);
        fs.writeFileSync(path.join(target, "PROJECT_CONTEXT.md"), contextBody);
      }
      let signalEntered!: () => void;
      let releaseRead!: () => void;
      if (mode === "cros") {
        const allowed = await submitMutation("updateRoleContentAccess", {
          targetRole: "administrator",
          workspaceIds: ["development"],
        });
        assert.ok("status" in allowed && allowed.status === "completed");
        const published = await submitMutation("updateExposure", {
          repositoryId: "repository.fixture",
          workspaceIds: ["development"],
        });
        assert.ok("status" in published && published.status === "completed");
      }
      const entered = new Promise<void>((resolve) => {
        signalEntered = resolve;
      });
      const release = new Promise<void>((resolve) => {
        releaseRead = resolve;
      });
      const watchdog = new AbortController();
      let oldReadSettled = false;
      let oldRead: Promise<Response> | undefined;
      const originalRead = fs.promises.readFile;
      const heldRead = t.mock.method(
        fs.promises,
        "readFile",
        async (...args: Parameters<typeof fs.promises.readFile>) => {
          const body = await originalRead(...args);
          if (String(args[0]) === path.join(target, "PROJECT_CONTEXT.md")) {
            signalEntered();
            await release;
          }
          return body;
        },
      );
      syncBuiltinESMExports();
      try {
        if (mode === "cros") {
          oldRead = fetchWorkbench(
            `${handle.baseUrl}/api/workbench-view?repositoryId=repository.fixture`,
          ).then((response) => {
            oldReadSettled = true;
            return response;
          });
          await Promise.race([
            entered,
            delay(5000, undefined, { signal: watchdog.signal }).then(() => {
              throw new Error("started_content_read_not_observed");
            }),
          ]);
        }
        const exposure = await submitMutation("updateExposure", {
          repositoryId: "repository.fixture",
          workspaceIds: [],
        });
        assert.ok("status" in exposure && exposure.status === "completed");
        const removed = await submitMutation("unregisterRepository", {
          repositoryId: "repository.fixture",
        });
        assert.ok("status" in removed && removed.status === "completed");
        if (oldRead) {
          assert.equal(
            oldReadSettled,
            false,
            "unregister_does_not_claim_reader_termination",
          );
          releaseRead();
          const response = await oldRead;
          assert.equal(response.status, 403);
          assert.equal(
            await response.text(),
            "local_repository_access_unavailable\n",
          );
          assert.equal(
            oldReadSettled,
            true,
            "old_reader_joined_without_publication",
          );
        }
      } finally {
        watchdog.abort();
        releaseRead();
        heldRead.mock.restore();
        syncBuiltinESMExports();
        if (oldRead) await oldRead;
      }
      assert.equal(fs.existsSync(target), true);
      const final = JSON.parse(
        fs.readFileSync(current, "utf8"),
      ) as AccessManagementState;
      assert.equal(final.registeredRepositories.length, 0);
      assert.equal(final.exposure.length, 0);
      assert.equal(
        final.users.find((user) => user.userId === newUser)?.username,
        "改名",
      );
      assert.equal(
        final.users.find((user) => user.userId === newUser)?.role,
        "manager",
      );
      const storedActor = final.users[0];
      assert.ok(storedActor);
      storedActor.role = "developer";
      fs.writeFileSync(current, JSON.stringify(final));
      const denied = await submitMutation("registerUser", {
        username: "拒否",
        plannedRole: "developer",
      });
      assert.ok("status" in denied && denied.status === "rejected");
      const readDenied = await (
        await fetchWorkbench(
          `${handle.baseUrl}/api/access-management?view=users`,
        )
      ).json();
      assert.deepEqual(readDenied, {
        status: "unavailable",
        reason: "management_read_rejected",
      });
      const beforeClose = fs.readFileSync(current);
      const closingRequest = await openIncompleteManagementBody(handle.baseUrl);
      const requestClosed = new Promise<void>((resolve) =>
        closingRequest.once("close", resolve),
      );
      await handle.close();
      await requestClosed;
      assert.deepEqual(fs.readFileSync(current), beforeClose);
      assert.equal(
        await observeLocalListener(Number(new URL(handle.baseUrl).port)),
        "absent",
      );
    } finally {
      await handle.close();
    }
  });
}
