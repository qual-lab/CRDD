/**
 * 共有AI入口の主体・Repository分離を実HTTPで検証する。
 * @packageDocumentation
 * @responsibility AMの現在認可を有限Task Ownerの開始・観測・取消へ接続する。
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @level IT
 * @scope 自己生成AM、二Repository、二主体。Dockerと外部AIは使わない。
 * @boundary Workbench HTTPとAMの実保存。
 */
import assert from "node:assert/strict";
import { executionSelection } from "../../../coordinator/tests/fixtures/ai-selection.ts";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import test from "node:test";
import { createCredentialMaterial } from "../../../access-management/src/credential/token.ts";
import {
  resolveConnectionAuthentication,
  resolveRepositoryAccess,
  resolveRepositoryAccessCollection,
} from "../../../access-management/src/index.ts";
import { deriveRepositoryBindingId } from "../../../access-management/src/repository/binding.ts";
import type { AccessManagementState } from "../../../access-management/src/storage/types.ts";
import { createFilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import { resolveVerifiedRepositoryRoot } from "../../../version-control/src/index.ts";
import type { WorkbenchAiRequestSnapshot } from "../../src/server/ai-request/types.ts";
import { startWorkbench } from "../../src/index.ts";
import { readAuthorizedPortfolio } from "../../src/server/project/access-reader.ts";
import { readWorkbenchProjectSurface } from "../../src/server/project/surface.ts";

/**
 * 二主体・二Repositoryの開始と取消を混在させない。
 * @responsibility 無資格・失効・対象違いで元の結果を開示しない。
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @precondition 自己生成Rootだけへfixtureを作る。
 * @stimulus 明示開始、同対象観測、別主体取消、対象切替、失効。
 * @observation 実HTTP応答、有限Ownerの呼出しと終了件数。
 * @oracle Task IDの共有0、認可拒否で下位呼出し0、closeで全Owner終了。
 * @cleanup Serverをjoin後、exact試験Rootを削除し不存在確認する。
 * @boundary AM実保存と公開HTTP。実Providerの代替根拠にはしない。
 */
test("共有Task入口は主体とRepositoryを分離し毎要求の認可を使う", async (t) => {
  const repository = path.resolve(import.meta.dirname, "../../../..");
  const parent = path.join(repository, ".crdd", "tests");
  const owned = fs.mkdtempSync(path.join(parent, "ai-shared-task-"));
  assert.equal(path.dirname(owned), parent);
  t.after(() => {
    fs.rmSync(owned, { recursive: true, force: true });
    assert.equal(fs.existsSync(owned), false);
  });
  const root = createFilesystemStoreRoot(owned);
  assert.ok(root);
  const users = [randomUUID(), randomUUID()] as const;
  const materials = [
    createCredentialMaterial(),
    createCredentialMaterial(),
  ] as const;
  const operationId = randomUUID();
  const registeredRepositories = ["repository.a", "repository.b"].map(
    (repositoryId) => {
      const target = path.join(owned, repositoryId);
      fs.mkdirSync(target);
      execFileSync("git", ["init", "--quiet", "--template=", target], {
        windowsHide: true,
        stdio: "pipe",
      });
      fs.mkdirSync(path.join(target, ".crdd", "config"), { recursive: true });
      fs.writeFileSync(
        path.join(target, ".crdd", "config", "network-policy.json"),
        JSON.stringify({ version: 1, allowedHosts: ["registry.npmjs.org"] }),
      );
      fs.writeFileSync(
        path.join(target, ".crdd", "config", "repository-manifest.json"),
        JSON.stringify({
          schema: "crdd/repository-manifest/v2",
          projectId: "project.fixture",
          repositoryId,
          displayName: "試験",
          repositoryRole: "development",
          capabilities: [],
          contextSurfaces: [],
          externalSendPolicy: null,
        }),
      );
      fs.writeFileSync(
        path.join(target, "PROJECT_CONTEXT.md"),
        `# Project Context\n\nProject ID: project.fixture\nRepository ID: ${repositoryId}\nRepository Role: development\n` +
          [
            "今どうなっているか",
            "何が危ない、または止まっているか",
            "今、人間が決めることは何か",
            "なぜこの状態・判断になったか",
            "次に何をすべきか",
          ]
            .map(
              (heading, i) =>
                `\n## ${i + 1}. ${heading}\n\n### 結論\n\n自己生成試験。\n\n| 項目 | 内容 |\n|---|---|\n| 試験 | 固定 |\n`,
            )
            .join(""),
      );
      return {
        repositoryId,
        repositoryRoot: target,
        bindingId: deriveRepositoryBindingId(repositoryId, target),
      };
    },
  );
  const state: AccessManagementState = {
    contract: "crdd-access-management/state",
    schemaRevision: 2,
    revision: 1,
    operationId,
    users: users.map((userId, i) => ({
      userId,
      username: `試験${i}`,
      role: "developer",
    })),
    roleContentAccess: [
      { role: "developer", workspaceIds: ["development"] },
      { role: "manager", workspaceIds: ["development", "management"] },
      { role: "administrator", workspaceIds: [] },
    ],
    credentials: materials.map((m, i) => ({
      credentialId: m.credentialId,
      userId: users[i] ?? "invalid_fixture_user",
      tokenVersion: 1,
      tokenSalt: m.tokenSalt,
      tokenVerifier: m.tokenVerifier,
      revoked: false,
      operationId: i === 0 ? operationId : randomUUID(),
      presentation: "confirmed",
    })),
    registeredRepositories,
    exposure: registeredRepositories.map(({ repositoryId }) => ({
      repositoryId,
      workspaceIds: ["development"],
    })),
    unresolvedKeyExchanges: [],
    initialization: {
      stage: "completed",
      attemptId: operationId,
      initialUserId: users[0],
      initialCredentialId: materials[0].credentialId,
      confirmationCredentialId: materials[0].credentialId,
      connection: "confirmed",
    },
  };
  const current = path.join(owned, "access-management.json");
  fs.writeFileSync(current, JSON.stringify(state));
  assert.equal(
    resolveConnectionAuthentication(root, materials[0].token).status,
    "normal",
  );
  const access = resolveRepositoryAccess(
    root,
    materials[0].token,
    "repository.a",
    "development",
  );
  assert.equal(
    access.status,
    "completed",
    access.status === "unavailable" ? access.reason : undefined,
  );
  const fixtureSurface = await readWorkbenchProjectSurface(
    registeredRepositories[0]?.repositoryRoot ?? "invalid_fixture_repository",
  );
  assert.equal(fixtureSurface.context.projectId, "project.fixture");
  const collection = resolveRepositoryAccessCollection(
    root,
    materials[0].token,
  );
  assert.equal(
    collection.status,
    "completed",
    collection.status === "unavailable" ? collection.reason : undefined,
  );
  if (collection.status !== "completed")
    throw new Error("fixture_collection_unavailable");
  assert.equal(
    readAuthorizedPortfolio(
      collection.repositories,
      new AbortController().signal,
    ).projects.length,
    1,
  );
  let starts = 0,
    cancels = 0,
    closed = 0;
  let owners = 0;
  let revokeDuringObserve = false;
  const saved = new Map<string, WorkbenchAiRequestSnapshot>();
  const configuration: Parameters<typeof startWorkbench>[0] = {
    workingDirectory: repository,
    localAccessRoot: root,
    sharedAiRequestsFactory: (_root, _project, _principal, authorize) => {
      owners++;
      const key = `${resolveVerifiedRepositoryRoot(_root)}:${_principal}`;
      let snapshot: WorkbenchAiRequestSnapshot | null = null;
      /**
       * 所有を確認できないIDへ内容を開示しないSnapshotを返す。
       * @responsibility 不明IDを既存Taskの状態と混同しない。
       * @trace CPR-IT-010
       * @trace CPR-IT-012
       * @precondition 合成Ownerの保存Mapに対象がない。
       * @stimulus 指定IDで未観測結果を構築する。
       * @observation mode未確定と本文なしのSnapshot。
       * @oracle 別主体・別Repositoryの内容を返さない。
       * @cleanup N/A: 値生成だけ。
       * @boundary 有限Ownerから実HTTP公開値。
       */
      const unavailable = (requestId: string): WorkbenchAiRequestSnapshot => ({
        requestId,
        mode: null,
        executionSelection: null,
        status: "unknown",
        reason: "not_available",
        facts: [],
        sharedAnalysis: [],
        additionalInferences: [],
        nextOptions: [],
        candidate: null,
      });
      return {
        start: async (command) => {
          if (!authorize())
            return {
              status: "blocked",
              requestId: null,
              reason: "not_available",
            };
          if (snapshot?.status === "running")
            return {
              status: "blocked",
              requestId: null,
              reason: "already_running",
            };
          starts++;
          const requestId = randomUUID();
          snapshot = {
            ...unavailable(requestId),
            mode: command.mode,
            executionSelection: executionSelection("advice"),
            status: "running",
            reason: null,
          };
          saved.set(`${key}:${requestId}`, snapshot);
          return { status: "accepted", requestId, reason: null };
        },
        observe: async (id) => {
          if (revokeDuringObserve) {
            revokeDuringObserve = false;
            state.revision++;
            const credential = state.credentials[0];
            assert.ok(credential);
            credential.revoked = true;
            fs.writeFileSync(current, JSON.stringify(state));
          }
          return authorize()
            ? (saved.get(`${key}:${id}`) ?? unavailable(id))
            : unavailable(id);
        },
        cancel: async (id) => {
          const original = saved.get(`${key}:${id}`);
          if (!authorize() || !original) return unavailable(id);
          cancels++;
          snapshot = { ...original, status: "cancelled" };
          saved.set(`${key}:${id}`, snapshot);
          return snapshot;
        },
        close: async () => {
          closed++;
        },
      };
    },
  };
  let handle = await startWorkbench(configuration);
  t.after(async () => {
    await handle.close();
  });
  /**
   * 主体ごとの合成資格をHTTPへ渡す。
   * @responsibility 同じ試験主体の資格Headerを構築する。
   * @trace CPR-IT-010
   * @trace CPR-IT-012
   * @precondition 発行済み合成資格の添字を指定する。
   * @stimulus 添字に対応する資格を選ぶ。
   * @observation 認証Header。
   * @oracle 他主体の資格を混在させない。
   * @cleanup N/A: 値構築のみ。
   * @boundary 合成AM資格からHTTP要求Header。
   */
  const headers = (index: number) => ({
    authorization: `Bearer ${materials[index]?.token ?? "invalid_fixture_credential"}`,
  });
  /**
   * 同じ主体で指定Repositoryの画面モデルを取得する。
   * @responsibility 実HTTPの現在認可を画面モデルへ接続する。
   * @trace CPR-IT-010
   * @trace CPR-IT-012
   * @precondition 試験Serverが稼働している。
   * @stimulus 主体とRepositoryを指定して取得する。
   * @observation 応答JSON。
   * @oracle 後続assertで主体・Repository分離を確認する。
   * @cleanup Serverは親Caseで終了する。
   * @boundary Browser相当HTTPからWorkbenchとAM。
   */
  const model = async (index: number, id: string) =>
    (
      await fetch(`${handle.baseUrl}/api/workbench-view?repositoryId=${id}`, {
        headers: headers(index),
      })
    ).json();
  const first = await model(0, "repository.a");
  let actionToken = first.actionToken;
  /**
   * 現在の画面Tokenを同一Originの操作要求へ渡す。
   * @responsibility 主体・Repository・操作入力を実HTTPへ搬送する。
   * @trace CPR-IT-010
   * @trace CPR-IT-012
   * @precondition 取得済みactionTokenがある。
   * @stimulus 操作値をフォームへ符号化して一回送る。
   * @observation HTTP応答。
   * @oracle 後続assertで失効と別主体の拒否を確認する。
   * @cleanup Serverは親Caseで終了する。
   * @boundary HTTPから認可済みTask Owner。
   */
  const action = async (
    index: number,
    repositoryId: string,
    values: Record<string, string>,
  ) =>
    fetch(`${handle.baseUrl}/ai-request/action`, {
      method: "POST",
      headers: {
        ...headers(index),
        origin: handle.baseUrl,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ actionToken, repositoryId, ...values }),
    });
  const command = {
    operation: "start",
    mode: "read_only_advice",
    workType: "",
    prompt: "合成入力",
    externalSendConfirmed: "yes",
    expectedNetworkPolicyHash: "a".repeat(64),
  };
  try {
    assert.equal(first.view, "main");
    assert.equal(first.aiRequest.configured, true);
    assert.equal(starts, 0);
    assert.equal(
      (
        await action(0, "repository.a", {
          ...command,
          expectedNetworkPolicyHash: "",
        })
      ).status,
      400,
    );
    assert.equal(starts, 0);
    const started = await action(0, "repository.a", command);
    assert.equal(started.status, 200);
    const id = (await started.json()).requestId;
    assert.equal(starts, 1);
    assert.equal(
      (await model(0, "repository.a")).aiRequest.snapshot.requestId,
      id,
    );
    assert.equal((await model(1, "repository.a")).aiRequest.snapshot, null);
    assert.equal((await model(0, "repository.b")).aiRequest.snapshot, null);
    assert.equal(
      (await action(1, "repository.a", { operation: "cancel", requestId: id }))
        .status,
      400,
    );
    assert.equal(cancels, 0);
    const other = await action(0, "repository.b", command);
    assert.equal(other.status, 200);
    const otherId = (await other.json()).requestId;
    assert.notEqual(otherId, id);
    assert.equal(
      (
        await action(0, "repository.a", {
          operation: "cancel",
          requestId: otherId,
        })
      ).status,
      400,
    );
    const duplicate = await action(0, "repository.a", command);
    assert.equal((await duplicate.json()).status, "blocked");
    assert.equal(starts, 2);
    assert.equal(
      (await model(0, "repository.a")).aiRequest.snapshot.requestId,
      id,
    );
    assert.equal(
      (await action(0, "repository.a", { operation: "cancel", requestId: id }))
        .status,
      200,
    );
    assert.equal(cancels, 1);
    await handle.close();
    handle = await startWorkbench(configuration);
    actionToken = (await model(0, "repository.a")).actionToken;
    const reentered = await action(0, "repository.a", {
      operation: "observe",
      requestId: id,
    });
    assert.equal(reentered.status, 200);
    assert.equal((await reentered.json()).requestId, id);
    assert.equal(
      (await action(0, "repository.a", { operation: "cancel", requestId: id }))
        .status,
      200,
    );
    assert.equal(starts, 2, "再入場で新依頼を発行しない");
    assert.equal(cancels, 2);
    let networkReads = 0;
    const originalOpen = fs.openSync;
    fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
      if (String(args[0]).endsWith("network-policy.json")) networkReads++;
      return originalOpen(...args);
    }) as typeof fs.openSync;
    syncBuiltinESMExports();
    try {
      await model(0, "repository.a");
      assert.ok(networkReads > 0, "有効設定を開く正対照");
      networkReads = 0;
      revokeDuringObserve = true;
      const revoked = await fetch(
        `${handle.baseUrl}/api/workbench-view?repositoryId=repository.a`,
        { headers: headers(0) },
      );
      assert.equal(revoked.status, 403);
      assert.equal(revokeDuringObserve, false, "先行await内の失効を実行する");
      assert.equal(networkReads, 0, "失効後は通信設定を開かない");
    } finally {
      fs.openSync = originalOpen;
      syncBuiltinESMExports();
    }
    assert.equal(
      (
        await fetch(
          `${handle.baseUrl}/api/workbench-view?repositoryId=repository.a`,
          { headers: headers(0) },
        )
      ).status,
      403,
    );
    assert.equal((await action(0, "repository.a", command)).status, 400);
    assert.equal(starts, 2);
  } finally {
    await handle.close();
  }
  assert.equal(closed, owners);
});

