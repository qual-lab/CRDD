/**
 * 共有AI入口の主体・Repository分離を実HTTPで検証する。
 * @packageDocumentation
 * @responsibility AMの現在認可を有限Task Ownerの開始・観測・取消へ接続する。
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @trace PRL-IT-012
 * @level IT
 * @scope 自己生成AM、二Repository、二主体と活動ReaderのSource接続。Dockerと外部AIは使わない。
 * @boundary Workbench HTTPとAMの実保存。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { ServerResponse } from "node:http";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import test from "node:test";
import { setImmediate as advanceIo } from "node:timers/promises";
import { createFilesystemStoreRoot } from "../../../access-management/src/initialization/root.ts";
import { deriveRepositoryBindingId } from "../../../access-management/src/repository/binding.ts";
import type { AccessManagementState } from "../../../access-management/src/storage/types.ts";
import { executionSelection } from "../../../coordinator/tests/fixtures/ai-selection.ts";
import { resolveVerifiedRepositoryRoot } from "@qual-lab/crdd-version-control";
import { startWorkbench } from "../../src/app.ts";
import { prepareAiRequestStart } from "../../src/service/execution.ts";
import type { AiRequestSnapshot } from "../../src/app.ts";
import { readProjectViewData } from "../../src/service/project-context.ts";

import { prepareSharedSignIn, testIssuer } from "../support/shared-sign-in.ts";
const testRepositories = [
  { id: 91, full_name: "fixture/repository-a" },
  { id: 92, full_name: "fixture/repository-b" },
] as const;

/**
 * 共通の開始入力作成で単体と共有の既存差を維持する。
 * @responsibility 正規化と拒否の適用範囲を固定する。
 * @trace CPR-IT-010
 * @boundary 値変換のみ。実行・認可・保存は行わない。
 */
test("AI開始入力は単体と共有の既存条件を区別する", () => {
  const input = {
    mode: "workspace_edit",
    explicitChoice: undefined,
    requestId: "fixture",
    workType: "  feature  ",
    prompt: "  test request  ",
    allowedPaths: " src\\child.ts \r\n",
    workspaceId: "  workspace  ",
  };
  const local = prepareAiRequestStart(input, "local");
  const shared = prepareAiRequestStart(input, "shared");
  assert.deepEqual(local.allowedPaths, ["src/child.ts"]);
  assert.deepEqual(shared.allowedPaths, ["src\\child.ts"]);
  assert.equal(local.prompt, "test request");
  assert.equal(shared.prompt, input.prompt);
  assert.equal(local.workType, shared.workType);
  assert.equal(local.workspaceId, shared.workspaceId);
  assert.deepEqual(local.contextReferences, shared.contextReferences);
  assert.ok(Object.isFrozen(local) && Object.isFrozen(local.allowedPaths));
  assert.equal(Object.isFrozen(shared), false);
  for (const origin of ["local", "shared"] as const) {
    assert.throws(
      () => prepareAiRequestStart({ ...input, explicitChoice: null }, origin),
      /workbench_ai_request_choice_invalid/u,
    );
  }
  assert.throws(
    () => prepareAiRequestStart({ ...input, allowedPaths: "" }, "local"),
    /workbench_ai_request_allowed_paths_invalid/u,
  );
  assert.deepEqual(
    prepareAiRequestStart({ ...input, allowedPaths: "" }, "shared")
      .allowedPaths,
    [],
  );
});

/**
 * 活動ReaderがCoordinatorの公開Rootへ直接接続することを確認する。
 * @responsibility 呼出し先のOwner迂回を検出する。
 * @trace PRL-IT-012
 * @precondition Repository内の現行Sourceが読取り可能である。
 * @stimulus 活動ReaderのSourceを読み取る。
 * @observation CoordinatorのModule specifierを取得する。
 * @oracle 統合Rootへの接続を維持する。
 * @cleanup N/A: Sourceの読取りのみ。
 * @boundary Workbench活動Reader→Coordinator公開入口のSource配線。
 */
