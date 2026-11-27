/**
 * 管理RESTと単体・共有の本文認可を検証する。
 * @packageDocumentation
 * @responsibility 現行管理保存、本人表示、現在認可と非開示を実保存へ接続する。
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @trace RFD-IT-021
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
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import {
  type ClientRequest,
  request as httpRequest,
  ServerResponse,
} from "node:http";
import { registerHooks, syncBuiltinESMExports } from "node:module";
import { createConnection } from "node:net";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import {
  readAccount,
  registerRepository,
  resolveGitHostLinkedAccessCollection,
} from "@qual-lab/crdd-access-management";
import { readRepositoryManifest } from "@qual-lab/crdd-configuration-model";
import type { ExecutionActivityObservation } from "@qual-lab/crdd-coordinator";
import {
  createPortfolioProjection,
  type ProjectContextSource,
  readRepositoryProjectContext,
} from "@qual-lab/crdd-document-model";
import { getRepository } from "@qual-lab/crdd-version-control";
import { prepareAccessStore } from "../support/access-store.ts";
import { deriveRepositoryBindingId } from "../../../access-management/src/repository/binding.ts";
import type { AccessManagementState } from "../../../access-management/src/storage/types.ts";
import { hostedContentFixture } from "../../../access-management/tests/integration/storage/fixture.ts";
import { selectionConfig } from "../../../coordinator/tests/fixtures/ai-selection.ts";
import { storeFixtureExecution } from "../../../coordinator/tests/fixtures/execution-intelligence.ts";
import { startWorkbench } from "../../src/app.ts";
import { resolveTopicMeetingAccess } from "../../src/service/topic.ts";
import { startManagementHttpFixture } from "../support/management-http.ts";
import { observeRegistrationDirectory } from "../support/repository-registration.ts";
import {
  prepareSharedSignIn,
  startSharedFixture,
} from "../support/shared-sign-in.ts";
import {
  assertManagementResponse,
  assertViewResponse,
} from "../support/workbench-wire.ts";

/**
 * 閉じたServerへの再接続が拒否されることを確認する。
 * @trace RFD-IT-013
 * @boundary 既存試験が所有するloopback Listenerだけに接続する。
 */
async function assertLoopbackClosed(baseUrl: string) {
  const { hostname, port } = new URL(baseUrl);
  assert.equal(hostname, "127.0.0.1");
  const socket = createConnection({ host: hostname, port: Number(port) });
  try {
    await assert.rejects(
      new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("error", reject);
        socket.setTimeout(500, () =>
          reject(new Error("listener_observation_timeout")),
        );
      }),
      { code: "ECONNREFUSED" },
    );
  } finally {
    socket.destroy();
  }
}