/**
 * 単体Serverの再構成後も元IDへ接続し、新依頼を発行しない。
 * @responsibility 表示用の現在IDを保存済み依頼の所有権と混同しない。
 * @trace CPR-IT-010
 * @precondition 合成の保存済み結果を有限Ownerが返す。
 * @stimulus Serverを再構成し同ID観測・取消と別ID拒否を行う。
 * @observation 実HTTPの応答・表示Snapshotと呼出し件数。
 * @oracle 新規開始0、元ID一致、別IDへの処置0。
 * @cleanup 両Serverをcloseしてlistenerをjoinする。
 * @boundary 単体HTTPから既存Task Owner。永続WriterはCoordinator試験が所有する。
 */
test("単体Task入口は再構成後の元IDを観測・取消へ接続する", async (t) => {
  let cancels = 0;
  const id = "request-before-restart";
  let saved: WorkbenchAiRequestSnapshot = {
    requestId: id,
    mode: "read_only_advice",
    executionSelection: executionSelection("advice"),
    status: "unknown",
    reason: "orchestrator_task_body_unavailable",
    taskId: "task-before-restart",
    cleanupConfirmed: false,
    recoveryIds: ["host.fixture"],
    facts: [],
    sharedAnalysis: [],
    additionalInferences: [],
    nextOptions: [],
    candidate: null,
  };
  const configuration: Parameters<typeof startWorkbench>[0] = {
    workingDirectory: path.resolve(import.meta.dirname, "../../../.."),
    aiRequests: {
      start: async () => {
        throw new Error("reentry_must_not_start");
      },
      observe: async (requestId) =>
        requestId === id
          ? saved
          : {
              ...saved,
              requestId,
              mode: null,
              reason: "orchestrator_task_not_available",
            },
      cancel: async (requestId) => {
        assert.equal(requestId, id);
        cancels++;
        saved = { ...saved, cleanupConfirmed: true, recoveryIds: [] };
        return saved;
      },
      close: async () => {},
    },
  };
  let handle = await startWorkbench(configuration);
  await handle.close();
  handle = await startWorkbench(configuration);
  t.after(() => handle.close());
  /**
   * 再構成後Serverの現在Tokenを実HTTPで取得する。
   * @responsibility 新Server世代の画面モデルを受け取る。
   * @trace CPR-IT-010
   * @trace CPR-IT-012
   * @precondition 同じ保存先でServerを再構成済み。
   * @stimulus workbench-viewを一回取得する。
   * @observation 応答JSONとToken。
   * @oracle 元Taskへの再入場を後続操作で照合する。
   * @cleanup 親CaseがServerを閉じる。
   * @boundary 実HTTPから保存済みOwner参照。
   */
  const model = async () =>
    (await fetch(`${handle.baseUrl}/api/workbench-view`)).json();
  const actionToken = (await model()).actionToken;
  /**
   * 元Task IDを再構成後の公開操作へ渡す。
   * @responsibility 観測と取消を同じIDへ結合する。
   * @trace CPR-IT-010
   * @trace CPR-IT-012
   * @precondition 新世代のactionTokenと元requestIdがある。
   * @stimulus 同一Originで操作を一回送る。
   * @observation HTTP応答。
   * @oracle 後続assertで元ID維持と再送0を確認する。
   * @cleanup 親CaseがServerを閉じる。
   * @boundary 実HTTPから再構成したTask Owner。
   */
  const action = (operation: string, requestId: string) =>
    fetch(`${handle.baseUrl}/ai-request/action`, {
      method: "POST",
      redirect: "manual",
      headers: {
        origin: handle.baseUrl,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ actionToken, operation, requestId }),
    });
  assert.equal((await action("observe", id)).status, 303);
  assert.equal((await model()).aiRequest.snapshot.requestId, id);
  assert.equal((await action("cancel", "other-request")).status, 400);
  assert.equal(cancels, 0);
  assert.equal((await action("cancel", id)).status, 303);
  assert.equal(cancels, 1);
  assert.equal((await model()).aiRequest.snapshot.cleanupConfirmed, true);
});
