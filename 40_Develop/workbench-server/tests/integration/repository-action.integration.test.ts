/**
 * 選択RepositoryのGit操作を実HTTPと自己生成Gitで検証する。
 * @packageDocumentation
 * @responsibility 選択Root、一回処置、現在認可、通常公開と結果不明を相関する。
 * @trace RFD-IT-014
 * @trace EST-IT-002
 * @trace EST-IT-010
 * @level IT
 * @scope 自己生成AM・二Repository・local bare Remoteだけを使用する。
 * @boundary Browser操作は別試験。Git開始後の通信切断を観測し、Process tree取消は主張しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import childProcess from "node:child_process";
import { randomUUID } from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { Worker } from "node:worker_threads";
import { ServerResponse } from "node:http";
import test from "node:test";
import {
  createCredentialMaterial,
  type AccessManagementState,
} from "../../../access-management/src/index.ts";
import { deriveRepositoryBindingId } from "../../../access-management/src/state/repository-binding.ts";
import { createFilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import { startWorkbench } from "../../src/index.ts";

/**
 * 当該Git切断試験のWorker通知と終了を有限時間で結合する。
 * @responsibility 無通知終了・異常・期限切れを待機残存にしない。
 * @trace EST-IT-010
 * @precondition この試験が生成したWorkerへ作成直後に接続する。
 * @stimulus 通知、終了、異常または親側の15秒期限。
 * @observation 最初の通知と正常終了を同じWorkerで確認する。
 * @oracle 通知なし・非0終了・異常・期限切れは固定Errorで拒否する。
 * @cleanup 全終了経路でTimerとListenerを解除し、呼出し側がWorkerをterminateする。
 * @boundary 試験専用Workerだけ。製品の取消保証は追加しない。
 */
function observeGitClientWorker(worker: Worker): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let notified = false;
    let observation: unknown;
    const cleanup = () => {
      clearTimeout(deadline);
      worker.off("message", onMessage);
      worker.off("error", onError);
      worker.off("exit", onExit);
    };
    const fail = () => {
      cleanup();
      reject(new Error("owned_git_client_worker_failed"));
    };
    const onMessage = (value: unknown) => {
      notified = true;
      observation = value;
    };
    const onError = () => fail();
    const onExit = (code: number) => {
      if (!notified || code !== 0) return fail();
      cleanup();
      resolve(observation);
    };
    const deadline = setTimeout(fail, 15000);
    worker.once("message", onMessage);
    worker.once("error", onError);
    worker.once("exit", onExit);
  });
}

/**
 * 許可先だけへStage・Commit・確認済み通常Pushを配送する。
 * @responsibility 閉入力、別Root、現在Targetと処置後認可故障を反証する。
 * @trace RFD-IT-014
 * @trace EST-IT-002
 * @trace EST-IT-010
 * @precondition 現在Repository配下の自己生成Rootだけを作成する。
 * @stimulus 四操作、不正Form・確認不足・Target差、処置後失効、注入したProcess失敗。
 * @observation 実GitのIndex／HEAD／local Remote、変更多数、要求専用結果と固定拒否。
 * @oracle 指定先だけが一度変更され、不明・拒否を成功へ畳まない。
 * @cleanup Server終了後、exact所有fixtureの不存在を確認する。
 * @boundary 注入Process失敗を実timeoutやProcess tree清掃の根拠にしない。
 */
