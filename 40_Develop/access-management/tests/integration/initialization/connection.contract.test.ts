/**
 * 初回用途判定と確認出版の実保存境界を検証する。
 * @packageDocumentation
 * @responsibility 限定候補・一出版・再観測・次要求の通常認証を分離する。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @level IT
 * @scope access-management/credential、初回接続の内部保存断面
 * @boundary 実Filesystem・KDF・Lock・子Process。完全discover／TTY／HTTPは未接続。
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { createFilesystemStoreRoot } from "../../../../domain-model/src/index.ts";
import {
  authenticateNormalConnection,
  confirmInitialConnection,
  updateCredentialPresentationState,
  resolveConnectionAuthentication,
} from "../../../src/index.ts";
import {
  createInitialAdministrator,
  createInitialCredential,
  initializeAccessManagementState,
} from "../../../src/initialization/execution.ts";
import { parseAccessManagementState } from "../../../src/storage/parse.ts";
import type { AccessManagementState } from "../../../src/storage/types.ts";

/**
 * 自己生成Rootで提示確認済みの初回資格まで到達する。
 * @responsibility 本番保存APIを順に使い、試験用の短命鍵を実Hostから分離する。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition 検証済みRepository-localな.crdd/tests。
 * @stimulus 相関・User・資格・提示前後を保存する。
 * @observation 各APIのcompleted、Rootのrealpathと試験材料を確認する。
 * @oracle 生鍵は短命メモリだけ。Surfaceの実提示成立は主張しない。
 * @cleanup t.afterでexact自己生成Rootを回収し不存在を確認する。
 * @boundary AM公開内部保存APIと実Filesystem。
 */