/**
 * 自己生成Repositoryへ非秘密の活動履歴を準備する。
 * @responsibility 実EI Writerの履歴からProject絞込みとページングを反証する。
 * @trace EST-IT-014
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
  const value = {
    executionId: `execution-${
      {
        projectId,
        milestoneId: "milestone.fixture",
        objectiveId: "objective.fixture",
        taskId,
        attemptId: `attempt.${taskId}`,
        operationId: `operation.${taskId}`,
      }.operationId
    }`,
    application: "CRDD",
    operation: "task_attempt",
    startedAt: new Date().toISOString(),
    metadata: {
      projectId,
      milestoneId: "milestone.fixture",
      objectiveId: "objective.fixture",
      taskId,
      attemptId: `attempt.${taskId}`,
      operationId: `operation.${taskId}`,
    },
    state: "closed",
    completion: {
      endedAt: new Date().toISOString(),
      elapsedMs: {
        state: "not_observed",
        reason: "fixture_duration_not_observed",
      },
      outcome: {
        status: "completed",
        reason: "fixture_task_completed",
      },
      diagnostic: {
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
      },
      retention: "standard",
    },
  } satisfies Parameters<typeof storeFixtureExecution>[1];
  const verified = getRepository(root);
  assert.ok(verified.status === "completed");
  assert.equal(
    storeFixtureExecution(verified.capability, value).status,
    "completed",
  );
  return value;
}

/**
 * 管理RESTの未完了JSONを自己生成Serverへ搬送する。
 * @responsibility 保存前の切断・Server終了を実streamで作る。
 * @trace EST-IT-010
 * @input 所有Workbenchのloopback URL。
 * @returns Body終端前の所有ClientRequest。
 * @precondition 当該試験がServer終了とRequest破棄を所有する。
 * @stimulus Content-Length未満のJSON断片を一回送信する。
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
async function openIncompleteManagementBody({
  baseUrl,
  cookie,
}: Awaited<
  ReturnType<typeof startManagementHttpFixture>
>): Promise<ClientRequest> {
  const request = httpRequest(`${baseUrl}/api/users`, {
    method: "POST",
    headers: {
      origin: baseUrl,
      cookie,
      "content-type": "application/json",
      "content-length": "1024",
    },
  });
  request.on("error", () => {});
  await new Promise<void>((resolve, reject) => {
    request.write('{"username":', (error) =>
      error ? reject(error) : resolve(),
    );
  });
  await delay(50);
  return request;
}

for (const mode of ["local", "cros"] as const) {
  /**
   * 現行の管理RESTと、共有の本文読取り中に登録が解除される競合を確認する。
   * @responsibility Root・資格を公開せず、保存結果と現在投影を照合する。
   * 登録解除の刺激: 認可済み本文読取りを開始後に保留し、登録を解除する。
   * 登録解除の観測: 解除完了時の読取り未終了、保留解放後の403と終了を別々に確認する。
   * 登録解除のOracle: 解除成功を読取り終了へ読み替えず、本文は公開せず、本体は保持する。
   * @trace RFD-IT-013
   * @trace RFD-IT-021
   * @trace EST-IT-010
   * @trace EST-IT-014
   * @trace CPR-IT-010
   * @trace CPR-IT-012
   * @trace EST-IT-002
   * @precondition 自己生成完了AM、登録可能Git Repository、本番ServerとBundle。
   * @stimulus 管理操作・不正入力、Authorization付き画面要求、現行セッションでの選択GETと読取り中の登録・紐付け・実体変更、重複ID、活動読取り開始前と開始後の切断を試す。
   * @observation HTTP結果・実保存、対象活動履歴のopen／close、成功本文、次回要求の観測。認証前の保存状態読取りも計測する。
   * @oracle 登録だけでは本文を渡さない。認可・実体失効では結果を公開せず、同値の順序変更だけなら許容する。重複IDと開始前の切断では活動読取り0、開始後は対象だけ一回読んで終了し、成功本文と再送は0。
   * @cleanup 所有Serverをclose後、exact自己生成Rootだけを回収する。
   * @boundary 管理RESTは実HTTPと実AM保存、共有表示は合成の本人確認とGitホストを使う。外部サービスとの接続やBrowser描画の代替ではない。
   */
  test(`Workbench通常管理 ${mode}の実保存と閉結果`, async (t) => {
    const repository = path.resolve(import.meta.dirname, "../../../..");
    const base = path.join(repository, ".crdd", "tests");
    fs.mkdirSync(base, { recursive: true });
    const owned = fs.mkdtempSync(path.join(base, "workbench-management-"));
    const closeErrors: unknown[] = [];
    t.after(() => {
      if (closeErrors.length)
        throw new AggregateError(
          closeErrors,
          "record_fixture_close_unconfirmed",
        );
      assert.equal(path.dirname(owned), base);
      assert.equal(fs.realpathSync.native(owned), owned);
      fs.rmSync(owned, { recursive: true });
      assert.equal(fs.existsSync(owned), false);
    });
    const { root, directory: store } = prepareAccessStore(owned);
    const userId = randomUUID(),
      operationId = randomUUID();
    const invalidBearer = "synthetic-invalid-bearer";
    const identity = { issuer: "https://accounts.google.com", subject: userId };
    const accountBinding = { userId, bindingId: randomUUID() };
    const state: AccessManagementState = {
      contract: "crdd-access-management/state",
      schemaRevision: 4,
      revision: 1,
      operationId,
      users: [
        {
          userId,
          username: "管理者",
          role: "administrator",
          accountLinks: [{ ...identity, bindingId: accountBinding.bindingId }],
        },
      ],
      registeredRepositories: [],
      initialization: {
        stage: "completed",
        attemptId: operationId,
        initialUserId: userId,
        connection: "account_confirmed",
      },
    };
    const current = path.join(store, "access-management.json");
    fs.writeFileSync(current, JSON.stringify(state));
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
      const local = await startSharedFixture({
        workingDirectory: startup,
        localAccessRoot: root,
      });
      try {
        const access = assertViewResponse(
          await (await fetch(`${local.baseUrl}/api/workbench/overview`)).json(),
        );
        assert.ok(access.view === "access");
        assert.equal(access.authenticated, false);
        assert.equal(Object.hasOwn(access, "portfolio"), false);
        assert.equal(Object.hasOwn(access, "credentials"), false);
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
        const denied = await fetch(`${local.baseUrl}/api/workbench/overview`, {
          headers: { authorization: `Bearer ${invalidBearer}` },
        });
        assert.equal(denied.status, 403);
        const modelText = await denied.text();
        for (const hidden of [invalidBearer, owned, startup, forbiddenBody])
          assert.equal(modelText.includes(hidden), false);
        const otherBrowser = assertViewResponse(
          await (await fetch(`${local.baseUrl}/api/workbench/overview`)).json(),
        );
        assert.ok(otherBrowser.view === "access");
        assert.equal(otherBrowser.authenticated, false);
        assert.equal(Object.hasOwn(otherBrowser, "portfolio"), false);
        assert.equal(Object.hasOwn(otherBrowser, "credentials"), false);
        for (const route of [
          "/owner-artifact?path=PROJECT_CONTEXT.md",
          "/change?id=CHG-000001",
        ]) {
          const shell = await fetch(`${local.baseUrl}${route}`);
          assert.equal(shell.status, 200);
          assert.match(shell.headers.get("content-type") ?? "", /text\/html/u);
          const body = await shell.text();
          assert.ok(body.includes("data-workbench-react-root"));
          for (const hidden of [invalidBearer, owned, startup, forbiddenBody])
            assert.equal(body.includes(hidden), false);
        }
        assert.equal(
          (
            await fetch(
              `${local.baseUrl}/api/repositories/repository.fixture/topics/TOPIC-000001`,
            )
          ).status,
          401,
        );
        const unauthenticatedArtifact = await fetch(
          `${local.baseUrl}/api/repositories/repository.fixture/changes/CHG-000001`,
        );
        assert.equal(unauthenticatedArtifact.status, 401);
        assert.deepEqual(await unauthenticatedArtifact.json(), {
          error: "login_required",
        });
        assert.deepEqual(fs.readFileSync(current), before);
        assert.equal(
          (await fetch(`${local.baseUrl}/api/access?view=current`)).status,
          404,
        );
        assert.equal(fs.existsSync(path.join(startup, ".crdd")), false);
        assert.equal(
          fs.readFileSync(path.join(startup, "PROJECT_CONTEXT.md"), "utf8"),
          forbiddenBody,
        );
      } finally {
        await local.close();
        await assertLoopbackClosed(local.baseUrl);
        fs.writeFileSync(current, before);
      }
    }
    const hostRepositories = [
      { id: 92, full_name: "fixture/target" },
      { id: 93, full_name: "fixture/sibling" },
      { id: 94, full_name: "fixture/foreign" },
    ] as const;
    const hosted = (id: (typeof hostRepositories)[number]["id"]) => ({
      provider: "github",
      host: "github.com",
      repositoryId: String(id),
      providerData: { installationId: "24" },
    });
    const configureRemote = (
      directory: string,
      remote: (typeof hostRepositories)[number],
    ) => {
      for (const args of [
        [
          "remote",
          "add",
          "origin",
          `https://github.com/${remote.full_name}.git`,
        ],
        ["config", "--local", "protocol.https.allow", "never"],
      ]) {
        assert.equal(
          spawnSync("git", ["-C", directory, ...args], { windowsHide: true })
            .status,
          0,
        );
      }
    };
    const signIn =
      mode === "cros"
        ? await prepareSharedSignIn(t, [userId], hostRepositories)
        : undefined;
    if (signIn) configureRemote(target, hostRepositories[0]);
    const handle = await (signIn ? startSharedFixture : startWorkbench)({
      workingDirectory: repository,
      ...(signIn && {
        ...signIn.options,
        localAccessRoot: root,
        sharedRepositoryRoots: [owned],
      }),
    });
    /**
     * 現行の共有セッションを所有Serverへの要求だけに搬送する。
     * @responsibility 単体の未認証要求と共有のCookie付き要求を区別する。
     * @trace RFD-IT-013
     * @trace EST-IT-010
     * @precondition 自己生成Workbenchと公開ログインから取得したCookieだけを使う。
     * @stimulus 同じHTTP操作をStandaloneとCROSで要求する。
     * @observation 入力Headerと閉結果・実保存を確認する。
     * @oracle 共有は現在セッションと対象のGitホスト権限を照合する。
     * @cleanup N/A: 個々のResponseはCaseが読み切る。
     * @boundary 自己生成HTTPとAMの直接接続。
     */
    let cookie: string | undefined;
    async function fetchWorkbench(input: string, options: RequestInit = {}) {
      const headers = new Headers(options.headers);
      if (cookie) headers.set("cookie", cookie);
      return fetch(input, { ...options, headers });
    }
    let recordHandle: Awaited<ReturnType<typeof startWorkbench>> | undefined;
    let management:
      | Awaited<ReturnType<typeof startManagementHttpFixture>>
      | undefined;
    try {
      cookie = await signIn?.signIn(handle.baseUrl, userId);
      management = await startManagementHttpFixture(
        root,
        { kind: "account", ...accountBinding, expiresAt: Date.now() + 120_000 },
        () => readAccount(root, identity, accountBinding),
      );
      const managementServer = management;
      const model = await (
        await fetchWorkbench(`${handle.baseUrl}/api/workbench/overview`)
      ).json();
      assert.equal(model.view, mode === "cros" ? "access" : "main");
      const actorReply = await fetch(
        `${managementServer.baseUrl}/api/access/me`,
        { headers: { cookie: managementServer.cookie } },
      );
      const {
        formToken: actorFormToken,
        management: actorManagement,
        ...currentActor
      } = await actorReply.json();
      assert.equal(actorFormToken, managementServer.formToken);
      assert.deepEqual(actorManagement, {
        openSession: true,
        registerRoles: ["developer", "manager", "administrator"],
        registerRepository: true,
        unregisterRepository: true,
      });
      const actor = assertManagementResponse(currentActor, "current");
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
          hostedRepository: hosted(92),
        });
        const saved = Buffer.from(JSON.stringify(scopedSelection));
        fs.writeFileSync(current, saved);
        const configPath = path.join(
          target,
          ".crdd",
          "config",
          "ai-selection.json",
        );
        const endpoint = `${handle.baseUrl}/api/repositories/repository.fixture/ai-selection`;
        const headers = {
          origin: handle.baseUrl,
          "content-type": "application/json",
          "x-crdd-action-token": model.actionToken,
          authorization: `Bearer ${invalidBearer}`,
        };
        let stateReads = 0;
        const open = fs.openSync;
        const observed = t.mock.method(
          fs,
          "openSync",
          (...args: Parameters<typeof open>) => {
            if (String(args[0]) === current) stateReads++;
            return open(...args);
          },
        );
        syncBuiltinESMExports();
        try {
          fs.closeSync(fs.openSync(current, "r"));
          assert.equal(stateReads, 1);
          stateReads = 0;
          const before = fs.existsSync(configPath)
            ? fs.readFileSync(configPath)
            : null;
          assert.equal((await fetch(endpoint, { headers })).status, 403);
          assert.equal(
            (
              await fetch(endpoint, {
                method: "PUT",
                headers,
                body: JSON.stringify({
                  expectedIdentity: null,
                  config: selectionConfig(),
                }),
              })
            ).status,
            403,
          );
          assert.deepEqual(
            fs.existsSync(configPath) ? fs.readFileSync(configPath) : null,
            before,
          );
          for (const view of [
            "/api/workbench/overview",
            "/api/workbench/overview?repositoryId=repository.fixture",
            "/api/repositories/repository.fixture/changes/CHG-000001",
          ]) {
            const response = await fetch(`${handle.baseUrl}${view}`, {
              headers,
            });
            assert.equal(response.status, 403);
            assert.deepEqual(await response.json(), {
              error: "request_rejected",
            });
          }
          assert.ok(cookie);
          const mixed = await fetch(
            `${handle.baseUrl}/api/workbench/overview`,
            {
              headers: { ...headers, cookie },
            },
          );
          assert.equal(mixed.status, 403);
          assert.deepEqual(await mixed.json(), { error: "request_rejected" });
          assert.equal(stateReads, 0);
        } finally {
          observed.mock.restore();
          syncBuiltinESMExports();
          fs.writeFileSync(current, originalManagement);
        }
      }
      for (const [view, route] of [
        ["users", "/api/users"],
        ["repositories", "/api/repositories"],
      ] as const) {
        const reply = await fetch(`${managementServer.baseUrl}${route}`, {
          headers: { cookie: managementServer.cookie },
        });
        assert.equal(reply.status, 200);
        const text = await reply.text();
        const { formToken, ...projection } = JSON.parse(text);
        assert.equal(formToken, managementServer.formToken);
        if (view === "users") {
          projection.users = projection.users.map(
            ({ actions, ...user }: { actions: unknown; userId: string }) => {
              assert.ok(actions && typeof actions === "object");
              assert.deepEqual(Object.keys(actions).sort(), [
                "changeRoles",
                "rename",
                "renewInvitation",
              ]);
              return user;
            },
          );
        }
        assertManagementResponse(projection, view);
        for (const hidden of [invalidBearer, owned, target, "bindingId"])
          assert.equal(text.includes(hidden), false);
      }

      const currentRevision = () =>
        (JSON.parse(fs.readFileSync(current, "utf8")) as AccessManagementState)
          .revision;
      const managementFields = () => ({
        formToken: managementServer.formToken,
        operationId: randomUUID(),
        expectedRevision: currentRevision(),
      });
      const sendManagement = (
        method: string,
        route: string,
        json: string,
        overrides: Record<string, string> = {},
      ) =>
        fetch(`${managementServer.baseUrl}${route}`, {
          method,
          body: json,
          headers: {
            cookie: managementServer.cookie,
            "content-type": "application/json",
            origin: managementServer.baseUrl,
            ...overrides,
          },
        });
      const invitation = {
        username: "追加",
        role: "developer",
        email: "fixture@example.test",
      };
      const invite = (overrides: Record<string, string> = {}) =>
        sendManagement(
          "POST",
          "/api/users",
          JSON.stringify({
            ...managementFields(),
            ...invitation,
          }),
          overrides,
        );

      const beforeInvalid = fs.readFileSync(current);
      const incomplete = await openIncompleteManagementBody(managementServer);
      const incompleteClosed = new Promise<void>((resolve) =>
        incomplete.once("close", resolve),
      );
      incomplete.destroy();
      await incompleteClosed;
      await delay(50);
      assert.deepEqual(fs.readFileSync(current), beforeInvalid);
      const wrongOrigin = await invite({ origin: "https://invalid.example" });
      assert.equal(wrongOrigin.status, 403);
      await wrongOrigin.arrayBuffer();
      for (const [body, status] of [
        [
          JSON.stringify({
            ...managementFields(),
            ...invitation,
            formToken: "invalid",
          }),
          401,
        ],
        [
          JSON.stringify({
            ...managementFields(),
            ...invitation,
            unknownField: true,
          }),
          400,
        ],
        [
          `${JSON.stringify({ ...managementFields(), ...invitation }).slice(0, -1)},"username":"duplicate"}`,
          400,
        ],
      ] as const) {
        const reply = await sendManagement("POST", "/api/users", body);
        assert.equal(reply.status, status);
        await reply.arrayBuffer();
        assert.deepEqual(fs.readFileSync(current), beforeInvalid);
      }
      const invited = await invite();
      assert.equal(invited.status, 201);
      const registered = assertManagementResponse(
        (await invited.json()).result,
        "mutation",
      );
      assert.ok(
        registered.status === "completed" &&
          "userId" in registered &&
          registered.userId,
      );
      const newUser = registered.userId;
      for (const [method, route, fields] of [
        ["PATCH", `/api/users/${newUser}`, { username: "改名" }],
        [
          "PUT",
          `/api/users/${newUser}/role`,
          { currentRole: "developer", nextRole: "manager" },
        ],
      ] as const) {
        const result = await sendManagement(
          method,
          route,
          JSON.stringify({ ...managementFields(), ...fields }),
        );
        assert.equal(result.status, 200);
        assert.equal(
          assertManagementResponse(await result.json(), "mutation").status,
          "completed",
        );
      }

      // 現行アカウントでホスト参照付きの登録を保存する。
      const setupRegistration = () =>
        registerRepository(
          root,
          {
            kind: "account",
            ...accountBinding,
            expiresAt: Date.now() + 60_000,
          },
          currentRevision(),
          randomUUID(),
          "repository.fixture",
          target,
          (directory) => {
            const observed = observeRegistrationDirectory(directory);
            return observed && { ...observed, hostedRepository: hosted(92) };
          },
        );
      const registrationBefore = fs.readFileSync(current);
      const gitDirectory = path.join(target, ".git");
      const displacedGit = path.join(owned, "registration-fixture-git");
      fs.renameSync(gitDirectory, displacedGit);
      try {
        assert.notEqual(setupRegistration().status, "completed");
        assert.deepEqual(fs.readFileSync(current), registrationBefore);
      } finally {
        fs.renameSync(displacedGit, gitDirectory);
      }
      assert.equal(setupRegistration().status, "completed");
      const beforeLocalProjection = fs.readFileSync(current);
      const contextBody = fs.readFileSync(
        path.join(target, "PROJECT_CONTEXT.md"),
      );
      try {
        const signal = new AbortController().signal;
        const projectionState = JSON.parse(
          beforeLocalProjection.toString("utf8"),
        ) as AccessManagementState;
        const manifest = readRepositoryManifest(target);
        const registered = projectionState.registeredRepositories.find(
          ({ repositoryId }) => repositoryId === "repository.fixture",
        );
        assert.ok(manifest.status === "ready" && registered);
        const ownedTarget = {
          root: target,
          repositoryId: registered.repositoryId,
          bindingId: registered.bindingId,
          manifest: manifest.manifest,
        };
        const readRecords = (
          repositoryId: string,
          currentSignal: AbortSignal,
        ) => {
          return resolveTopicMeetingAccess(
            [ownedTarget],
            repositoryId,
            currentSignal,
            "workbench_local_records_unavailable",
          );
        };
        const records = readRecords("repository.fixture", signal);
        assert.ok(records);
        const cancelledRecords = new AbortController();
        cancelledRecords.abort();
        assert.throws(
          () => readRecords("repository.fixture", cancelledRecords.signal),
          { message: "workbench_local_records_unavailable" },
        );
        assert.equal(records.topic.getDocument("TOPIC-000001"), null);
        const createdTopic = records.topic.create(
          "# 自己生成Topic\n\n成果物種別: Topic\nTopic ID: `TOPIC-000001`\nProject ID: `project.fixture`\n状態: `open`\n改訂: `1`\n維持責任者: `試験担当`\n\n## 1. 現在の論点\n\n### 結論\n\n現在許可対象への保存を確認する。\n",
        );
        assert.equal(createdTopic.status, "completed");
        assert.ok(records.topic.getDocument("TOPIC-000001"));
        if (mode === "cros") {
          const linked = structuredClone(projectionState);
          fs.writeFileSync(current, JSON.stringify(linked));
          recordHandle = await startWorkbench({ workingDirectory: target });
          const recordBase = recordHandle.baseUrl;
          const repositoryPath = "/api/repositories/repository.fixture";
          const topicPath = `${repositoryPath}/topics`;
          const actionHeaders = {
            origin: recordBase,
            "content-type": "application/json",
          };
          const writeRecord = (target: string, method: string, body: object) =>
            fetch(`${recordBase}${target}`, {
              method,
              headers: actionHeaders,
              body: JSON.stringify(body),
            });
          for (const kind of ["topic", "meeting"] as const) {
            const id = kind === "topic" ? "TOPIC-000077" : "MTG-000077";
            const markdown = `# 保存試験\n\n成果物種別: ${kind === "topic" ? "Topic" : "Meeting"}\n${kind === "topic" ? "Topic" : "Meeting"} ID: \`${id}\`\nProject ID: \`project.fixture\`\n状態: \`${kind === "topic" ? "open" : "recorded"}\`\n${kind === "meeting" ? "開催日時: `2026-10-13 09:00 JST`\n" : ""}改訂: \`1\`\n維持責任者: \`試験担当\`\n\n## 1. 現在の論点\n\n### 結論\n\n指定先への保存だけを行う。\n`;
            const savedMarkdown =
              kind === "meeting"
                ? markdown +
                  "\n## 4. Outcome\n\n| Local ID | 状態 |\n|---|---|\n"
                : markdown;
            const collection = `${repositoryPath}/${kind}s`;
            const item = `${collection}/${id}`;
            for (const rejected of [
              `{"markdown":${JSON.stringify(savedMarkdown)},"markdown":${JSON.stringify(savedMarkdown)}}`,
              JSON.stringify({ markdown: savedMarkdown, unknown: "value" }),
              JSON.stringify({
                markdown: savedMarkdown,
                repositoryId: "repository.absent",
              }),
            ]) {
              const denied = await fetch(`${recordBase}${collection}`, {
                method: "POST",
                headers: actionHeaders,
                body: rejected,
              });
              assert.equal(denied.status, 400);
              assert.deepEqual(await denied.json(), {
                error: "invalid_request",
              });
              assert.equal(records[kind].getDocument(id), null);
            }
            const absent = await writeRecord(
              `/api/repositories/repository.absent/${kind}s`,
              "POST",
              { markdown: savedMarkdown },
            );
            assert.equal(absent.status, 404);
            assert.equal(records[kind].getDocument(id), null);
            const created = await writeRecord(collection, "POST", {
              markdown: savedMarkdown,
            });
            assert.equal(created.status, 201, `record_create_${kind}`);
            assert.equal((await created.json()).filesystemEffectCount, 1);
            assert.equal(
              records[kind].getDocument(id)?.markdown,
              savedMarkdown,
            );
            const revised = savedMarkdown.replace("改訂: `1`", "改訂: `2`");
            const conflict = await writeRecord(item, "PATCH", {
              expectedRevision: 9,
              markdown: revised,
            });
            assert.equal(conflict.status, 409);
            assert.equal(
              (await conflict.json()).reason,
              "record_revision_conflict",
            );
            assert.equal(
              records[kind].getDocument(id)?.markdown,
              savedMarkdown,
            );
            const updated = await writeRecord(item, "PATCH", {
              expectedRevision: 1,
              markdown: revised,
            });
            assert.equal(updated.status, 200);
            assert.equal((await updated.json()).filesystemEffectCount, 1);
            assert.equal(records[kind].getDocument(id)?.markdown, revised);
            const deletion = {
              expectedRevision: 2,
              reason: "mistaken_registration",
            };
            const beforeDelete: string | undefined =
              records[kind].getDocument(id)?.markdown;
            for (const value of [null, "invalid"] as const) {
              const denied = await writeRecord(
                item,
                "DELETE",
                value === null ? deletion : { ...deletion, confirmed: value },
              );
              assert.equal(denied.status, 400);
              assert.equal(
                records[kind].getDocument(id)?.markdown,
                beforeDelete,
              );
            }
            const unconfirmed = await writeRecord(item, "DELETE", {
              ...deletion,
              confirmed: false,
            });
            assert.equal(unconfirmed.status, 409);
            assert.equal(
              (await unconfirmed.json()).reason,
              "record_delete_confirmation_required",
            );
            assert.ok(records[kind].getDocument(id));
            const deleted = await writeRecord(item, "DELETE", {
              ...deletion,
              confirmed: true,
            });
            assert.equal(deleted.status, 200);
            assert.equal((await deleted.json()).filesystemEffectCount, 1);
            assert.equal(records[kind].getDocument(id), null);
          }
          const outcomeInput = {
            expectedRevision: 1,
            disposition: "completed",
            owner: "試験担当",
            reviewTrigger: "試験終了",
            targetKind: "none",
            targetReference: "",
            treatment: "処置済み",
            completionCondition: "確認済み",
            result: "確認済み",
            closeMeeting: false,
          };
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
                const invalid: Record<string, unknown> = { ...outcomeInput };
                let outcomeTarget = "/OUT-001";
                if (field === "outcomeId")
                  outcomeTarget = missing ? "" : "/invalid";
                else if (missing) delete invalid[field];
                else invalid[field] = "invalid";
                const response = await writeRecord(
                  `${repositoryPath}/meetings/MTG-000088/outcomes${outcomeTarget}/treatment`,
                  "PUT",
                  invalid,
                );
                const missingPath = field === "outcomeId" && missing;
                assert.equal(
                  response.status,
                  missingPath ? 404 : 400,
                  `invalid_outcome_${field}_${missing}`,
                );
                if (missingPath) await response.arrayBuffer();
                else
                  assert.deepEqual(await response.json(), {
                    error: "invalid_request",
                  });
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
          const recordManifest = path.join(
            target,
            ".crdd",
            "config",
            "repository-manifest.json",
          );
          const savedBeforeFailure = fs.readFileSync(recordManifest);
          for (const [index, failure] of [
            "manifest",
            "throw",
            "cancel",
            "normal",
          ].entries()) {
            const id = `TOPIC-${String(88 + index).padStart(6, "0")}`;
            const markdown = `# 保存後反例\n\n成果物種別: Topic\nTopic ID: \`${id}\`\nProject ID: \`project.fixture\`\n状態: \`open\`\n改訂: \`1\`\n維持責任者: \`試験担当\`\n\n## 1. 現在の論点\n\n### 結論\n\n保存後の失敗を未保存へ畳まない。\n`;
            const targetFile = path.join(target, "22_Topics", id, "topic.md");
            const data = JSON.stringify({ markdown });
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
                if (this.req.method === "POST" && this.req.url === topicPath)
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
                  `${url.pathname}${url.search}` === topicPath &&
                  this.statusCode === 201 &&
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
                const manifest = JSON.parse(
                  savedBeforeFailure.toString("utf8"),
                );
                fs.writeFileSync(
                  recordManifest,
                  JSON.stringify({
                    ...manifest,
                    displayName: "変更された試験対象",
                  }),
                );
              },
            );
            syncBuiltinESMExports();
            try {
              if (failure === "cancel") {
                await new Promise<void>((resolve, reject) => {
                  const outgoing = httpRequest(`${recordBase}${topicPath}`, {
                    method: "POST",
                    agent: false,
                    headers: {
                      origin: recordBase,
                      "content-type": "application/json",
                      "content-length": Buffer.byteLength(data),
                    },
                  });
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
                const reply = await writeRecord(topicPath, "POST", {
                  markdown,
                });
                if (failure === "normal") {
                  assert.equal(reply.status, 201);
                  assert.equal((await reply.json()).filesystemEffectCount, 1);
                } else {
                  assert.equal(reply.status, 503, failure);
                  assert.deepEqual(await reply.json(), {
                    status: "unavailable",
                    reason: "record_publication_unconfirmed",
                    effectState: "unknown",
                  });
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
              fs.writeFileSync(recordManifest, savedBeforeFailure);
              const beforeFresh = fs.readFileSync(targetFile);
              const fresh = await fetchWorkbench(
                `${handle.baseUrl}/api/workbench/overview?repositoryId=repository.fixture`,
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
              fs.writeFileSync(recordManifest, savedBeforeFailure);
            }
          }
          const promotionMarkdown =
            "# 昇格試験\n\n成果物種別: Topic\nTopic ID: `TOPIC-000099`\nProject ID: `project.fixture`\n状態: `open`\n改訂: `1`\n維持責任者: `試験担当`\n\n## 1. 現在の論点\n\n### 結論\n\n昇格を確認する。\n\n## 3. 関係\n\n| 関係種別 | 対象ID／参照 | このTopicとの関係 |\n|---|---|---|\n\n## 5. 終了・昇格\n\n| 項目 | 内容 |\n|---|---|\n| 処置 | N/A: 未処置 |\n| 昇格先 | N/A: 未昇格 |\n| 終了理由 | N/A: 未終了 |\n| 残る影響 | N/A: 未終了 |\n";
          assert.equal(
            records.topic.create(promotionMarkdown).status,
            "completed",
          );
          const promote = {
            expectedRevision: 1,
            changeId: "CHG-000099",
            reason: "具体変更として扱う",
            remainingResponsibility: "CHG終了時に再確認",
          };
          const promotionTarget = `${topicPath}/TOPIC-000099/promotion`;
          const missingChange = await writeRecord(
            promotionTarget,
            "POST",
            promote,
          );
          assert.equal(missingChange.status, 409);
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
          const promoted = await writeRecord(promotionTarget, "POST", promote);
          assert.equal(promoted.status, 200);
          assert.equal((await promoted.json()).filesystemEffectCount, 1);
          assert.equal(
            records.topic.getDocument("TOPIC-000099")?.record.state,
            "promoted",
          );
          const promotionConflict = await writeRecord(
            promotionTarget,
            "POST",
            promote,
          );
          assert.equal(promotionConflict.status, 409);
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
          const treatment = {
            ...outcomeInput,
            targetReference: "N/A: 自己完結",
          };
          const outcomes = `${repositoryPath}/meetings/MTG-000099/outcomes`;
          const pendingClose = await writeRecord(
            `${outcomes}/OUT-001/treatment`,
            "PUT",
            { ...treatment, closeMeeting: true },
          );
          assert.equal(pendingClose.status, 409);
          assert.equal(
            (await pendingClose.json()).reason,
            "meeting_outcome_invalid",
          );
          assert.equal(
            records.meeting.getDocument("MTG-000099")?.markdown,
            meetingMarkdown,
          );
          const firstOutcome = await writeRecord(
            `${outcomes}/OUT-001/treatment`,
            "PUT",
            treatment,
          );
          assert.equal(firstOutcome.status, 200);
          assert.equal((await firstOutcome.json()).filesystemEffectCount, 1);
          assert.equal(
            records.meeting.getDocument("MTG-000099")?.record.state,
            "recorded",
          );
          const closedMeeting = await writeRecord(
            `${outcomes}/OUT-002/treatment`,
            "PUT",
            { ...treatment, expectedRevision: 2, closeMeeting: true },
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
            `${handle.baseUrl}/api/workbench/overview?repositoryId=repository.fixture`,
          );
          assert.equal(reply.status, 200);
          const body = await reply.text();
          const selectedModel = assertViewResponse(JSON.parse(body));
          assert.ok(selectedModel.view === "main");
          assert.equal(selectedModel.workspaceAccess, "write");
          assert.deepEqual(selectedModel.repositoryActions, [
            "prepare",
            "unprepare",
          ]);
          assert.equal(
            selectedModel.selectedRepositoryId,
            "repository.fixture",
          );
          assert.equal(
            selectedModel.projectData.context.repositoryId,
            "repository.fixture",
          );
          assert.equal(
            selectedModel.projectData.context.projectId,
            "project.fixture",
          );
          assert.equal(selectedModel.aiSelection?.selection.status, "missing");
          assert.equal(
            Object.hasOwn(selectedModel, "executionActivity"),
            false,
          );
          assert.equal(selectedModel.aiRequest.configured, false);
          assert.equal("candidateConfigured" in selectedModel.aiRequest, false);
          assert.equal(Object.hasOwn(selectedModel, "repositoryResult"), false);
          assert.equal(
            Object.hasOwn(selectedModel, "recordActionResult"),
            false,
          );
          assert.equal(selectedModel.aiSelectionManagement.snapshot, null);
          assert.equal(selectedModel.aiSelectionManagement.allowed, false);
          for (const secret of [invalidBearer, root.root, target, "bindingId"])
            assert.equal(body.includes(secret), false);
          const detail = await fetchWorkbench(
            `${handle.baseUrl}/api/repositories/repository.fixture/topics/TOPIC-000001`,
          );
          assert.equal(detail.status, 200);
          const documentModel = await detail.json();
          assert.equal(documentModel.record.topicId, "TOPIC-000001");
          assert.equal(documentModel.repositoryId, "repository.fixture");
          const absent = await fetchWorkbench(
            `${handle.baseUrl}/api/workbench/overview?repositoryId=repository.absent`,
          );
          assert.equal(absent.status, 403);
          assert.equal(
            await absent.text(),
            "local_repository_access_unavailable\n",
          );
          const anonymous = await fetch(
            `${handle.baseUrl}/api/workbench/overview?repositoryId=repository.fixture`,
          );
          assert.equal(anonymous.status, 403);
          const portal = assertViewResponse(
            await (
              await fetchWorkbench(
                `${handle.baseUrl}/api/workbench/overview?repositoryId=`,
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
            hostedRepository: hosted(93),
          });
          configureRemote(sibling, hostRepositories[1]);
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
            hostedRepository: hosted(94),
          });
          configureRemote(foreign, hostRepositories[2]);
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
              target,
              "project.fixture",
              `task.fixture-${index}`,
            );
          recordFixtureActivity(sibling, "project.fixture", "task.sibling");
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
              removed.registeredRepositories =
                removed.registeredRepositories.filter(
                  (entry) => entry.repositoryId !== "repository.sibling",
                );
              fs.writeFileSync(current, JSON.stringify(removed));
            },
          );
          syncBuiltinESMExports();
          try {
            const reply = await writeRecord(topicPath, "POST", {
              markdown: siblingMarkdown,
            });
            assert.equal(reply.status, 201);
            assert.equal((await reply.json()).filesystemEffectCount, 1);
            assert.equal(siblingWrites, 1);
            assert.equal(
              fs.readFileSync(siblingRecordFile, "utf8"),
              siblingMarkdown,
            );
            fs.writeFileSync(current, siblingState);
            const fresh = await fetchWorkbench(
              `${handle.baseUrl}/api/workbench/overview?repositoryId=repository.fixture`,
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
          const activityPath = "/api/repositories/repository.fixture/activity";
          const readActivity = async (query = "") => {
            const reply = await fetchWorkbench(
              `${handle.baseUrl}${activityPath}${query}`,
            );
            assert.equal(reply.status, 200);
            return (await reply.json()) as ExecutionActivityObservation;
          };
          const activity = await readActivity();
          assert.equal(activity.state, "absent");
          assert.equal(activity.eventState, "observed");
          assert.equal(activity.events.length, 20);
          assert.ok(
            activity.events.every(
              (entry) =>
                entry.repositoryId === "repository.fixture" &&
                entry.taskId !== "task.foreign" &&
                entry.taskId !== "task.sibling",
            ),
          );
          for (const parity of [0, 1])
            assert.ok(
              activity.events.some(
                (entry) =>
                  Number(entry.taskId.split("-").at(-1)) % 2 === parity,
              ),
            );
          const cursor = activity.eventContinuation;
          assert.ok(cursor);
          const continuation = await readActivity(
            `?cursor=${encodeURIComponent(cursor)}`,
          );
          assert.equal(continuation.events.length, 5);
          assert.equal(continuation.eventContinuation, null);
          assert.deepEqual(
            [
              ...new Set(
                [...activity.events, ...continuation.events].map(
                  (entry) => entry.taskId,
                ),
              ),
            ].sort(),
            Array.from(
              { length: 25 },
              (_, index) => `task.fixture-${index}`,
            ).sort(),
          );
          const invalidCursor = await fetchWorkbench(
            `${handle.baseUrl}${activityPath}?cursor=invalid`,
          );
          assert.equal(invalidCursor.status, 503);
          assert.deepEqual(await invalidCursor.json(), {
            error: "execution_activity_unavailable",
          });
          const historyPath = path.join(
            target,
            ".crdd",
            "execution-intelligence",
            "history.jsonl",
          );
          const savedHistory = fs.readFileSync(historyPath);
          try {
            fs.writeFileSync(historyPath, "invalid-history\n");
            const unknown = await readActivity();
            assert.equal(unknown.state, "absent");
            assert.equal(unknown.eventState, "unknown");
            assert.equal(unknown.events.length, 0);
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
            const originalEnd = ServerResponse.prototype.end;
            const selectedUrl = activityPath;
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
            const beforeReader = `activity-delayed-reader-${randomUUID()}`;
            let earlyReaderCalls = 0;
            const early =
              cancelStage === "before"
                ? registerHooks({
                    resolve(specifier, context, next) {
                      if (
                        !cancelled &&
                        specifier === "@qual-lab/crdd-coordinator" &&
                        context.parentURL?.endsWith("/src/service/execution.ts")
                      ) {
                        cancelled = true;
                        client.request?.destroy();
                        const source = `await new Promise(resolve => setTimeout(resolve, 25)); export const queryActivity = globalThis[${JSON.stringify(beforeReader)}];`;
                        return {
                          url: `data:text/javascript,${encodeURIComponent(source)}`,
                          shortCircuit: true,
                        };
                      }
                      return next(specifier, context);
                    },
                  })
                : null;
            if (early)
              Reflect.set(globalThis, beforeReader, () => {
                earlyReaderCalls++;
                throw new Error("unexpected_activity_reader");
              });
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
                    headers: { cookie: cookie ?? "" },
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
                `${cancelStage}: cancelled_activity_success_body_zero`,
              );
              assert.equal(reads.length, cancelStage === "before" ? 0 : 1);
              assert.equal(earlyReaderCalls, 0);
              assert.equal(
                new Set(reads).size,
                reads.length,
                "activity_no_repeat",
              );
              assert.equal(
                reads.filter((name) => name === historyPath).length,
                cancelStage === "before" ? 0 : 1,
                "started_reader_joins_selected_repository",
              );
            } finally {
              client.request?.destroy();
              scan.mock.restore();
              opened.mock.restore();
              early?.deregister();
              Reflect.deleteProperty(globalThis, beforeReader);
              publication.mock.restore();
              syncBuiltinESMExports();
            }
            const next = await new Promise<ExecutionActivityObservation>(
              (resolve, reject) => {
                const request = httpRequest(
                  `${handle.baseUrl}${selectedUrl}`,
                  {
                    agent: false,
                    headers: { cookie: cookie ?? "" },
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
              },
            );
            assert.equal(next.eventState, "observed");
            assert.equal(next.events.length, 20);
          }
          for (const directory of [target, sibling, foreign])
            assert.equal(
              fs.existsSync(path.join(directory, ".crdd", "orchestrator")),
              false,
              "activity_reader_no_initialization",
            );
          try {
            for (const scenario of [
              "selected-registration",
              "account",
              "sibling-registration",
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
                      }
                      if (scenario === "account") {
                        const user = next.users.find(
                          (entry) => entry.userId === userId,
                        );
                        assert.ok(user);
                        user.accountLinks = [];
                      }
                      if (
                        scenario === "selected-registration" ||
                        scenario === "sibling-registration"
                      ) {
                        const id =
                          scenario === "selected-registration"
                            ? "repository.fixture"
                            : "repository.sibling";
                        next.registeredRepositories =
                          next.registeredRepositories.filter(
                            (entry) => entry.repositoryId !== id,
                          );
                      }
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
                  `${handle.baseUrl}/api/workbench/overview?repositoryId=repository.fixture`,
                );
                assert.equal(changed, true, scenario);
                if (scenario === "reorder") {
                  assert.equal(stale.status, 200);
                  const reordered = assertViewResponse(await stale.json());
                  assert.ok(reordered.view === "main");
                  assert.equal(
                    reordered.projectData.context.repositoryId,
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
                `${handle.baseUrl}/api/workbench/overview?repositoryId=${selection}`,
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
              `${handle.baseUrl}/api/workbench/overview?repositoryId=repository.fixture`,
            );
            assert.ok(reads > 0, "valid_request_read_counter_positive");
            assert.ok(opens > 0, "valid_request_open_counter_positive");
          } finally {
            readObservation.mock.restore();
            openObservation.mock.restore();
            syncBuiltinESMExports();
          }
        }
        assert.equal(readRecords("repository.absent", signal), null);
        if (mode === "cros") {
          const removed = structuredClone(projectionState);
          removed.registeredRepositories = [];
          fs.writeFileSync(current, JSON.stringify(removed));
          const withdrawn = await fetchWorkbench(
            `${handle.baseUrl}/api/workbench/overview?repositoryId=repository.fixture`,
          );
          assert.equal(withdrawn.status, 403);
          assert.equal(
            await withdrawn.text(),
            "local_repository_access_unavailable\n",
          );
        }
      } finally {
        fs.writeFileSync(current, beforeLocalProjection);
        fs.writeFileSync(path.join(target, "PROJECT_CONTEXT.md"), contextBody);
      }
      let signalEntered!: () => void;
      let releaseRead!: () => void;
      if (mode === "cros") {
        // 進行中の本文読取りを管理RESTの登録解除で失効させる。
        const state = JSON.parse(
          fs.readFileSync(current, "utf8"),
        ) as AccessManagementState;
        state.revision++;
        state.operationId = randomUUID();
        fs.writeFileSync(current, JSON.stringify(state));
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
            `${handle.baseUrl}/api/workbench/overview?repositoryId=repository.fixture`,
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
        const removed = await sendManagement(
          "DELETE",
          "/api/repositories/repository.fixture",
          JSON.stringify(managementFields()),
        );
        assert.equal(removed.status, 200);
        assert.equal(
          assertManagementResponse(await removed.json(), "mutation").status,
          "completed",
        );
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
      assert.equal(Object.hasOwn(final, "exposure"), false);
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
      const denied = await invite();
      assert.equal(denied.status, 403);
      assert.equal(
        assertManagementResponse(await denied.json(), "mutation").status,
        "rejected",
      );
      const readDenied = await fetch(`${managementServer.baseUrl}/api/users`, {
        headers: { cookie: managementServer.cookie },
      });
      assert.equal(readDenied.status, 403);
      assert.deepEqual(await readDenied.json(), {
        status: "unavailable",
        reason: "management_read_rejected",
      });
      const beforeClose = fs.readFileSync(current);
      const closingRequest =
        await openIncompleteManagementBody(managementServer);
      const requestClosed = new Promise<void>((resolve) =>
        closingRequest.once("close", resolve),
      );
      await managementServer.close();
      await requestClosed;
      assert.deepEqual(fs.readFileSync(current), beforeClose);
      await assertLoopbackClosed(managementServer.baseUrl);
    } finally {
      const closed = await Promise.allSettled([
        handle.close(),
        recordHandle?.close(),
        management?.close(),
      ]);
      const errors = closed.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      closeErrors.push(...errors);
    }
  });
}