test("共有Repository操作は選択Rootと現在Targetへ一度だけ配送する", async (t) => {
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    import.meta.dirname,
  );
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  fs.mkdirSync(testRoot, { recursive: true });
  const fixture = fs.mkdtempSync(
    path.join(testRoot, "workbench-repository-action-"),
  );
  assert.equal(path.dirname(fixture), testRoot);
  let closeServer: (() => Promise<void>) | undefined;
  t.after(async () => {
    await closeServer?.();
    assert.equal(path.dirname(fixture), testRoot);
    fs.rmSync(fixture, { recursive: true, force: true });
    assert.equal(fs.existsSync(fixture), false);
  });
  const originalSpawn = childProcess.spawnSync;
  const roots = [path.join(fixture, "a"), path.join(fixture, "b")];
  const access = path.join(fixture, "access"),
    remote = path.join(fixture, "remote.git");
  fs.mkdirSync(access);
  /**
   * 自己生成Gitだけを準備・再観測する。
   * @responsibility 所有Rootの固定Git引数を同期実行し、正常終了を確認する。
   * @trace RFD-IT-014
   * @precondition Rootはこの試験が作成したfixtureの内側。
   * @stimulus 準備、設定または現在Index／Revisionを読み取る。
   * @observation 正常終了Statusと試験内で比較するstdout。
   * @oracle 非0終了を準備成功や正常観測にしない。
   * @cleanup Gitの同期終了後にfixture全体をt.afterで清掃する。
   * @boundary 自己生成Gitと試験用local Remote。
   */
  const run = (root: string, args: readonly string[]): string => {
    const result = originalSpawn("git", args, {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      shell: false,
      timeout: 30000,
    });
    assert.equal(result.status, 0, "owned_git_command_completed");
    return result.stdout.trim();
  };
  const material = createCredentialMaterial(),
    userId = randomUUID(),
    initialId = randomUUID();
  const state: AccessManagementState = {
    contract: "crdd-access-management/state",
    schemaRevision: 2,
    revision: 1,
    operationId: randomUUID(),
    users: [{ userId, username: "自己生成管理者", role: "administrator" }],
    roleContentAccess: [
      { role: "developer", workspaceIds: ["development"] },
      { role: "manager", workspaceIds: ["development", "management"] },
      { role: "administrator", workspaceIds: ["development"] },
    ],
    credentials: [
      {
        credentialId: material.credentialId,
        userId,
        tokenVersion: 1,
        tokenSalt: material.tokenSalt,
        tokenVerifier: material.tokenVerifier,
        revoked: false,
        operationId: initialId,
        presentation: "confirmed",
      },
    ],
    registeredRepositories: [],
    exposure: [],
    unresolvedKeyExchanges: [],
    initialization: {
      stage: "completed",
      attemptId: initialId,
      initialUserId: userId,
      initialCredentialId: material.credentialId,
      confirmationCredentialId: material.credentialId,
      connection: "confirmed",
    },
  };
  for (const [index, root] of roots.entries()) {
    fs.mkdirSync(root);
    run(fixture, ["init", "--quiet", "--initial-branch=main", root]);
    run(root, ["config", "user.name", "Fixture"]);
    run(root, ["config", "user.email", "fixture@example.invalid"]);
    run(root, ["config", "commit.gpgsign", "false"]);
    const hooks = path.join(fixture, `hooks-${index}`);
    fs.mkdirSync(hooks);
    run(root, ["config", "core.hooksPath", hooks]);
    fs.writeFileSync(path.join(root, ".gitignore"), ".crdd/\n");
    fs.writeFileSync(path.join(root, "work.txt"), "seed\n");
    run(root, ["add", "--", ".gitignore", "work.txt"]);
    run(root, ["commit", "--quiet", "--message", "seed"]);
    fs.mkdirSync(path.join(root, ".crdd", "config"), { recursive: true });
    const repositoryId = `repo.${index}`;
    fs.writeFileSync(
      path.join(root, ".crdd", "config", "repository-manifest.json"),
      JSON.stringify({
        schema: "crdd/repository-manifest/v2",
        projectId: "project.fixture",
        repositoryId,
        displayName: "自己生成",
        repositoryRole: "development",
        capabilities: [],
        contextSurfaces: [],
        externalSendPolicy: null,
      }),
    );
    state.registeredRepositories.push({
      repositoryId,
      repositoryRoot: root,
      bindingId: deriveRepositoryBindingId(repositoryId, root),
    });
    state.exposure.push({ repositoryId, workspaceIds: ["development"] });
  }
  const a = roots[0],
    b = roots[1];
  assert.ok(a && b);
  run(fixture, ["init", "--bare", "--quiet", remote]);
  run(b, ["remote", "add", "origin", remote]);
  run(b, ["push", "--quiet", "--set-upstream", "origin", "main"]);
  const originalHeadA = run(a, ["rev-parse", "HEAD"]);
  const oldHeadB = run(b, ["rev-parse", "HEAD"]);
  fs.writeFileSync(path.join(a, "work.txt"), "a-only\n");
  fs.writeFileSync(path.join(b, "work.txt"), "b-only\n");
  const current = path.join(access, "access-management.json");
  fs.writeFileSync(current, JSON.stringify(state));
  const root = createFilesystemStoreRoot(access);
  assert.ok(root);
  const handle = await startWorkbench({
    workingDirectory: repositoryRoot,
    localAccessRoot: root,
  });
  closeServer = handle.close;
  let mutationCalls = 0,
    revokeAfterMutation = false,
    injectProcessFailure = false;
  const spy = t.mock.method(
    childProcess,
    "spawnSync",
    (
      command: string,
      args: readonly string[],
      options: childProcess.SpawnSyncOptions,
    ) => {
      const mutation =
        command === "git" &&
        ["add", "reset", "commit", "push"].includes(args[0] ?? "") &&
        roots.includes(String(options.cwd));
      if (mutation) mutationCalls++;
      if (mutation && injectProcessFailure)
        return {
          pid: 0,
          output: [],
          stdout: Buffer.alloc(0),
          stderr: Buffer.alloc(0),
          status: null,
          signal: null,
          error: new Error("injected_process_failure"),
        };
      const result = originalSpawn(command, args, options);
      if (mutation && revokeAfterMutation) {
        const next = structuredClone(state);
        next.revision++;
        next.operationId = randomUUID();
        const credential = next.credentials[0];
        assert.ok(credential);
        credential.revoked = true;
        fs.writeFileSync(current, JSON.stringify(next));
      }
      return result;
    },
  );
  syncBuiltinESMExports();
  const originalRead = fs.openSync;
  let changeTargetDuringYield = false,
    targetChangeScheduled = false,
    targetChanged = false;
  const readSpy = t.mock.method(
    fs,
    "openSync",
    (...args: Parameters<typeof originalRead>) => {
      const result = originalRead(...args);
      if (
        changeTargetDuringYield &&
        !targetChangeScheduled &&
        String(args[0]).replaceAll("\\", "/").toLowerCase() ===
          path
            .join(b, ".crdd", "config", "repository-manifest.json")
            .replaceAll("\\", "/")
            .toLowerCase()
      ) {
        targetChangeScheduled = true;
        setTimeout(() => {
          run(b, ["config", "branch.main.merge", "refs/heads/changed"]);
          targetChanged = true;
        }, 0);
      }
      return result;
    },
  );
  syncBuiltinESMExports();
  try {
    const model = (await (
      await fetch(`${handle.baseUrl}/api/workbench-view`, {
        headers: { authorization: `Bearer ${material.token}` },
      })
    ).json()) as { actionToken: string };
    assert.equal(typeof model.actionToken, "string");
    /**
     * 操作別のHTTP入力を固定試験対象へ構成する。
     * @responsibility 通常はrepo.1を指定し、負例のfieldだけ明示変更する。
     * @trace EST-IT-002
     * @precondition 本番Serverから非秘密Action Tokenを取得済み。
     * @stimulus 操作名と試験fieldをForm化する。
     * @observation 実搬送するURLSearchParams。
     * @oracle 追加fieldや別対象を暗黙に補完しない。
     * @cleanup N/A: 要求局所値だけを作る。
     * @boundary 閉Form検査の入力。
     */
    const form = (operation: string, fields: Record<string, string>) =>
      new URLSearchParams({
        actionToken: model.actionToken,
        repositoryId: "repo.1",
        operation,
        ...fields,
      });
    /**
     * 同Origin操作を試験用Serverへ一回搬送する。
     * @responsibility 自己生成資格だけをHeaderへ渡し、応答を再送しない。
     * @trace RFD-IT-014
     * @trace EST-IT-010
     * @precondition 所有Listenerと自己生成AMが稼働している。
     * @stimulus 一件のFormと負例Headerを送る。
     * @observation 実HTTP状態と要求専用結果。
     * @oracle 結果の判断は呼出し元の状態／Effect相関assertが行う。
     * @cleanup 応答消費後、Serverはt.afterで終了する。
     * @boundary 同Hostの実HTTP入力・結果搬送。
     */
    const send = (
      body: URLSearchParams,
      headers: Record<string, string> = {},
    ) =>
      fetch(`${handle.baseUrl}/repository/action`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${material.token}`,
          origin: handle.baseUrl,
          "content-type": "application/x-www-form-urlencoded",
          ...headers,
        },
        body,
      });
    for (const bad of [
      form("prepare", { path: "../outside" }),
      form("prepare", { path: "--all" }),
      form("prepare", { path: "work.txt", force: "true" }),
      form("prepare", { path: "work.txt", repositoryId: "repo.unknown" }),
    ])
      assert.equal((await send(bad)).status, 400);
    const duplicate = form("prepare", { path: "work.txt" });
    duplicate.append("path", "work.txt");
    assert.equal((await send(duplicate)).status, 400);
    assert.equal(
      (
        await send(form("prepare", { path: "work.txt" }), {
          origin: "https://example.invalid",
        })
      ).status,
      400,
    );
    assert.equal(mutationCalls, 0);
    let response = await send(form("prepare", { path: "work.txt" }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reason, "prepare_completed");
    assert.equal(run(b, ["diff", "--cached", "--name-only"]), "work.txt");
    assert.equal(run(a, ["diff", "--cached", "--name-only"]), "");
    response = await send(form("unprepare", { path: "work.txt" }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reason, "unprepare_completed");
    assert.equal(run(b, ["diff", "--cached", "--name-only"]), "");
    await (await send(form("prepare", { path: "work.txt" }))).arrayBuffer();
    response = await send(form("create_revision", { message: "b-only" }));
    assert.equal(response.status, 200);
    const committed = await response.json();
    assert.equal(committed.reason, "revision_created");
    assert.equal(committed.revisionIdentity, run(b, ["rev-parse", "HEAD"]));
    assert.equal(run(a, ["rev-parse", "HEAD"]), originalHeadA);
    assert.notEqual(committed.revisionIdentity, oldHeadB);
    const beforePush = mutationCalls;
    for (const fields of [
      {
        destination: "origin",
        branch: "main",
        revisionIdentity: committed.revisionIdentity,
        humanConfirmed: "false",
      },
      {
        destination: "origin",
        branch: "main",
        revisionIdentity: oldHeadB,
        humanConfirmed: "true",
      },
      {
        destination: remote,
        branch: "main",
        revisionIdentity: committed.revisionIdentity,
        humanConfirmed: "true",
      },
    ])
      assert.equal((await send(form("publish_revision", fields))).status, 400);
    assert.equal(mutationCalls, beforePush);
    changeTargetDuringYield = true;
    response = await send(
      form("publish_revision", {
        destination: "origin",
        branch: "main",
        revisionIdentity: committed.revisionIdentity,
        humanConfirmed: "true",
      }),
    );
    assert.equal(targetChanged, true);
    assert.equal(response.status, 400);
    assert.equal(mutationCalls, beforePush);
    changeTargetDuringYield = false;
    run(b, ["config", "branch.main.merge", "refs/heads/main"]);
    response = await send(
      form("publish_revision", {
        destination: "origin",
        branch: "main",
        revisionIdentity: committed.revisionIdentity,
        humanConfirmed: "true",
      }),
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reason, "publication_confirmed");
    assert.equal(
      run(remote, ["rev-parse", "refs/heads/main"]),
      committed.revisionIdentity,
    );
    assert.equal(mutationCalls, beforePush + 1);
    response = await send(form("create_revision", { message: "empty" }));
    assert.equal(response.status, 200);
    const blocked = await response.json();
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.effectIssued, true);
    assert.equal(blocked.effectConfirmed, false);
    injectProcessFailure = true;
    response = await send(form("unprepare", { path: "work.txt" }));
    assert.equal(response.status, 200);
    const unknown = await response.json();
    assert.equal(unknown.status, "unknown");
    assert.equal(unknown.reason, "repository_effect_unknown");
    assert.equal(unknown.automaticRetryIssued, false);
    injectProcessFailure = false;
    fs.writeFileSync(path.join(b, "work.txt"), "saved-before-loss\n");
    const beforeLoss = mutationCalls;
    revokeAfterMutation = true;
    response = await send(form("prepare", { path: "work.txt" }));
    assert.equal(response.status, 503);
    assert.equal(
      await response.text(),
      "repository_action_outcome_unconfirmed\n",
    );
    assert.equal(mutationCalls, beforeLoss + 1);
    assert.equal(run(b, ["diff", "--cached", "--name-only"]), "work.txt");
    revokeAfterMutation = false;
    fs.writeFileSync(current, JSON.stringify(state));
    await (
      await fetch(`${handle.baseUrl}/api/workbench-view`, {
        headers: { authorization: `Bearer ${material.token}` },
      })
    ).arrayBuffer();
    assert.equal(mutationCalls, beforeLoss + 1);
    const marker = path.join(fixture, "commit-started");
    const hookCode = `require("node:fs").writeFileSync(${JSON.stringify(marker)},"started");setTimeout(()=>{},300);`;
    fs.writeFileSync(
      path.join(fixture, "hooks-1", "pre-commit"),
      `#!/bin/sh\n${JSON.stringify(process.execPath.replaceAll("\\", "/"))} -e '${hookCode.replaceAll("'", "'\\''")}'\n`,
    );
    fs.chmodSync(path.join(fixture, "hooks-1", "pre-commit"), 0o700);
    const beforeCutHead = run(b, ["rev-parse", "HEAD"]),
      beforeCutCalls = mutationCalls;
    let cutResponse: ServerResponse | null = null,
      responseClosed = false,
      successBodies = 0;
    const originalAssign = ServerResponse.prototype.assignSocket,
      originalEnd = ServerResponse.prototype.end;
    const assignSpy = t.mock.method(
      ServerResponse.prototype,
      "assignSocket",
      function (
        this: ServerResponse,
        socket: Parameters<typeof originalAssign>[0],
      ) {
        cutResponse = this;
        this.once("close", () => {
          responseClosed = true;
        });
        return originalAssign.call(this, socket);
      },
    );
    const endSpy = t.mock.method(
      ServerResponse.prototype,
      "end",
      function (this: ServerResponse, ...args: Parameters<typeof originalEnd>) {
        if (
          this === cutResponse &&
          this.statusCode === 200 &&
          args[0] !== undefined
        )
          successBodies++;
        return originalEnd.apply(this, args);
      },
    );
    const worker = new Worker(
      `
      const {parentPort,workerData}=require('node:worker_threads');
      const fs=require('node:fs'),http=require('node:http');
      const request=http.request(workerData.url,{method:'POST',headers:workerData.headers});
      let sent=false,done=false;
      const finish=(observed)=>{if(done)return;done=true;clearInterval(poll);clearTimeout(deadline);request.destroy();parentPort.postMessage({markerObserved:observed,clientDestroyed:request.destroyed});parentPort.close();};
      request.on('error',()=>{});request.on('finish',()=>{sent=true;});
      const poll=setInterval(()=>{if(sent&&fs.existsSync(workerData.marker))finish(true);},5);
      const deadline=setTimeout(()=>finish(false),10000);
      request.end(workerData.body);
    `,
      {
        eval: true,
        workerData: {
          url: `${handle.baseUrl}/repository/action`,
          marker,
          body: form("create_revision", {
            message: "closed-client-commit",
          }).toString(),
          headers: {
            authorization: `Bearer ${material.token}`,
            origin: handle.baseUrl,
            "content-type": "application/x-www-form-urlencoded",
          },
        },
      },
    );
    try {
      const observation = await observeGitClientWorker(worker);
      assert.deepEqual(observation, {
        markerObserved: true,
        clientDestroyed: true,
      });
      await handle.close();
      assert.equal(responseClosed, true);
      assert.equal(successBodies, 0);
      assert.equal(mutationCalls, beforeCutCalls + 1);
      assert.notEqual(run(b, ["rev-parse", "HEAD"]), beforeCutHead);
    } finally {
      await worker.terminate();
      assignSpy.mock.restore();
      endSpy.mock.restore();
    }
  } finally {
    spy.mock.restore();
    readSpy.mock.restore();
    syncBuiltinESMExports();
    await handle.close();
  }
});