function fixture(t: TestContext) {
  const repository = path.resolve(import.meta.dirname, "../../../../..");
  assert.ok(fs.statSync(path.join(repository, ".git")).isDirectory());
  const parent = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.realpathSync.native(parent), parent);
  const directory = fs.mkdtempSync(
    path.join(parent, "access-initial-connection-"),
  );
  t.after(() => {
    assert.equal(path.dirname(directory), parent);
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    fs.rmSync(directory, { recursive: true });
    assert.equal(fs.existsSync(directory), false);
  });
  const root = createFilesystemStoreRoot(directory);
  assert.ok(root);
  const attemptId = crypto.randomUUID();
  assert.equal(
    initializeAccessManagementState(root, attemptId, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  assert.equal(
    createInitialAdministrator(root, attemptId, "模擬管理者").status,
    "completed",
  );
  const issued = createInitialCredential(root, attemptId);
  assert.ok(issued.status === "completed" && issued.value.token);
  const token = issued.value.token;
  const prepared = updateCredentialPresentationState(root, {
    credentialId: issued.value.credentialId,
    issuanceOperationId: attemptId,
    expectedRevision: issued.value.revision,
    target: "unconfirmed",
  });
  assert.ok(prepared.status === "completed");
  assert.equal(
    updateCredentialPresentationState(root, {
      credentialId: issued.value.credentialId,
      issuanceOperationId: attemptId,
      expectedRevision: prepared.value.revision,
      presentationOperationId: prepared.value.presentationOperationId,
      target: "confirmed",
    }).status,
    "completed",
  );
  const initial = resolveConnectionAuthentication(root, token);
  assert.ok(initial.status === "initial");
  const current = path.join(directory, "access-management.json");
  return { root, directory, current, token, binding: initial.binding };
}

/**
 * 一要求の候補判定と初回出版を通常認証から分離する。
 * @responsibility 二要求の同相関再観測・後続改訂拒否・対象外不変を確認する。
 * @trace RFD-IT-024
 * @precondition 提示確認済み自己生成資格。
 * @stimulus 候補判定、確認二回、通常認証、別改訂後の旧確認を行う。
 * @observation field閉包・byte・改訂・Operation・通常認証・材料不存在。
 * @oracle 初回候補に本人権限なし、一出版だけ、次要求だけ通常認証成功。
 * @cleanup Fixtureが自己生成Rootを回収する。
 * @boundary 同Lockの用途判定と確認保存。HTTP応答は対象外。
 */
test("初回候補は通常Authorityなしで一出版し直後だけ再観測する", (t) => {
  const f = fixture(t);
  const before = fs.readFileSync(f.current);
  const original = JSON.parse(before.toString()) as AccessManagementState;
  assert.equal(
    authenticateNormalConnection(f.root, f.token).status,
    "unavailable",
  );
  const candidate = resolveConnectionAuthentication(f.root, f.token);
  assert.equal(candidate.status, "initial");
  assert.deepEqual(Object.keys(candidate).sort(), ["binding", "status"]);
  assert.deepEqual(fs.readFileSync(f.current), before);
  const confirmed = confirmInitialConnection(
    f.root,
    f.token,
    f.binding,
    new AbortController().signal,
  );
  assert.ok(confirmed.status === "completed");
  assert.equal(confirmed.value.revision, f.binding.expectedRevision + 1);
  const published = fs.readFileSync(f.current);
  const next = JSON.parse(published.toString()) as AccessManagementState;
  assert.equal(next.initialization.stage, "completed");
  assert.notEqual(next.operationId, original.operationId);
  next.revision = original.revision;
  next.operationId = original.operationId;
  next.initialization = original.initialization;
  assert.deepEqual(next, original);
  assert.deepEqual(
    confirmInitialConnection(
      f.root,
      f.token,
      f.binding,
      new AbortController().signal,
    ),
    confirmed,
  );
  assert.deepEqual(fs.readFileSync(f.current), published);
  assert.equal(
    resolveConnectionAuthentication(f.root, f.token).status,
    "normal",
  );
  assert.equal(
    authenticateNormalConnection(f.root, f.token).status,
    "completed",
  );
  const later = JSON.parse(published.toString()) as AccessManagementState;
  later.revision++;
  later.operationId = crypto.randomUUID();
  assert.equal(
    parseAccessManagementState(Buffer.from(JSON.stringify(later))).status,
    "parsed",
  );
  fs.writeFileSync(f.current, JSON.stringify(later));
  assert.equal(
    confirmInitialConnection(
      f.root,
      f.token,
      f.binding,
      new AbortController().signal,
    ).status,
    "unavailable",
  );
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 形式不正と開始前取消を保存・暗号Effectの前で拒否する。
 * @responsibility 相関のaccessor／Proxyを実行せずRoot・KDFを観測しない。
 * @trace RFD-IT-024
 * @precondition 有効形状の非秘密相関と観測拒否Root。
 * @stimulus 四field欠測／余分／不正値／accessor／Proxyと開始前abort。
 * @observation Root trap・KDF・getter件数、publicationとvalue不存在。
 * @oracle 不正・取消は全件Effect 0。
 * @cleanup KDF差替えをfinallyで復元する。
 * @boundary 相関形式とAM入口の開始前Gate。
 */
test("初回確認の閉入力と開始前取消はRootとKDFを呼ばない", (t) => {
  const f = fixture(t);
  let observed = 0;
  const root = new Proxy(f.root, {
    get() {
      observed++;
      throw new Error("root observed");
    },
  });
  const accessor = { ...f.binding };
  Object.defineProperty(accessor, "attemptId", {
    get() {
      observed++;
      throw new Error("getter");
    },
  });
  const proxy = new Proxy(
    { ...f.binding },
    {
      ownKeys() {
        observed++;
        throw new Error("proxy");
      },
    },
  );
  const invalid: unknown[] = [
    null,
    {},
    accessor,
    proxy,
    { ...f.binding, extra: true },
    { ...f.binding, expectedRevision: Number.MAX_SAFE_INTEGER },
    { ...f.binding, credentialId: "bad" },
    { ...f.binding, userId: "bad" },
    { ...f.binding, attemptId: "bad" },
    { ...f.binding, expectedRevision: 0 },
  ];
  const scrypt = crypto.scryptSync;
  crypto.scryptSync = () => {
    observed++;
    throw new Error("KDF");
  };
  try {
    for (const input of invalid) {
      const result = confirmInitialConnection(
        root,
        f.token,
        input,
        new AbortController().signal,
      );
      assert.equal(result.status, "unavailable");
      assert.equal(result.publication, "not_attempted");
      assert.equal("value" in result, false);
    }
    const controller = new AbortController();
    controller.abort();
    assert.equal(
      confirmInitialConnection(root, f.token, f.binding, controller.signal)
        .status,
      "unavailable",
    );
    assert.equal(observed, 0);
  } finally {
    crypto.scryptSync = scrypt;
  }
});

/**
 * 相関各軸・失効・提示・交換をfresh保存状態から再判定する。
 * @responsibility 古い候補を現在状態の確認へ転用しない。
 * @trace RFD-IT-024
 * @precondition 提示確認済みfixtureと元相関。
 * @stimulus 相関四軸差、不正鍵、保存資格失効／提示不明／交換途中を与える。
 * @observation statusとvalue不存在、current byte、材料一覧。
 * @oracle 全拒否は出版0・対象外変更0、用途判定も初回候補を返さない。
 * @cleanup fixtureを回収する。模擬Snapshotの構造検査を別に確認する。
 * @boundary fresh KDF・相関・v2完全状態。
 */
test("初回確認は四相関差と失効・提示不明・交換途中を拒否する", (t) => {
  const f = fixture(t);
  const before = fs.readFileSync(f.current);
  for (const input of [
    { ...f.binding, attemptId: crypto.randomUUID() },
    { ...f.binding, userId: crypto.randomUUID() },
    { ...f.binding, credentialId: "0".repeat(24) },
    { ...f.binding, expectedRevision: f.binding.expectedRevision - 1 },
  ]) {
    const result = confirmInitialConnection(
      f.root,
      f.token,
      input,
      new AbortController().signal,
    );
    assert.equal(result.status, "unavailable");
    assert.equal("value" in result, false);
    assert.deepEqual(fs.readFileSync(f.current), before);
  }
  assert.equal(
    confirmInitialConnection(
      f.root,
      "invalid",
      f.binding,
      new AbortController().signal,
    ).status,
    "unavailable",
  );
  for (const condition of [
    "not_attempted",
    "unconfirmed",
    "exchange",
    "revoked",
  ] as const) {
    const state = JSON.parse(before.toString()) as AccessManagementState;
    const credential = state.credentials[0];
    assert.ok(credential);
    if (condition === "exchange" || condition === "revoked") {
      const operationId = crypto.randomUUID();
      state.unresolvedKeyExchanges = [
        {
          operationId,
          recoveryId: `access-management.key-exchange.${operationId}`,
          entry: "host",
          scope: "targeted",
          recipientUserId: credential.userId,
          oldCredentialIds: [credential.credentialId],
          stage: condition === "revoked" ? "revoked" : "prepared",
        },
      ];
      credential.revoked = condition === "revoked";
    } else credential.presentation = condition;
    const changed = Buffer.from(JSON.stringify(state));
    assert.equal(parseAccessManagementState(changed).status, "parsed");
    fs.writeFileSync(f.current, changed);
    assert.equal(
      resolveConnectionAuthentication(f.root, f.token).status,
      "unavailable",
    );
    assert.equal(
      confirmInitialConnection(
        f.root,
        f.token,
        f.binding,
        new AbortController().signal,
      ).status,
      "unavailable",
    );
    assert.deepEqual(fs.readFileSync(f.current), changed);
  }
});

/**
 * 出版・読戻し・材料清掃・Lock故障後にexact相関で再入場する。
 * @responsibility 既知completedと未出版を分け、再試行で二出版しない。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition 既存pendingなしの初回候補。
 * @stimulus 四故障それぞれで独立fixtureを用い、直接確認と次要求の用途判定を別々に再試行する。
 * @observation 主結果、保存段階、byte、材料保持／不存在、再入場value。
 * @oracle 未出版は保持停止、出版済みだけ同tuple＋1の再観測へ収束。
 * @cleanup 差替えをfinallyで復元しfixtureを回収する。
 * @boundary Node Filesystemと既存Lock。実Hostは使わない。
 */
test("初回確認の故障後は未出版を保持し出版済みだけ再観測する", (t) => {
  for (const entry of ["confirmation", "connection"] as const) {
    for (const failure of ["rename", "readback", "pending", "lock"] as const) {
      const f = fixture(t);
      const rename = fs.renameSync,
        open = fs.openSync,
        remove = fs.rmSync;
      let published = false;
      fs.renameSync = (from, to) => {
        if (failure === "rename") throw new Error("injected rename");
        rename(from, to);
        published = true;
      };
      fs.openSync = (target, flags, mode) => {
        if (
          failure === "readback" &&
          published &&
          String(target).endsWith("access-management.json")
        )
          throw new Error("injected readback");
        return open(target, flags, mode);
      };
      fs.rmSync = (target, options) => {
        if (
          (failure === "pending" &&
            String(target).endsWith("access-management.pending.json")) ||
          (failure === "lock" &&
            String(target).endsWith("access-management.lock"))
        )
          throw new Error("injected cleanup");
        return remove(target, options);
      };
      try {
        const failed = confirmInitialConnection(
          f.root,
          f.token,
          f.binding,
          new AbortController().signal,
        );
        assert.equal(failed.status, "unavailable");
        assert.equal("value" in failed, false);
        assert.equal(failed.cleanupConfirmed, false);
      } finally {
        fs.renameSync = rename;
        fs.openSync = open;
        fs.rmSync = remove;
      }
      const before = fs.readFileSync(f.current);
      if (entry === "connection") {
        const nextRequest = resolveConnectionAuthentication(f.root, f.token);
        assert.deepEqual(fs.readFileSync(f.current), before);
        const state = JSON.parse(before.toString()) as AccessManagementState;
        assert.equal(state.credentials.length, 1);
        assert.equal(state.users.length, 1);
        if (failure === "rename") {
          assert.deepEqual(nextRequest, {
            status: "unavailable",
            reason: "connection_state_unavailable",
          });
          assert.ok(
            fs.existsSync(
              path.join(f.directory, "access-management.pending.json"),
            ),
          );
          assert.ok(
            fs.existsSync(
              path.join(f.directory, "access-management.replace.json"),
            ),
          );
          assert.equal(
            authenticateNormalConnection(f.root, f.token).status,
            "unavailable",
          );
        } else {
          assert.equal(nextRequest.status, "normal");
          assert.deepEqual(fs.readdirSync(f.directory), [
            "access-management.json",
          ]);
          assert.equal(
            authenticateNormalConnection(f.root, f.token).status,
            "completed",
          );
          assert.deepEqual(fs.readFileSync(f.current), before);
        }
        continue;
      }
      const retry = confirmInitialConnection(
        f.root,
        f.token,
        f.binding,
        new AbortController().signal,
      );
      assert.deepEqual(fs.readFileSync(f.current), before);
      if (failure === "rename") {
        assert.equal(retry.status, "unavailable");
        assert.equal(retry.cleanupConfirmed, false);
        assert.equal("value" in retry, false);
        assert.ok(
          fs.existsSync(
            path.join(f.directory, "access-management.pending.json"),
          ),
        );
        assert.ok(
          fs.existsSync(
            path.join(f.directory, "access-management.replace.json"),
          ),
        );
      } else {
        assert.equal(retry.status, "completed");
        assert.equal(retry.revision, f.binding.expectedRevision + 1);
        assert.deepEqual(fs.readdirSync(f.directory), [
          "access-management.json",
        ]);
      }
    }
  }
});

/**
 * 同期保存開始後の取消を保存rollbackへ変換しない。
 * @responsibility 出版結果とConsumerの応答抑止責務を分離する。
 * @trace RFD-IT-024
 * @precondition 内部Signalと実保存候補。HTTPは本試験の対象外。
 * @stimulus rename直後のhookでSignalをabortする。
 * @observation 保存結果・completed状態・Signalを別々に確認する。
 * @oracle 保存は既知completedを保持。Consumerはこの後Signalを再確認すべきで、応答0の実証ではない。
 * @cleanup hook復元、fixture回収。
 * @boundary 同期Filesystemの保存完了と後続利用側の取消確認。
 */
test("同期確認保存後の取消は既知出版を保持する", (t) => {
  const f = fixture(t);
  const controller = new AbortController();
  const rename = fs.renameSync;
  fs.renameSync = (from, to) => {
    rename(from, to);
    controller.abort();
  };
  try {
    const result = confirmInitialConnection(
      f.root,
      f.token,
      f.binding,
      controller.signal,
    );
    assert.equal(result.status, "completed");
    assert.equal(controller.signal.aborted, true);
    assert.equal(
      (JSON.parse(fs.readFileSync(f.current, "utf8")) as AccessManagementState)
        .initialization.stage,
      "completed",
    );
  } finally {
    fs.renameSync = rename;
  }
});

/**
 * 保存途中の実子Process喪失から元相関で再入場する。
 * @responsibility base／nextを区別して既存exact Lock回収と結ぶ。
 * @trace RFD-IT-025
 * @precondition 自己生成Rootと短命の模擬鍵。生鍵を結果へ記録しない。
 * @stimulus pending flush後またはrename後で子Processをexitする。
 * @observation 子終了code・stdout空・current・再入場・残存材料。
 * @oracle baseは保持停止、nextは一出版の再観測・材料不存在。暗黙再発行0。
 * @cleanup 子Processjoin済み、fixtureのexact回収。
 * @boundary 実Node子Process・Filesystem・既存Lock。
 */
test("初回確認の実Process喪失はbase保持とnext再観測を分ける", (t) => {
  for (const phase of ["pending", "renamed"]) {
    const f = fixture(t);
    const domainUrl = new URL(
      "../../../../domain-model/src/index.ts",
      import.meta.url,
    ).href;
    const storeUrl = new URL("../../../src/index.ts", import.meta.url).href;
    const script = `
      import fs from "node:fs";
      import { createFilesystemStoreRoot } from ${JSON.stringify(domainUrl)};
      import { confirmInitialConnection } from ${JSON.stringify(storeUrl)};
      let flushes = 0;
      const flush = fs.fsyncSync;
      fs.fsyncSync = fd => { flush(fd); flushes++; if (${JSON.stringify(phase)} === "pending" && flushes === 2) process.exit(23); };
      const rename = fs.renameSync;
      fs.renameSync = (a,b) => { rename(a,b); if (${JSON.stringify(phase)} === "renamed") process.exit(23); };
      const root = createFilesystemStoreRoot(${JSON.stringify(f.directory)});
      confirmInitialConnection(root, ${JSON.stringify(f.token)}, ${JSON.stringify(f.binding)}, new AbortController().signal);
    `;
    const child = spawnSync(process.execPath, ["--eval", script], {
      timeout: 10_000,
      encoding: "utf8",
    });
    assert.equal(child.error, undefined);
    assert.equal(child.status, 23, child.stderr);
    assert.equal(child.stdout, "");
    const before = fs.readFileSync(f.current);
    const retry = confirmInitialConnection(
      f.root,
      f.token,
      f.binding,
      new AbortController().signal,
    );
    assert.deepEqual(fs.readFileSync(f.current), before);
    assert.equal(
      retry.status,
      phase === "pending" ? "unavailable" : "completed",
    );
    if (phase === "renamed")
      assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
    else
      assert.ok(
        fs.existsSync(path.join(f.directory, "access-management.pending.json")),
      );
  }
});

/**
 * 二つの実Processが同じ相関で初回確認を要求する。
 * @responsibility 一出版と競合後のexact再観測を既存Lockで検証する。
 * @trace RFD-IT-024
 * @precondition 同じ自己生成Rootと元相関。子に渡す鍵は模擬短命値。
 * @stimulus 二つのNode子Processを並行起動し確認保存を要求する。
 * @observation 全子終了、非秘密status、current改訂・出版ID・材料不存在。
 * @oracle completedは一改訂のみ。競合拒否は次のexact再観測で収束し、資格生成0。
 * @cleanup Promise.allSettledで全子をjoin後、fixtureを回収する。
 * @boundary 実Process競合・既存保存Lock・Filesystem。
 */
test("並行Processの初回確認は一出版とexact再観測へ収束する", async (t) => {
  const f = fixture(t);
  const domainUrl = new URL(
    "../../../../domain-model/src/index.ts",
    import.meta.url,
  ).href;
  const storeUrl = new URL("../../../src/index.ts", import.meta.url).href;
  const script = `
    import { createFilesystemStoreRoot } from ${JSON.stringify(domainUrl)};
    import { confirmInitialConnection } from ${JSON.stringify(storeUrl)};
    const result = confirmInitialConnection(createFilesystemStoreRoot(${JSON.stringify(f.directory)}),
      ${JSON.stringify(f.token)}, ${JSON.stringify(f.binding)}, new AbortController().signal);
    process.stdout.write(result.status);
  `;
  const results = await Promise.allSettled(
    [0, 1].map(
      () =>
        new Promise<string>((resolve, reject) => {
          const child = spawn(process.execPath, ["--eval", script], {
            timeout: 10_000,
            stdio: ["ignore", "pipe", "pipe"],
          });
          let output = "",
            errorOutput = "";
          child.stdout.on("data", (data) => {
            output += String(data);
          });
          child.stderr.on("data", (data) => {
            errorOutput += String(data);
          });
          child.on("error", reject);
          child.on("close", (code) => {
            if (code === 0 && errorOutput === "") resolve(output);
            else reject(new Error("fixture child failed"));
          });
        }),
    ),
  );
  const statuses = results.map((result) => {
    assert.ok(result.status === "fulfilled");
    return result.value;
  });
  assert.ok(statuses.includes("completed"));
  assert.ok(
    statuses.every(
      (status) => status === "completed" || status === "unavailable",
    ),
  );
  const before = fs.readFileSync(f.current);
  const state = JSON.parse(before.toString()) as AccessManagementState;
  assert.equal(state.revision, f.binding.expectedRevision + 1);
  assert.equal(state.credentials.length, 1);
  const retry = confirmInitialConnection(
    f.root,
    f.token,
    f.binding,
    new AbortController().signal,
  );
  assert.ok(retry.status === "completed");
  assert.equal(retry.value.operationId, state.operationId);
  assert.deepEqual(fs.readFileSync(f.current), before);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 不正な先行材料を資格成功で清掃・初回成功へ丸めない。
 * @responsibility pending unknownと孤立replaceを保持し用途結果を非開示にする。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition 有効な初回資格と元相関、自己生成の不正材料。
 * @stimulus partial pendingまたは孤立replaceを追加して用途判定・確認を行う。
 * @observation 結果の閉包、currentと材料byte、出版状態。
 * @oracle 両入口とも未取得・成功情報0、current不変、材料保持。
 * @cleanup fixtureが所有した不正材料ごと回収する。
 * @boundary fresh認証後の保存材料観測。
 */
test("不正な先行材料は用途判定と初回確認の両方を停止する", (t) => {
  for (const name of [
    "access-management.pending.json",
    "access-management.replace.json",
  ]) {
    const f = fixture(t);
    const before = fs.readFileSync(f.current);
    const material = path.join(f.directory, name);
    fs.writeFileSync(material, "{invalid fixture");
    assert.deepEqual(resolveConnectionAuthentication(f.root, f.token), {
      status: "unavailable",
      reason: "connection_state_unavailable",
    });
    const result = confirmInitialConnection(
      f.root,
      f.token,
      f.binding,
      new AbortController().signal,
    );
    assert.equal(result.status, "unavailable");
    assert.equal(result.cleanupConfirmed, false);
    assert.equal("value" in result, false);
    assert.deepEqual(fs.readFileSync(f.current), before);
    assert.equal(fs.readFileSync(material, "utf8"), "{invalid fixture");
  }
});