/**
 * 現在許可集合から実本文を一回読み中立Sourceへ搬送する。
 * @responsibility 管理改訂と本文版を分離し、許可外RootをReaderへ渡さない。
 * @trace RFD-IT-019
 * @precondition 公開済み一Repositoryと管理者の空内容範囲。
 * @stimulus 各Roleの現在集合を取得して固定本文を読み集約し、本文欠測も観測する。
 * @observation Reader対象open回数、4項目Source、本文版、Portfolio、固定取得不能結果。
 * @oracle developerだけ対象本文一回、administrator空集合は本文0。本文不明は版なしでnull／missingを作らない。
 * @cleanup Hook復元と既存Fixtureによる自己生成Root不存在確認。
 * @boundary AM実認可→Domain実本文Reader→Source→Portfolio。本番Surfaceの完成は対象外。
 */
test("許可集合の実本文と本文版を中立Sourceへ渡す", (t) => {
  const f = hostedContentFixture(t),
    target = path.join(f.target.directory, "PROJECT_CONTEXT.md");
  const open = fs.openSync;
  let opened = 0;
  t.after(() => {
    fs.openSync = open;
  });
  fs.openSync = (file, flags, mode) => {
    if (String(file) === target) opened++;
    return open(file, flags, mode);
  };
  try {
    for (const allowed of [true, false]) {
      opened = 0;
      const collection = resolveGitHostLinkedAccessCollection(
        f.root,
        f.principal,
        {
          managementRevision: f.state.revision,
          candidates: allowed ? [f.candidate] : [],
        },
      );
      assert.equal(collection.status, "completed");
      if (collection.status !== "completed")
        throw new Error("collection unavailable");
      const sources: ProjectContextSource[] = [];
      for (const repository of collection.repositories) {
        const read = readRepositoryProjectContext(repository.root, {
          projectId: repository.manifest.projectId,
          repositoryId: repository.manifest.repositoryId,
          repositoryRole: repository.manifest.repositoryRole,
        });
        assert.equal(read.status, "completed");
        if (read.status !== "completed") throw new Error("context unavailable");
        sources.push(
          Object.freeze({
            projectId: repository.manifest.projectId,
            repositoryId: repository.repositoryId,
            state: "complete",
            revision: read.revision,
            context: read.context,
          }),
        );
      }
      const portfolio = createPortfolioProjection(sources);
      assert.equal(opened, allowed ? 1 : 0);
      if (allowed) {
        assert.deepEqual(Object.keys(sources[0] ?? {}).sort(), [
          "context",
          "projectId",
          "repositoryId",
          "revision",
          "state",
        ]);
        assert.equal(portfolio.projects[0]?.state, "complete");
        assert.equal(
          portfolio.projects[0]?.sources[0]?.revision,
          `context-text-sha256:${createHash("sha256").update(f.target.context, "utf8").digest("hex")}`,
        );
        assert.notEqual(
          sources[0]?.revision,
          String(collection.managementRevision),
        );
      } else assert.deepEqual(portfolio.projects, []);
    }
    fs.rmSync(target);
    const collection = resolveGitHostLinkedAccessCollection(
      f.root,
      f.principal,
      {
        managementRevision: f.state.revision,
        candidates: [f.candidate],
      },
    );
    assert.equal(collection.status, "completed");
    if (collection.status !== "completed")
      throw new Error("collection unavailable");
    const repository = collection.repositories[0];
    assert.ok(repository);
    const read = readRepositoryProjectContext(repository.root, {
      projectId: repository.manifest.projectId,
      repositoryId: repository.manifest.repositoryId,
      repositoryRole: repository.manifest.repositoryRole,
    });
    assert.deepEqual(read, {
      status: "unavailable",
      reason: "project_context_observation_unavailable",
    });
    assert.equal(Object.hasOwn(read, "revision"), false);
    assert.equal(Object.hasOwn(read, "context"), false);
  } finally {
    fs.openSync = open;
  }
});