/**
 * 通知前に壊れた試験Workerが有限時間で解放されることを確認する。
 * @responsibility Git切断試験自身の無通知終了を反証する。
 * @trace EST-IT-010
 * @precondition Repository操作・Server・Filesystemを使用しない自己生成Workerだけ。
 * @stimulus 起動直後throwと通知前exitを各一回実行する。
 * @observation 固定拒否、Listener解除、Worker終了を確認する。
 * @oracle 待機が残らず、正常観測へ変換されない。
 * @cleanup 各Workerをfinallyでterminateする。生成Fileはない。
 * @boundary 試験待機だけ。製品故障やProcess tree保証へ一般化しない。
 */
test("Git切断試験のWorker異常と無通知終了は待機を残さない", async () => {
  for (const code of ["throw new Error('fixture')", "process.exit(0)"]) {
    const worker = new Worker(code, { eval: true });
    try {
      await assert.rejects(observeGitClientWorker(worker), {
        message: "owned_git_client_worker_failed",
      });
      assert.equal(worker.listenerCount("message"), 0);
      assert.equal(worker.listenerCount("error"), 0);
      assert.equal(worker.listenerCount("exit"), 0);
    } finally {
      await worker.terminate();
    }
    assert.equal(worker.threadId, -1);
  }
});