test("Workbenchの活動Readerは業務Ownerへ直接接続する", () => {
  const source = fs.readFileSync(
    new URL("../../src/service/execution.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /export function createRepositoryWorkbenchActivityReader[\s\S]*?const \{ queryActivity \} = await import\(\s*"@qual-lab\/crdd-coordinator"/u,
  );
});

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
  fs.mkdirSync(parent, { recursive: true });
  const owned = fs.mkdtempSync(path.join(parent, "ai-shared-task-"));
  assert.equal(path.dirname(owned), parent);
  let handle: Awaited<ReturnType<typeof startWorkbench>>;
  t.after(async () => {
    await handle?.close();
    fs.rmSync(owned, { recursive: true, force: true });
    assert.equal(fs.existsSync(owned), false);
  });
  const root = createFilesystemStoreRoot(owned);
  assert.ok(root);
  const users = [randomUUID(), randomUUID()] as const;
  const operationId = randomUUID();
  const subjects = ["synthetic-shared-ai-a", "synthetic-shared-ai-b"] as const;
  const registeredRepositories = testRepositories.map((hosted, index) => {
    const repositoryId = index === 0 ? "repository.a" : "repository.b";
    const target = path.join(owned, repositoryId);
    fs.mkdirSync(target);
    execFileSync("git", ["init", "--quiet", "--template=", target], {
      windowsHide: true,
      stdio: "pipe",
    });
    execFileSync("git", ["config", "protocol.https.allow", "never"], {
      cwd: target,
      windowsHide: true,
    });
    execFileSync(
      "git",
      ["remote", "add", "origin", `https://github.com/${hosted.full_name}.git`],
      { cwd: target, windowsHide: true },
    );
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
      hostedRepository: {
        provider: "github",
        host: "github.com",
        repositoryId: String(hosted.id),
        providerData: { installationId: "24" },
      },
    };
  });
  const state: AccessManagementState = {
    contract: "crdd-access-management/state",
    schemaRevision: 4,
    revision: 2,
    operationId,
    users: users.map((userId, i) => ({
      userId,
      username: `試験${i}`,
      role: "developer",
      accountLinks: [
        {
          issuer: testIssuer,
          subject: subjects[i] ?? "",
          bindingId: randomUUID(),
        },
      ],
    })),
    registeredRepositories,
    initialization: {
      stage: "completed",
      attemptId: operationId,
      initialUserId: users[0],
      connection: "account_confirmed",
    },
  };
  const current = path.join(owned, "access-management.json");
  fs.writeFileSync(current, JSON.stringify(state));
  const fixtureSurface = await readProjectViewData(
    registeredRepositories[0]?.repositoryRoot ?? "invalid_fixture_repository",
  );
  assert.equal(fixtureSurface.context.projectId, "project.fixture");
  const signIn = await prepareSharedSignIn(t, subjects, testRepositories);
  let starts = 0,
    cancels = 0,
    closed = 0;
  let owners = 0;
  let revokeDuringObserve = false;
  let returnOldSnapshotAfterRevocation = false;
  let beforeObserve:
    | ((signal: AbortSignal | undefined) => Promise<void>)
    | undefined;
  const saved = new Map<string, AiRequestSnapshot>();
  const configuration: Parameters<typeof startWorkbench>[0] = {
    workingDirectory: repository,
    localAccessRoot: root,
    ...signIn.options,
    sharedRepositoryRoots: [owned],
    sharedAiRequestsFactory: (_root, _project, _principal, authorize) => {
      owners++;
      const key = `${resolveVerifiedRepositoryRoot(_root)}:${_principal}`;
      let snapshot: AiRequestSnapshot | null = null;
      const completions = new Map<
        string,
        { done: Promise<void>; finish: () => void }
      >();
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
      const unavailable = (requestId: string): AiRequestSnapshot => ({
        resultAvailable: false,
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
        start: async (command, signal, admissionCurrent) => {
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
          const requestId = command.requestId;
          assert.ok(admissionCurrent?.());
          let finish = () => {};
          const done = new Promise<void>((resolve) => {
            finish = resolve;
          });
          completions.set(requestId, { done, finish });
          if (signal?.aborted) finish();
          else signal?.addEventListener("abort", finish, { once: true });
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
        observe: async (id, signal) => {
          if (beforeObserve) {
            const old = saved.get(`${key}:${id}`) ?? unavailable(id);
            await beforeObserve(signal);
            return old;
          }
          if (revokeDuringObserve) {
            revokeDuringObserve = false;
            state.revision++;
            const user = state.users[0];
            assert.ok(user);
            delete user.accountLinks;
            fs.writeFileSync(current, JSON.stringify(state));
            if (returnOldSnapshotAfterRevocation)
              return saved.get(`${key}:${id}`) ?? unavailable(id);
          }
          return authorize()
            ? (saved.get(`${key}:${id}`) ?? unavailable(id))
            : unavailable(id);
        },
        cancel: async (id) => {
          const original = saved.get(`${key}:${id}`);
          if (!authorize() || !original) return unavailable(id);
          cancels++;
          completions.get(id)?.finish();
          snapshot = { ...original, status: "cancelled" };
          saved.set(`${key}:${id}`, snapshot);
          return snapshot;
        },
        close: async () => {
          for (const completion of completions.values()) completion.finish();
          closed++;
        },
        join: async (id) => {
          await completions.get(id)?.done;
        },
      };
    },
  };
  handle = await startWorkbench(configuration);
  const establish = async () => {
    const cookies = [];
    for (const subject of subjects)
      cookies.push(await signIn.signIn(handle.baseUrl, subject));
    return cookies;
  };
  let cookies = await establish();
  /**
   * 主体ごとの確認済みCookieをHTTPへ渡す。
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
    cookie: cookies[index] ?? "invalid_fixture_session",
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
      await fetch(`${handle.baseUrl}/api/workbench/view?repositoryId=${id}`, {
        headers: headers(index),
      })
    ).json();
  const first = await model(0, "repository.a");
  const currentAi = (actor: number, repositoryId: string) =>
    fetch(`${handle.baseUrl}/api/repositories/${repositoryId}/ai-request`, {
      headers: headers(actor),
    });
  const observeAi = (actor: number, repositoryId: string, requestId: string) =>
    fetch(
      `${handle.baseUrl}/api/repositories/${repositoryId}/ai-requests/${encodeURIComponent(requestId)}`,
      { headers: headers(actor) },
    );
  let actionToken = first.actionToken;
  /**
   * 現在の画面Tokenを同一Originの操作要求へ渡す。
   * @responsibility 主体・Repository・操作入力を実HTTPへ搬送する。
   * @trace CPR-IT-010
   * @trace CPR-IT-012
   * @precondition 取得済みactionTokenがある。
   * @stimulus 操作ごとのURLへJSONを一回送る。
   * @observation HTTP応答。
   * @oracle 後続assertで失効と別主体の拒否を確認する。
   * @cleanup Serverは親Caseで終了する。
   * @boundary HTTPから認可済みTask Owner。
   */
  const action = async (
    index: number,
    repositoryId: string,
    { operation, ...values }: Record<string, string>,
  ) => {
    const path = `/api/repositories/${repositoryId}`;
    const endpoint =
      operation === "start"
        ? `${path}/ai-requests`
        : operation === "cancel"
          ? `${path}/ai-requests/${values.requestId}/cancellation`
          : `${path}/ai-request`;
    return fetch(`${handle.baseUrl}${endpoint}`, {
      method: operation === "observe" ? "PUT" : "POST",
      headers: {
        ...headers(index),
        origin: handle.baseUrl,
        "content-type": "application/json",
        "x-crdd-action-token": actionToken,
      },
      body: JSON.stringify(operation === "cancel" ? {} : values),
    });
  };
  const command = {
    operation: "start",
    requestId: "shared-task-request",
    mode: "read_only_advice",
    workType: "",
    prompt: "合成入力",
  };
  try {
    assert.equal(first.view, "main");
    assert.equal(first.aiRequest.configured, true);
    assert.equal((await currentAi(0, "repository.a")).status, 403);
    assert.equal(
      (await observeAi(0, "repository.a", command.requestId)).status,
      403,
    );
    assert.equal(starts, 0);
    assert.equal(
      (
        await action(0, "repository.a", {
          ...command,
          mode: "invalid",
        })
      ).status,
      400,
    );
    assert.equal(starts, 0);
    const started = await action(0, "repository.a", command);
    assert.equal(started.status, 201);
    const id = (await started.json()).requestId;
    assert.equal(starts, 1);
    const progress = await currentAi(0, "repository.a");
    assert.equal(progress.status, 200);
    assert.equal(progress.headers.get("cache-control"), "no-store");
    const snapshot = await progress.json();
    assert.equal(snapshot.requestId, id);
    assert.equal("projectData" in snapshot, false);
    assert.equal("executionActivity" in snapshot, false);
    const direct = await observeAi(0, "repository.a", id);
    assert.equal(direct.status, 200);
    assert.equal((await direct.json()).requestId, id);
    assert.equal((await observeAi(1, "repository.a", id)).status, 403);
    assert.equal((await observeAi(0, "repository.b", id)).status, 403);
    const replacement = registeredRepositories[1];
    const originalTarget = registeredRepositories[0];
    assert.ok(replacement);
    assert.ok(originalTarget);
    const replacementManifest = path.join(
      replacement.repositoryRoot,
      ".crdd",
      "config",
      "repository-manifest.json",
    );
    const manifestBefore = fs.readFileSync(replacementManifest);
    const replacementContext = path.join(
      replacement.repositoryRoot,
      "PROJECT_CONTEXT.md",
    );
    const replacementContextBefore = fs.readFileSync(
      replacementContext,
      "utf8",
    );
    const stateBefore = fs.readFileSync(current);
    try {
      beforeObserve = async (signal) => {
        assert.ok(signal);
        execFileSync(
          "git",
          [
            "remote",
            "set-url",
            "origin",
            `https://github.com/${testRepositories[0].full_name}.git`,
          ],
          { cwd: replacement.repositoryRoot, windowsHide: true },
        );
        fs.writeFileSync(
          replacementManifest,
          JSON.stringify({
            ...JSON.parse(manifestBefore.toString("utf8")),
            repositoryId: "repository.a",
          }),
        );
        fs.writeFileSync(
          replacementContext,
          replacementContextBefore.replace(
            "Repository ID: repository.b",
            "Repository ID: repository.a",
          ),
        );
        const rebound = structuredClone(state);
        rebound.revision++;
        rebound.registeredRepositories = [
          {
            repositoryId: "repository.a",
            repositoryRoot: replacement.repositoryRoot,
            bindingId: deriveRepositoryBindingId(
              "repository.a",
              replacement.repositoryRoot,
            ),
            hostedRepository: originalTarget.hostedRepository,
          },
        ];
        fs.writeFileSync(current, JSON.stringify(rebound));
        const fresh = await model(0, "repository.a");
        assert.equal(fresh.view, "main");
        assert.equal(fresh.selectedRepositoryId, "repository.a");
        assert.equal(fresh.aiRequest.snapshot, null);
      };
      const rebound = await observeAi(0, "repository.a", id);
      assert.equal(rebound.status, 403);
      assert.equal(await rebound.text(), "ai_request_rejected\n");
    } finally {
      beforeObserve = undefined;
      execFileSync(
        "git",
        [
          "remote",
          "set-url",
          "origin",
          `https://github.com/${testRepositories[1].full_name}.git`,
        ],
        { cwd: replacement.repositoryRoot, windowsHide: true },
      );
      fs.writeFileSync(replacementManifest, manifestBefore);
      fs.writeFileSync(replacementContext, replacementContextBefore);
      fs.writeFileSync(current, stateBefore);
    }
    const readPath = `/api/repositories/repository.a/ai-requests/${id}`;
    const controller = new AbortController();
    let entered: (() => void) | undefined;
    let cancelled: (() => void) | undefined;
    const enteredObservation = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const cancelledObservation = new Promise<void>((resolve) => {
      cancelled = resolve;
    });
    const abortWait = AbortSignal.timeout(5000);
    const deadline = new Promise<never>((_, reject) =>
      abortWait.addEventListener(
        "abort",
        () => reject(new Error("fixture_observation_deadline")),
        { once: true },
      ),
    );
    let successBodies = 0;
    const end = ServerResponse.prototype.end;
    const published = t.mock.method(
      ServerResponse.prototype,
      "end",
      function (this: ServerResponse, ...args: Parameters<typeof end>) {
        if (
          new URL(this.req.url ?? "/", handle.baseUrl).pathname === readPath &&
          this.statusCode === 200 &&
          args[0] !== undefined
        )
          successBodies++;
        return end.apply(this, args);
      },
    );
    try {
      const positive = await observeAi(0, "repository.a", id);
      assert.equal(positive.status, 200);
      assert.equal((await positive.json()).requestId, id);
      assert.equal(successBodies, 1);
      successBodies = 0;
      beforeObserve = async (signal) => {
        assert.ok(signal);
        entered?.();
        if (!signal.aborted)
          await Promise.race([
            new Promise<void>((resolve) =>
              signal.addEventListener("abort", () => resolve(), { once: true }),
            ),
            deadline,
          ]);
        cancelled?.();
      };
      const reply = assert.rejects(
        fetch(`${handle.baseUrl}${readPath}`, {
          headers: headers(0),
          signal: controller.signal,
        }),
        { name: "AbortError" },
      );
      await Promise.race([enteredObservation, deadline]);
      controller.abort();
      await Promise.race([
        Promise.all([reply, cancelledObservation]),
        deadline,
      ]);
      await advanceIo();
      assert.equal(successBodies, 0);
    } finally {
      controller.abort();
      beforeObserve = undefined;
      published.mock.restore();
    }
    assert.equal((await currentAi(1, "repository.a")).status, 403);
    assert.equal((await currentAi(0, "repository.b")).status, 403);
    assert.equal(
      (await model(0, "repository.a")).aiRequest.snapshot.requestId,
      id,
    );
    assert.equal((await model(1, "repository.a")).aiRequest.snapshot, null);
    assert.equal((await model(0, "repository.b")).aiRequest.snapshot, null);
    assert.equal(
      (await action(1, "repository.a", { operation: "cancel", requestId: id }))
        .status,
      403,
    );
    assert.equal(cancels, 0);
    const other = await action(0, "repository.b", {
      ...command,
      requestId: "shared-task-request-b",
    });
    assert.equal(other.status, 201);
    const otherId = (await other.json()).requestId;
    assert.notEqual(otherId, id);
    assert.equal(
      (
        await action(0, "repository.a", {
          operation: "cancel",
          requestId: otherId,
        })
      ).status,
      403,
    );
    const duplicate = await action(0, "repository.a", command);
    assert.equal(duplicate.status, 409);
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
    cookies = await establish();
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
    let contextReads = 0;
    const targetContext = path.join(
      originalTarget.repositoryRoot,
      "PROJECT_CONTEXT.md",
    );
    const user = state.users[0];
    assert.ok(user?.accountLinks);
    const accountLinks = user.accountLinks;
    const originalOpen = fs.openSync;
    fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
      if (String(args[0]).endsWith("network-policy.json")) networkReads++;
      if (String(args[0]) === targetContext) contextReads++;
      return originalOpen(...args);
    }) as typeof fs.openSync;
    syncBuiltinESMExports();
    try {
      await model(0, "repository.a");
      assert.ok(contextReads > 0, "画面の本文読取りを測る正対照");
      contextReads = 0;
      networkReads = 0;
      assert.equal((await currentAi(0, "repository.a")).status, 200);
      assert.equal(networkReads, 0, "進行照会は画面構築を実行しない");
      assert.equal(contextReads, 0, "進行照会は画面本文を開かない");
      revokeDuringObserve = true;
      returnOldSnapshotAfterRevocation = true;
      const staleProgress = await currentAi(0, "repository.a");
      assert.equal(staleProgress.status, 403);
      assert.equal(await staleProgress.text(), "ai_request_rejected\n");
      assert.equal(revokeDuringObserve, false, "進行照会のawait中に失効する");
      returnOldSnapshotAfterRevocation = false;
      user.accountLinks = accountLinks;
      state.revision++;
      fs.writeFileSync(current, JSON.stringify(state));
      revokeDuringObserve = true;
      const revoked = await fetch(
        `${handle.baseUrl}/api/workbench/view?repositoryId=repository.a`,
        { headers: headers(0) },
      );
      assert.equal(revoked.status, 403);
      assert.equal(revokeDuringObserve, false, "先行await内の失効を実行する");
      assert.equal(networkReads, 0, "失効後は通信設定を開かない");
      assert.equal((await currentAi(0, "repository.a")).status, 403);
    } finally {
      fs.openSync = originalOpen;
      syncBuiltinESMExports();
    }
    assert.equal(
      (
        await fetch(
          `${handle.baseUrl}/api/workbench/view?repositoryId=repository.a`,
          { headers: headers(0) },
        )
      ).status,
      403,
    );
    assert.equal((await action(0, "repository.a", command)).status, 403);
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
  const id = "current";
  let saved: AiRequestSnapshot = {
    resultAvailable: false,
    requestId: id,
    mode: "read_only_advice",
    executionSelection: executionSelection("advice"),
    status: "unknown",
    reason: "coordinator_task_body_unavailable",
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
              reason: "coordinator_task_not_available",
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
    (await fetch(`${handle.baseUrl}/api/workbench/view`)).json();
  const initial = await model();
  const actionToken = initial.actionToken;
  const aiRequestsPath = `/api/repositories/${initial.projectData.context.repositoryId}/ai-requests`;
  const currentRequestPath = `/api/repositories/${initial.projectData.context.repositoryId}/ai-request`;
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
    fetch(
      `${handle.baseUrl}${operation === "observe" ? currentRequestPath : `${aiRequestsPath}/${requestId}/cancellation`}`,
      {
        method: operation === "observe" ? "PUT" : "POST",
        headers: {
          origin: handle.baseUrl,
          "content-type": "application/json",
          "x-crdd-action-token": actionToken,
        },
        body: JSON.stringify(operation === "observe" ? { requestId } : {}),
      },
    );
  assert.equal(
    (await fetch(`${handle.baseUrl}${currentRequestPath}`)).status,
    403,
  );
  const independent = await fetch(`${handle.baseUrl}${aiRequestsPath}/${id}`);
  assert.equal(independent.status, 200);
  assert.equal((await independent.json()).requestId, "current");
  assert.equal((await action("observe", id)).status, 200);
  assert.equal((await model()).aiRequest.snapshot.requestId, id);
  const progress = await fetch(`${handle.baseUrl}${currentRequestPath}`);
  assert.equal(progress.status, 200);
  assert.equal((await progress.json()).requestId, id);
  assert.equal(
    (await fetch(`${handle.baseUrl}/api/repositories/other/ai-request`)).status,
    403,
  );
  assert.equal(
    (await fetch(`${handle.baseUrl}${currentRequestPath}?repositoryId=other`))
      .status,
    403,
  );
  assert.equal(
    (await fetch(`${handle.baseUrl}${aiRequestsPath}/${id}`)).status,
    200,
  );
  assert.equal(
    (await fetch(`${handle.baseUrl}${aiRequestsPath}/other-request`)).status,
    403,
  );
  assert.equal(
    (
      await fetch(`${handle.baseUrl}${aiRequestsPath}/${id}`, {
        method: "HEAD",
      })
    ).status,
    405,
  );
  assert.equal((await fetch(`${handle.baseUrl}/api/ai-request`)).status, 404);
  assert.equal(
    (await fetch(`${handle.baseUrl}/api/ai-request`, { method: "POST" }))
      .status,
    405,
  );
  assert.equal((await action("cancel", "other-request")).status, 403);
  assert.equal(cancels, 0);
  assert.equal((await action("cancel", id)).status, 200);
  assert.equal(cancels, 1);
  assert.equal((await model()).aiRequest.snapshot.cleanupConfirmed, true);
});
