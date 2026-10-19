/**
 * 通常管理状態の実Filesystem保存と再入場を検証する。
 * @packageDocumentation
 * @responsibility 純粋Schemaと保存境界を分離し、部分成立を管理操作全体のPassにしない。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @trace RFD-IT-024
 * @level IT
 * @scope access-management/state、直接保存境界
 * @boundary Node Filesystem・既存Root/Lock・通常認可・鍵発行／独立失効／交換保存・提示状態保存と局所TTY代役。実Host・交換の本番提示・実Surface出力は対象外。
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto, { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Writable } from "node:stream";
import test from "node:test";
import { authenticateCredential } from "../../../src/credential/authentication.ts";
import { exchangeFromHost } from "../../../src/credential/exchange.ts";
import { verifyCredentialToken } from "../../../src/credential/token.ts";
import {
  authenticateNormalConnection,
  exchangeCredentials,
  exchangeCredentialsFromHost,
  finishKeyExchange,
  finishKeyExchangeFromHost,
  issueCredential,
  type KeyExchangeResult,
  readCredentialAdministrationState,
  readKeyExchangeState,
  readKeyExchangeStateFromHost,
  updateCredentialPresentationState,
  revokeCredential,
} from "../../../src/index.ts";
import { createInitialCredential } from "../../../src/initialization/execution.ts";
import { parseAccessManagementState } from "../../../src/storage/parse.ts";
import { readAccessManagementState } from "../../../src/storage/store.ts";
import type { AccessManagementState } from "../../../src/storage/types.ts";
import {
  bytes,
  fixture,
  managementFixture,
  prepare,
  prepareInitialUser,
} from "../storage/fixture.ts";

/**
 * 未解決交換中の新資格だけへ提示結果を保存する。
 * @responsibility prepared／revokedと旧資格を拒否し、初回歴史IDを保持する。
 * @trace RFD-IT-017
 * @trace RFD-IT-024
 * @precondition 初回または完了後の単一交換Snapshot。
 * @stimulus 二初回状態×Host／Workbench入口と3交換段階、旧／新資格を渡す。
 * @observation 拒否時byte、成功対象、初回歴史的参照。
 * @oracle 初回Hostおよび完了後両入口の新資格保存段階だけ更新可。prepared／revoked・旧対象は不可。
 * @cleanup Fixtureが自己生成Rootを回収する。
 * @boundary 完全Schema→提示対象判断→実保存。鍵交換Writerの成立ではない。
 */
test("交換中の提示は保存済み新資格だけを対象にする", (t) => {
  for (const completed of [false, true]) {
    for (const entry of ["host", "workbench"] as const) {
      const f = fixture(t);
      const attempt = prepareInitialUser(f);
      const issued = createInitialCredential(f.root, attempt);
      assert.ok(issued.status === "completed");
      const current = path.join(f.directory, "access-management.json");
      const state = JSON.parse(
        fs.readFileSync(current, "utf8"),
      ) as AccessManagementState;
      const old = state.credentials[0];
      const initial = state.initialization;
      assert.ok(old && initial.stage === "credential_stored");
      old.presentation = completed ? "confirmed" : "not_attempted";
      if (completed)
        state.initialization = {
          stage: "completed",
          attemptId: attempt,
          initialUserId: initial.userId,
          initialCredentialId: old.credentialId,
          confirmationCredentialId: old.credentialId,
          connection: "confirmed",
        };
      const operationId = "00000000-0000-4000-8000-000000000014";
      const exchange = {
        stage: "prepared" as const,
        entry,
        scope: "targeted" as const,
        recipientUserId: old.userId,
        operationId,
        recoveryId: `access-management.key-exchange.${operationId}`,
        oldCredentialIds: [old.credentialId],
      };
      const oldUpdate = {
        credentialId: old.credentialId,
        issuanceOperationId: attempt,
        expectedRevision: state.revision,
        target: completed ? "confirmed" : "unconfirmed",
        ...(completed ? { presentationOperationId: state.operationId } : {}),
      };
      for (const stage of ["prepared", "revoked"] as const) {
        old.revoked = stage === "revoked";
        state.unresolvedKeyExchanges = [{ ...exchange, stage }];
        fs.writeFileSync(current, bytes(state));
        const before = fs.readFileSync(current);
        assert.equal(
          updateCredentialPresentationState(f.root, oldUpdate).status,
          "unavailable",
        );
        assert.deepEqual(fs.readFileSync(current), before);
      }
      const newId = "abcdef0123456789abcdef01";
      state.credentials.push({
        ...old,
        credentialId: newId,
        operationId,
        revoked: false,
        presentation: "not_attempted",
      });
      state.unresolvedKeyExchanges = [
        { ...exchange, stage: "credential_stored", newCredentialId: newId },
      ];
      if (!completed) initial.confirmationCredentialId = newId;
      fs.writeFileSync(current, bytes(state));
      const before = fs.readFileSync(current);
      assert.equal(
        updateCredentialPresentationState(f.root, oldUpdate).status,
        "unavailable",
      );
      assert.deepEqual(fs.readFileSync(current), before);
      const result = updateCredentialPresentationState(f.root, {
        credentialId: newId,
        issuanceOperationId: operationId,
        expectedRevision: state.revision,
        target: "unconfirmed",
      });
      assert.equal(
        result.status === "completed",
        completed || entry === "host",
      );
      const saved = JSON.parse(
        fs.readFileSync(current, "utf8"),
      ) as AccessManagementState;
      assert.deepEqual(saved.initialization, state.initialization);
    }
  }
});

/**
 * 初回Host交換の失効途中を認証成功へ昇格しない。
 * @responsibility 保存Schemaの受理と有効資格・通常接続の成立を区別する。
 * @trace RFD-IT-013
 * @trace RFD-IT-024
 * @precondition 自己生成Rootにv2初回資格を保存する。
 * @stimulus 同資格をHost交換のrevoked段階へ構成し、公開readと両認証入口を呼ぶ。
 * @observation read結果、固定認証拒否、current byteとDirectory一覧。
 * @oracle 途中記録は読取り可能だが失効資格の本人・通常認証は拒否。状態を修復・初期化・再発行しない。
 * @cleanup Fixtureが所有Rootを削除し不存在を確認する。
 * @boundary v2 Parser→実Filesystem Reader→AM認証。Host交換Writerの成立は主張しない。
 */
test("初回Host交換のrevoked参照は保存可能でも認証を許可しない", (t) => {
  const f = fixture(t);
  const issued = createInitialCredential(f.root, prepareInitialUser(f));
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed" || !issued.value.token)
    throw new Error("fixture credential unavailable");
  const current = path.join(f.directory, "access-management.json");
  const state = JSON.parse(
    fs.readFileSync(current, "utf8"),
  ) as AccessManagementState;
  const initial = state.initialization;
  const credential = state.credentials[0];
  assert.ok(initial.stage === "credential_stored" && credential);
  assert.equal(state.schemaRevision, 2);
  assert.equal(initial.initialCredentialId, credential.credentialId);
  assert.equal(initial.confirmationCredentialId, credential.credentialId);
  credential.revoked = true;
  const operationId = "00000000-0000-4000-8000-000000000077";
  state.unresolvedKeyExchanges = [
    {
      stage: "revoked",
      operationId,
      recoveryId: `access-management.key-exchange.${operationId}`,
      entry: "host",
      scope: "targeted",
      recipientUserId: initial.userId,
      oldCredentialIds: [credential.credentialId],
    },
  ];
  assert.equal(parseAccessManagementState(bytes(state)).status, "parsed");
  fs.writeFileSync(current, bytes(state));
  const before = fs.readFileSync(current);
  const names = fs.readdirSync(f.directory).sort();
  assert.equal(readAccessManagementState(f.root).status, "completed");
  for (const authenticate of [
    authenticateCredential,
    authenticateNormalConnection,
  ]) {
    assert.deepEqual(authenticate(f.root, issued.value.token), {
      status: "unavailable",
      reason: "credential_authentication_rejected",
    });
  }
  assert.deepEqual(fs.readFileSync(current), before);
  assert.deepEqual(fs.readdirSync(f.directory).sort(), names);
});

/**
 * 資格管理一覧は一改訂の現在管理者へ非秘密値だけを返す。
 * @responsibility User・資格・交換を同じ状態から選び、一覧のAuthority化を拒否する。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 自己生成Storeに三Role資格と初回完了状態。
 * @stimulus 三Role、同鍵の降格、交換保存後の一覧を読む。
 * @observation field閉集合、凍結値、版番号、元交換相関、保存byte不変。
 * @oracle 現在administratorだけcompleted。秘密・内容・Pathなし、降格は次要求で拒否。
 * @cleanup Fixtureが自己生成Rootを回収する。
 * @boundary AM非秘密Reader。Workbench／HTTP／Browserの完成ではない。
 */
test("資格管理一覧は現在管理者に同改訂の対象と交換だけを返す", (t) => {
  const f = managementFixture(t);
  const current = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(current);
  const unavailable = {
    status: "unavailable",
    reason: "credential_administration_unavailable",
  };
  for (const token of [f.tokens.manager, f.tokens.developer, "invalid"])
    assert.deepEqual(
      readCredentialAdministrationState(f.root, token),
      unavailable,
    );
  const result = readCredentialAdministrationState(
    f.root,
    f.tokens.administrator,
  );
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  const snapshot = result.snapshot;
  assert.deepEqual(Object.keys(snapshot).sort(), [
    "actorUserId",
    "credentials",
    "exchange",
    "revision",
    "users",
  ]);
  assert.equal(snapshot.revision, 1);
  assert.equal(snapshot.actorUserId, f.state.users[0]?.userId);
  assert.equal(snapshot.exchange, null);
  assert.deepEqual(snapshot.users, f.state.users);
  assert.equal(snapshot.credentials.length, 3);
  for (const item of snapshot.credentials) {
    assert.deepEqual(Object.keys(item).sort(), [
      "credentialId",
      "issuanceOperationId",
      "presentation",
      "revoked",
      "userId",
    ]);
    assert.equal(Object.isFrozen(item), true);
  }
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.users), true);
  assert.equal(Object.isFrozen(snapshot.credentials), true);
  for (const credential of f.state.credentials) {
    assert.equal(
      JSON.stringify(snapshot).includes(credential.tokenSalt),
      false,
    );
    assert.equal(
      JSON.stringify(snapshot).includes(credential.tokenVerifier),
      false,
    );
  }
  assert.deepEqual(fs.readFileSync(current), before);
  const target = f.state.credentials[1];
  assert.ok(target);
  const exchanged = exchangeCredentialsFromHost(
    f.root,
    1,
    "00000000-0000-4000-8000-000000000090",
    "targeted",
    target.userId,
    [target.credentialId],
    true,
  );
  assert.equal(exchanged.status, "completed");
  const observed = readCredentialAdministrationState(
    f.root,
    f.tokens.administrator,
  );
  assert.equal(observed.status, "completed");
  if (observed.status !== "completed") return;
  assert.equal(observed.snapshot.revision, 4);
  assert.equal(observed.snapshot.exchange?.stage, "credential_stored");
  assert.equal(
    observed.snapshot.exchange?.operationId,
    "00000000-0000-4000-8000-000000000090",
  );
  assert.equal(observed.snapshot.credentials.length, 4);
  const saved = JSON.parse(
    fs.readFileSync(current, "utf8"),
  ) as AccessManagementState;
  const actor = saved.users[0];
  assert.ok(actor);
  actor.role = "manager";
  fs.writeFileSync(current, bytes(saved));
  assert.deepEqual(
    readCredentialAdministrationState(f.root, f.tokens.administrator),
    unavailable,
  );
});

/**
 * 未解決交換と先行材料がある通常鍵変更を止める。
 * @responsibility 未解決の固定資格集合を別操作から変えない。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 管理資格と保存済みprepared交換、または不正pending。
 * @stimulus 同対象への通常発行・独立失効。
 * @observation current byte、生成乱数件数、交換／pendingの保持。
 * @oracle 新発行・新失効・再出版0。元材料を清掃成功にしない。
 * @cleanup 乱数差替え復元とFixture回収。
 * @boundary 既存交換の保全と通常保存Gate。
 */
test("通常鍵変更は未解決交換と先行材料を保持する", (t) => {
  for (const mode of ["exchange", "pending"] as const) {
    const f = managementFixture(t);
    const userId = f.state.users[0]?.userId;
    const credentialId = f.state.credentials[0]?.credentialId;
    assert.ok(userId && credentialId);
    if (mode === "exchange") {
      const operationId = "00000000-0000-4000-8000-000000000091";
      f.state.unresolvedKeyExchanges.push({
        recoveryId: `access-management.key-exchange.${operationId}`,
        operationId,
        entry: "workbench",
        scope: "all",
        recipientUserId: userId,
        oldCredentialIds: f.state.credentials.map((item) => item.credentialId),
        stage: "prepared",
      });
      assert.equal(parseAccessManagementState(bytes(f.state)).status, "parsed");
    } else
      fs.writeFileSync(
        path.join(f.directory, "access-management.pending.json"),
        "{",
      );
    const current = path.join(f.directory, "access-management.json");
    fs.writeFileSync(current, bytes(f.state));
    const before = fs.readFileSync(current);
    const random = crypto.randomBytes;
    let generated = 0;
    crypto.randomBytes = (() => {
      generated++;
      throw new Error("unexpected_generation");
    }) as typeof crypto.randomBytes;
    try {
      assert.equal(
        issueCredential(
          f.root,
          f.tokens.administrator,
          1,
          "00000000-0000-4000-8000-000000000092",
          userId,
        ).status,
        "unavailable",
      );
      assert.equal(
        revokeCredential(
          f.root,
          f.tokens.administrator,
          1,
          "00000000-0000-4000-8000-000000000093",
          userId,
          credentialId,
        ).status,
        "unavailable",
      );
      assert.equal(generated, 0);
    } finally {
      crypto.randomBytes = random;
    }
    assert.deepEqual(fs.readFileSync(current), before);
    if (mode === "pending")
      assert.equal(
        fs.readFileSync(
          path.join(f.directory, "access-management.pending.json"),
          "utf8",
        ),
        "{",
      );
  }
});

/**
 * 四経路を同Lockの三出版と一生成へ接続する。
 * @responsibility 自己／全員失効後の同要求再認証をせず、別要求では再認可する。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 自己生成Rootと三Role資格。指定対象は管理者自身。
 * @stimulus Workbench／Host×指定／全員とstoredのexact再入場。
 * @observation 改訂・固定旧集合・失効・新Verifier、KDF／乱数、token、未解決recordと非対象情報。
 * @oracle 三出版で一新資格。新規成功だけtoken、旧鍵拒否、Host再入場はtoken null・生成0。
 * @cleanup crypto復元とFixture回収。
 * @boundary 実保存・現在認証・暗号生成。提示本番入口ではない。
 */
test("鍵交換保存は四経路で自己失効後も同要求だけを完了する", (t) => {
  for (const entry of ["workbench", "host"] as const)
    for (const scope of ["targeted", "all"] as const) {
      const f = managementFixture(t);
      const userId = f.state.users[0]?.userId;
      assert.ok(userId);
      const ids = f.state.credentials
        .filter((c) => scope === "all" || c.userId === userId)
        .map((c) => c.credentialId);
      const operationId = "00000000-0000-4000-8000-000000000090";
      const random = crypto.randomBytes;
      const scrypt = crypto.scryptSync;
      let generated = 0;
      let kdf = 0;
      crypto.randomBytes = ((size: number) => {
        generated++;
        return random(size);
      }) as typeof crypto.randomBytes;
      crypto.scryptSync = ((...args) => {
        kdf++;
        return scrypt(...args);
      }) as typeof crypto.scryptSync;
      let result: KeyExchangeResult;
      try {
        result =
          entry === "workbench"
            ? exchangeCredentials(
                f.root,
                f.tokens.administrator,
                1,
                operationId,
                scope,
                userId,
                ids,
                scope === "all",
              )
            : exchangeCredentialsFromHost(
                f.root,
                1,
                operationId,
                scope,
                userId,
                ids,
                true,
              );
        assert.equal(generated, 3);
        assert.equal(kdf, entry === "host" ? 1 : 2);
      } finally {
        crypto.randomBytes = random;
        crypto.scryptSync = scrypt;
      }
      assert.equal(result.status, "completed");
      if (result.status !== "completed") continue;
      assert.equal(result.revision, 4);
      assert.equal(result.lastConfirmedStage, "credential_stored");
      assert.equal(typeof result.token, "string");
      const saved = JSON.parse(
        fs.readFileSync(
          path.join(f.directory, "access-management.json"),
          "utf8",
        ),
      ) as AccessManagementState;
      assert.equal(saved.revision, 4);
      assert.equal(saved.unresolvedKeyExchanges.length, 1);
      assert.deepEqual(saved.unresolvedKeyExchanges[0], {
        stage: "credential_stored",
        recoveryId: result.recoveryId,
        operationId,
        entry,
        scope,
        recipientUserId: userId,
        oldCredentialIds: ids,
        newCredentialId: result.credentialId,
      });
      for (const credential of saved.credentials.slice(0, 3))
        assert.equal(credential.revoked, ids.includes(credential.credentialId));
      const issued = saved.credentials[3];
      assert.ok(issued && result.token);
      assert.equal(issued.presentation, "not_attempted");
      assert.equal(verifyCredentialToken(result.token, issued), true);
      assert.equal(
        fs
          .readFileSync(
            path.join(f.directory, "access-management.json"),
            "utf8",
          )
          .includes(result.token),
        false,
      );
      assert.deepEqual(saved.users, f.state.users);
      assert.deepEqual(saved.roleContentAccess, f.state.roleContentAccess);
      assert.deepEqual(
        saved.registeredRepositories,
        f.state.registeredRepositories,
      );
      assert.deepEqual(saved.exposure, f.state.exposure);
      assert.deepEqual(saved.initialization, f.state.initialization);
      assert.equal(
        authenticateNormalConnection(f.root, f.tokens.administrator).status,
        "unavailable",
      );
      generated = 0;
      crypto.randomBytes = (() => {
        generated++;
        throw new Error("unexpected_generation");
      }) as typeof crypto.randomBytes;
      try {
        const observed = exchangeCredentialsFromHost(
          f.root,
          4,
          operationId,
          scope,
          userId,
          ids,
          true,
        );
        assert.equal(observed.status, "completed");
        if (observed.status === "completed") {
          assert.equal(observed.token, null);
          assert.equal(observed.entry, entry);
          assert.equal(observed.revision, 4);
        }
        assert.equal(generated, 0);
      } finally {
        crypto.randomBytes = random;
      }
      assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
    }
});

/**
 * 三出版のprepare・rename・読戻し・清掃故障を分ける。
 * @responsibility 意図したnextから確定段階やRecoveryを推定しない。
 * @trace RFD-IT-017
 * @precondition 実Rootと三Role資格。各出版位置に一故障を注入する。
 * @stimulus prepared／revoked／credential_stored×prepare／publish／read_back／cleanup。
 * @observation 最初の失敗、最後の確認段階、Recovery、Secret0、実currentとpending、再入場。
 * @oracle base材料は保持停止、next材料処置要求は停止し次要求だけ継続、stored再生成0。
 * @cleanup fs／crypto差替え復元とFixture回収。
 * @boundary 三出版・耐久現在状態・短命材料と結果返却。
 */
test("鍵交換保存は三出版の故障と確定済み段階を分離する", (t) => {
  for (const phase of [1, 2, 3])
    for (const fault of [
      "prepare",
      "publish",
      "read_back",
      "cleanup",
    ] as const) {
      const f = managementFixture(t);
      const userId = f.state.users[0]?.userId;
      assert.ok(userId);
      const ids = [f.state.credentials[0]?.credentialId];
      assert.ok(ids[0]);
      const operationId = "00000000-0000-4000-8000-000000000090";
      const current = path.join(f.directory, "access-management.json");
      const pending = path.join(f.directory, "access-management.pending.json");
      const rename = fs.renameSync;
      const open = fs.openSync;
      const remove = fs.rmSync;
      const random = crypto.randomBytes;
      let renames = 0;
      let preparations = 0;
      let generated = 0;
      fs.renameSync = (from, to) => {
        renames++;
        if (fault === "publish" && renames === phase)
          throw new Error("injected_publish");
        return rename(from, to);
      };
      fs.openSync = (file, flags, mode) => {
        if (String(file) === pending && flags === "wx") {
          preparations++;
          if (fault === "prepare" && preparations === phase)
            throw new Error("injected_prepare");
        }
        if (
          fault === "read_back" &&
          String(file) === current &&
          renames === phase
        )
          throw new Error("injected_readback");
        return open(file, flags, mode);
      };
      fs.rmSync = (file, options) => {
        if (
          fault === "cleanup" &&
          String(file) === pending &&
          renames === phase
        )
          throw new Error("injected_cleanup");
        return remove(file, options);
      };
      crypto.randomBytes = ((size: number) => {
        generated++;
        return random(size);
      }) as typeof crypto.randomBytes;
      let result: KeyExchangeResult;
      try {
        result = exchangeCredentialsFromHost(
          f.root,
          1,
          operationId,
          "targeted",
          userId,
          ids,
          true,
        );
      } finally {
        fs.renameSync = rename;
        fs.openSync = open;
        fs.rmSync = remove;
        crypto.randomBytes = random;
      }
      assert.equal(result.status, "unavailable");
      assert.equal(Object.hasOwn(result, "token"), false);
      if (
        result.status !== "unavailable" ||
        result.reason !== "key_exchange_unavailable"
      )
        continue;
      assert.equal(result.firstFailure, fault);
      assert.equal(result.secondaryFailure, null);
      const stages = [
        "not_started",
        "prepared",
        "revoked",
        "credential_stored",
      ];
      assert.equal(
        result.lastConfirmedStage,
        stages[fault === "cleanup" ? phase : phase - 1],
      );
      assert.equal(
        result.recoveryId === null,
        phase === 1 && fault !== "cleanup",
      );
      assert.equal(generated, phase === 3 ? 3 : 0);
      const saved = JSON.parse(
        fs.readFileSync(current, "utf8"),
      ) as AccessManagementState;
      assert.equal(
        saved.revision,
        (fault === "read_back" || fault === "cleanup" ? phase : phase - 1) + 1,
      );
      const before = fs.readFileSync(current);
      if (fault === "publish") {
        let retried = 0;
        crypto.randomBytes = (() => {
          retried++;
          throw new Error("unexpected_generation");
        }) as typeof crypto.randomBytes;
        try {
          const stopped = exchangeCredentialsFromHost(
            f.root,
            saved.revision,
            operationId,
            "targeted",
            userId,
            ids,
            true,
          );
          assert.equal(stopped.status, "unavailable");
          assert.equal(retried, 0);
        } finally {
          crypto.randomBytes = random;
        }
        assert.deepEqual(fs.readFileSync(current), before);
        assert.equal(fs.existsSync(pending), true);
      } else {
        if (fault === "read_back" || fault === "cleanup") {
          assert.equal(
            exchangeCredentialsFromHost(
              f.root,
              saved.revision,
              operationId,
              "targeted",
              userId,
              ids,
              true,
            ).status,
            "unavailable",
          );
          assert.deepEqual(fs.readFileSync(current), before);
          assert.deepEqual(fs.readdirSync(f.directory), [
            "access-management.json",
          ]);
        }
        const resumed = exchangeCredentialsFromHost(
          f.root,
          saved.revision,
          operationId,
          "targeted",
          userId,
          ids,
          true,
        );
        assert.equal(resumed.status, "completed");
        if (
          resumed.status === "completed" &&
          (fault === "read_back" || fault === "cleanup") &&
          phase === 3
        )
          assert.equal(resumed.token, null);
      }
    }
});

/**
 * 認可拒否Actorに先行材料を処置させない。
 * @responsibility 現在Role・確認・相関をpending清掃より前に検査する。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 三Roleとbase／next一致の模擬通常pending。
 * @stimulus 非管理者と確認欠落、不正表示配列を渡す。
 * @observation 固定拒否・current／pending／replace byte・生成0。
 * @oracle 拒否時材料不変、鍵・資格Effect0。
 * @cleanup Fixture回収。
 * @boundary 現在認可と既存材料処置。
 */
test("鍵交換保存は拒否Actorの先行材料処置と生成を行わない", (t) => {
  for (const published of [false, true]) {
    const f = managementFixture(t);
    const userId = f.state.users[0]?.userId;
    assert.ok(userId);
    const next = structuredClone(f.state);
    next.revision = 2;
    next.operationId = "00000000-0000-4000-8000-000000000089";
    prepare(f, next);
    if (published)
      fs.writeFileSync(
        path.join(f.directory, "access-management.json"),
        bytes(next),
      );
    const before = fs
      .readdirSync(f.directory)
      .map((file) => [file, fs.readFileSync(path.join(f.directory, file))]);
    for (const token of [f.tokens.manager, f.tokens.developer])
      assert.deepEqual(
        exchangeCredentials(
          f.root,
          token,
          published ? 2 : 1,
          "00000000-0000-4000-8000-000000000090",
          "targeted",
          userId,
          [f.state.credentials[0]?.credentialId],
          false,
        ),
        { status: "unavailable", reason: "key_exchange_rejected" },
      );
    assert.deepEqual(
      fs
        .readdirSync(f.directory)
        .map((file) => [file, fs.readFileSync(path.join(f.directory, file))]),
      before,
    );
  }
});

/**
 * 初回Host指定と完了後の歴史ID保持を実保存で反証する。
 * @responsibility 新資格と最新確認Bindingを同改訂へ保存する。
 * @trace RFD-IT-017
 * @trace RFD-IT-024
 * @precondition 一管理者の初回資格段階。
 * @stimulus 元資格へのHost指定交換を実行する。
 * @observation 三段階保存、新確認ID・元初資格・元試行・旧失効。
 * @oracle 新確認だけ結替え、初回completed／通常Authorityは未成立。
 * @cleanup Fixture回収。
 * @boundary 交換保存と初回確認のBinding。
 */
test("鍵交換保存は初回Host指定の確認対象だけを結替える", (t) => {
  const f = managementFixture(t);
  const admin = f.state.users[0];
  const old = f.state.credentials[0];
  assert.ok(admin && old);
  f.state.users = [admin];
  f.state.credentials = [old];
  old.operationId = f.state.initialization.attemptId;
  f.state.initialization = {
    stage: "credential_stored",
    attemptId: old.operationId,
    userId: admin.userId,
    initialCredentialId: old.credentialId,
    confirmationCredentialId: old.credentialId,
  };
  fs.writeFileSync(
    path.join(f.directory, "access-management.json"),
    bytes(f.state),
  );
  const result = exchangeCredentialsFromHost(
    f.root,
    1,
    "00000000-0000-4000-8000-000000000090",
    "targeted",
    admin.userId,
    [old.credentialId],
    true,
  );
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  const saved = JSON.parse(
    fs.readFileSync(path.join(f.directory, "access-management.json"), "utf8"),
  ) as AccessManagementState;
  assert.equal(saved.initialization.stage, "credential_stored");
  if (saved.initialization.stage !== "credential_stored") return;
  assert.equal(saved.initialization.attemptId, old.operationId);
  assert.equal(saved.initialization.initialCredentialId, old.credentialId);
  assert.equal(
    saved.initialization.confirmationCredentialId,
    result.credentialId,
  );
  assert.equal(saved.credentials[0]?.revoked, true);
  assert.equal(
    authenticateNormalConnection(f.root, result.token ?? "").status,
    "unavailable",
  );
});

/**
 * 最初の出版故障をLock解放不明で上書きしない。
 * @responsibility 保存Failureと資源解放の別事実を保持する。
 * @trace RFD-IT-017
 * @precondition prepared出版後の自己生成Root。
 * @stimulus revoked rename失敗とLock削除失敗、またはstored後のLock削除失敗。
 * @observation first／secondary Failure、最後の確認段階、token0。
 * @oracle 主失敗を保持し、stored既知でも解放不明ならtokenを返さない。
 * @cleanup Hook復元とFixture回収。
 * @boundary 出版結果と外側Lockの解放。
 */
test("鍵交換保存は主Failureと解放不明を分離する", (t) => {
  for (const publishFailure of [false, true]) {
    const f = managementFixture(t);
    const userId = f.state.users[0]?.userId;
    assert.ok(userId);
    const rename = fs.renameSync;
    const remove = fs.rmSync;
    let renames = 0;
    fs.renameSync = (from, to) => {
      renames++;
      if (publishFailure && renames === 2) throw new Error("injected_publish");
      return rename(from, to);
    };
    fs.rmSync = (file, options) => {
      if (String(file) === path.join(f.directory, "access-management.lock"))
        throw new Error("injected_release");
      return remove(file, options);
    };
    let result: KeyExchangeResult;
    try {
      result = exchangeCredentialsFromHost(
        f.root,
        1,
        "00000000-0000-4000-8000-000000000090",
        "targeted",
        userId,
        [f.state.credentials[0]?.credentialId],
        true,
      );
    } finally {
      fs.renameSync = rename;
      fs.rmSync = remove;
    }
    assert.equal(result.status, "unavailable");
    assert.equal(Object.hasOwn(result, "token"), false);
    if (
      result.status !== "unavailable" ||
      result.reason !== "key_exchange_unavailable"
    )
      continue;
    assert.equal(result.firstFailure, publishFailure ? "publish" : "release");
    assert.equal(result.secondaryFailure, publishFailure ? "release" : null);
    assert.equal(
      result.lastConfirmedStage,
      publishFailure ? "prepared" : "credential_stored",
    );
    assert.equal(result.cleanupConfirmed, false);
  }
});

/**
 * 失効確定後の容量・生成故障を保存前に閉じる。
 * @responsibility 固定revoked事実を新資格成功や未失効へ変えない。
 * @trace RFD-IT-017
 * @precondition 自己生成currentにexact revoked交換を保存済み。
 * @stimulus 容量超過、乱数故障、KDF故障、資格ID衝突。
 * @observation current byte、乱数／KDF回数、Failure、Secretと新材料0。
 * @oracle 容量は生成0、生成失敗は再試行0、旧失効・同Recoveryを保持する。
 * @cleanup 暗号Hook復元とFixture回収。
 * @boundary 失効後の予約・生成・出版前。
 */
test("鍵交換保存は失効確定後の容量と生成故障を保持する", (t) => {
  for (const mode of ["capacity", "random", "kdf", "collision"] as const) {
    const f = managementFixture(t);
    const target = f.state.credentials[0];
    assert.ok(target);
    target.revoked = true;
    f.state.revision = 3;
    const operationId = "00000000-0000-4000-8000-000000000090";
    f.state.operationId = operationId;
    f.state.unresolvedKeyExchanges = [
      {
        stage: "revoked",
        recoveryId: `access-management.key-exchange.${operationId}`,
        operationId,
        entry: "workbench",
        scope: "targeted",
        recipientUserId: target.userId,
        oldCredentialIds: [target.credentialId],
      },
    ];
    if (mode === "capacity") {
      const repository = {
        repositoryId: "capacity-fixture",
        repositoryRoot: `${path.parse(f.directory).root.replaceAll("\\", "/")}x`,
        bindingId: `binding-${"0".repeat(32)}`,
      };
      f.state.registeredRepositories.push(repository);
      repository.repositoryRoot += "x".repeat(
        16_777_216 - 64 - bytes(f.state).byteLength,
      );
      const normalized = path
        .resolve(repository.repositoryRoot)
        .replace(/[\\/]+$/u, "");
      repository.bindingId = `binding-${createHash("sha256")
        .update(
          `${repository.repositoryId}\n${process.platform === "win32" ? normalized.toLowerCase() : normalized}`,
          "utf8",
        )
        .digest("hex")
        .slice(0, 32)}`;
    }
    assert.equal(parseAccessManagementState(bytes(f.state)).status, "parsed");
    const current = path.join(f.directory, "access-management.json");
    fs.writeFileSync(current, bytes(f.state));
    const before = fs.readFileSync(current);
    const random = crypto.randomBytes;
    const scrypt = crypto.scryptSync;
    let generated = 0;
    let kdf = 0;
    crypto.randomBytes = ((size: number) => {
      generated++;
      if (mode === "random" || mode === "capacity")
        throw new Error("injected_random");
      if (mode === "collision" && size === 12)
        return Buffer.from(target.credentialId, "hex");
      return random(size);
    }) as typeof crypto.randomBytes;
    crypto.scryptSync = ((...args) => {
      kdf++;
      if (mode === "kdf") throw new Error("injected_kdf");
      return scrypt(...args);
    }) as typeof crypto.scryptSync;
    let result: KeyExchangeResult;
    try {
      result = exchangeCredentialsFromHost(
        f.root,
        3,
        operationId,
        "targeted",
        target.userId,
        [target.credentialId],
        true,
      );
    } finally {
      crypto.randomBytes = random;
      crypto.scryptSync = scrypt;
    }
    assert.equal(result.status, "unavailable");
    assert.equal(Object.hasOwn(result, "token"), false);
    if (
      result.status !== "unavailable" ||
      result.reason !== "key_exchange_unavailable"
    )
      continue;
    assert.equal(
      result.firstFailure,
      mode === "capacity" ? "capacity" : "generation",
    );
    assert.equal(result.lastConfirmedStage, "revoked");
    assert.equal(
      result.recoveryId,
      f.state.unresolvedKeyExchanges[0]?.recoveryId,
    );
    if (mode === "capacity") {
      assert.equal(generated, 0);
      assert.equal(kdf, 0);
    } else assert.ok(generated > 0 && generated <= 3);
    assert.deepEqual(fs.readFileSync(current), before);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 別要求の旧資格拒否と現在別管理者／Hostのexact継続を検証する。
 * @responsibility 同要求admissionを次要求へ持ち越さない。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition Workbench起点の自己交換をrevoked清掃故障で停止する。
 * @stimulus 失効した旧鍵、別管理者、Hostを同じ交換へ再入場させる。
 * @observation 材料不変、起点entry／旧集合／Recovery、新生成と提示未成立。
 * @oracle 旧鍵拒否、材料処置要求停止、次fresh要求だけstored。Hostが起点を変更しない。
 * @cleanup Hook復元とFixture回収。
 * @boundary 新要求の認可と保存済み交換。
 */
test("鍵交換保存は別要求を現在別管理者またはHostだけで再開する", (t) => {
  for (const useHost of [false, true]) {
    const f = managementFixture(t);
    if (!useHost) {
      const actor = f.state.users[1];
      assert.ok(actor);
      actor.role = "administrator";
    }
    const target = f.state.credentials[0];
    assert.ok(target);
    const operationId = "00000000-0000-4000-8000-000000000090";
    const current = path.join(f.directory, "access-management.json");
    fs.writeFileSync(current, bytes(f.state));
    const remove = fs.rmSync;
    let removals = 0;
    fs.rmSync = (file, options) => {
      if (
        String(file) ===
          path.join(f.directory, "access-management.pending.json") &&
        ++removals === 2
      )
        throw new Error("injected_revoked_cleanup");
      return remove(file, options);
    };
    let failed: KeyExchangeResult;
    try {
      failed = exchangeCredentials(
        f.root,
        f.tokens.administrator,
        1,
        operationId,
        "targeted",
        target.userId,
        [target.credentialId],
        false,
      );
    } finally {
      fs.rmSync = remove;
    }
    assert.equal(failed.status, "unavailable");
    const before = fs
      .readdirSync(f.directory)
      .map((file) => [file, fs.readFileSync(path.join(f.directory, file))]);
    assert.deepEqual(
      exchangeCredentials(
        f.root,
        f.tokens.administrator,
        3,
        operationId,
        "targeted",
        target.userId,
        [target.credentialId],
        false,
      ),
      { status: "unavailable", reason: "key_exchange_rejected" },
    );
    assert.deepEqual(
      fs
        .readdirSync(f.directory)
        .map((file) => [file, fs.readFileSync(path.join(f.directory, file))]),
      before,
    );
    const first = useHost
      ? exchangeCredentialsFromHost(
          f.root,
          3,
          operationId,
          "targeted",
          target.userId,
          [target.credentialId],
          true,
        )
      : exchangeCredentials(
          f.root,
          f.tokens.manager,
          3,
          operationId,
          "targeted",
          target.userId,
          [target.credentialId],
          false,
        );
    assert.equal(first.status, "unavailable");
    const resumed = useHost
      ? exchangeCredentialsFromHost(
          f.root,
          3,
          operationId,
          "targeted",
          target.userId,
          [target.credentialId],
          true,
        )
      : exchangeCredentials(
          f.root,
          f.tokens.manager,
          3,
          operationId,
          "targeted",
          target.userId,
          [target.credentialId],
          false,
        );
    assert.equal(resumed.status, "completed");
    if (resumed.status !== "completed") continue;
    assert.equal(resumed.entry, "workbench");
    assert.equal(
      resumed.recoveryId,
      `access-management.key-exchange.${operationId}`,
    );
    assert.deepEqual(resumed.oldCredentialIds, [target.credentialId]);
    assert.equal(resumed.revision, 4);
  }
});

/**
 * 鍵を全て失った既存ユーザーへHost指定で再発行する。
 * @responsibility 旧集合0件を未登録や新ユーザー生成へ変換しない。
 * @trace RFD-IT-017
 * @precondition 完了済み管理状態と全失効資格。
 * @stimulus 既存管理者のHost指定・空旧集合を確認する。
 * @observation 三出版・同userId新資格・旧失効保持。
 * @oracle 新User・Role変更0で一資格保存。未解決recordは残る。
 * @cleanup Fixture回収。
 * @boundary 既存Host回復と交換保存。
 */
test("鍵交換保存は旧資格0件のHost指定を同ユーザーへ閉じる", (t) => {
  const f = managementFixture(t);
  for (const credential of f.state.credentials) credential.revoked = true;
  fs.writeFileSync(
    path.join(f.directory, "access-management.json"),
    bytes(f.state),
  );
  const userId = f.state.users[0]?.userId;
  assert.ok(userId);
  const result = exchangeCredentialsFromHost(
    f.root,
    1,
    "00000000-0000-4000-8000-000000000090",
    "targeted",
    userId,
    [],
    true,
  );
  assert.equal(result.status, "completed");
  const saved = JSON.parse(
    fs.readFileSync(path.join(f.directory, "access-management.json"), "utf8"),
  ) as AccessManagementState;
  assert.deepEqual(saved.users, f.state.users);
  assert.equal(saved.credentials.filter((c) => !c.revoked).length, 1);
  assert.equal(saved.credentials[3]?.userId, userId);
});

/**
 * 実Process喪失後に三出版のbase／nextを分けて再入場する。
 * @responsibility 過去Ownerの不明を新生成や名前だけの削除へ変換しない。
 * @trace RFD-IT-017
 * @precondition 自己生成Rootと試験専用worker、Host代役の入力。
 * @stimulus 三出版のrename前／後に子を実終了する。
 * @observation Exit71、current段階、材料、exact既存Lock回収と次要求。
 * @oracle base保持停止・生成0、next処置要求停止→fresh継続、stored Secret再取得0。
 * @cleanup 子終了確認とFixture回収。
 * @boundary 実Node Process、Filesystem出版、既存Owner不存在確認。
 */
test("鍵交換保存は実Process喪失後も三段階のbaseとnextを分ける", (t) => {
  for (const phase of [1, 2, 3])
    for (const timing of ["before", "after"] as const) {
      const f = managementFixture(t);
      const target = f.state.credentials[0];
      assert.ok(target);
      const operationId = "00000000-0000-4000-8000-000000000090";
      const worker = path.resolve(
        import.meta.dirname,
        "../../fixtures/credential-management-worker.ts",
      );
      const child = spawnSync(process.execPath, [worker], {
        input: JSON.stringify({
          directory: f.directory,
          token: "",
          operationId,
          userId: target.userId,
          credentialId: "",
          operation: "host_exchange",
          scope: "targeted",
          displayedOldCredentialIds: [target.credentialId],
          crashPhase: phase,
          crashTiming: timing,
        }),
        timeout: 10000,
        maxBuffer: 1_048_576,
      });
      assert.equal(child.status, 71);
      assert.equal(child.error, undefined);
      assert.equal(child.stdout.byteLength, 0);
      const current = path.join(f.directory, "access-management.json");
      const before = fs.readFileSync(current);
      const saved = JSON.parse(
        before.toString("utf8"),
      ) as AccessManagementState;
      assert.equal(saved.revision, timing === "after" ? phase + 1 : phase);
      const random = crypto.randomBytes;
      let generated = 0;
      crypto.randomBytes = (() => {
        generated++;
        throw new Error("unexpected_generation");
      }) as typeof crypto.randomBytes;
      let result: KeyExchangeResult;
      try {
        result = exchangeCredentialsFromHost(
          f.root,
          saved.revision,
          operationId,
          "targeted",
          target.userId,
          [target.credentialId],
          true,
        );
      } finally {
        crypto.randomBytes = random;
      }
      assert.equal(result.status, "unavailable");
      assert.equal(generated, 0);
      assert.deepEqual(fs.readFileSync(current), before);
      assert.equal(
        fs.existsSync(path.join(f.directory, "access-management.lock")),
        false,
      );
      if (timing === "before") {
        assert.equal(
          fs.existsSync(
            path.join(f.directory, "access-management.pending.json"),
          ),
          true,
        );
        assert.equal(
          fs.existsSync(
            path.join(f.directory, "access-management.replace.json"),
          ),
          true,
        );
      } else {
        assert.deepEqual(fs.readdirSync(f.directory), [
          "access-management.json",
        ]);
        const resumed = exchangeCredentialsFromHost(
          f.root,
          saved.revision,
          operationId,
          "targeted",
          target.userId,
          [target.credentialId],
          true,
        );
        assert.equal(resumed.status, "completed");
        if (resumed.status === "completed") {
          assert.equal(
            resumed.recoveryId,
            `access-management.key-exchange.${operationId}`,
          );
          if (phase === 3) assert.equal(resumed.token, null);
        }
      }
    }
});

/**
 * 二Processの同一／別交換要求を既存Lockで競合させる。
 * @responsibility 同一受付の重複生成と別対象への暗黙拡張を拒否する。
 * @trace RFD-IT-017
 * @precondition 同じRoot・期待改訂の現在管理資格。
 * @stimulus 同ID指定同士、別ID指定同士、全員と指定を同時開始する。
 * @observation 両close、非秘密結果、生成回数、改訂・資格・未解決record。
 * @oracle 一保存だけ、敗者生成0、新資格一件・record一件、対象外保持。
 * @cleanup 全子closeのjoin後にFixture回収。
 * @boundary 実Processと同じFilesystem Lock。
 */
test("鍵交換保存は二Processの同一と別対象競合を一採用へ閉じる", async (t) => {
  for (const mode of ["same", "different", "all_targeted"] as const) {
    const f = managementFixture(t);
    const userId = f.state.users[0]?.userId;
    assert.ok(userId);
    const worker = path.resolve(
      import.meta.dirname,
      "../../fixtures/credential-management-worker.ts",
    );
    const joined = await Promise.allSettled(
      [0, 1].map(
        (index) =>
          new Promise<{ status: string; generated: number }>(
            (resolve, reject) => {
              const child = spawn(process.execPath, [worker], {
                timeout: 10000,
              });
              let output = "";
              let childFailed = false;
              let inputFailed = false;
              child.stdout.on("data", (chunk) => {
                output += String(chunk);
              });
              child.stderr.resume();
              child.on("error", () => {
                childFailed = true;
              });
              child.stdin.on("error", () => {
                inputFailed = true;
              });
              const scope =
                mode === "all_targeted" && index === 0 ? "all" : "targeted";
              const recipientUserId =
                mode === "different" && index === 1
                  ? (f.state.users[1]?.userId ?? "")
                  : userId;
              child.stdin.end(
                JSON.stringify({
                  directory: f.directory,
                  token: f.tokens.administrator,
                  operationId: `00000000-0000-4000-8000-00000000009${mode === "same" ? 0 : index}`,
                  userId: recipientUserId,
                  credentialId: "",
                  operation: "exchange",
                  scope,
                  displayedOldCredentialIds: f.state.credentials
                    .filter(
                      (c) => scope === "all" || c.userId === recipientUserId,
                    )
                    .map((c) => c.credentialId),
                }),
              );
              child.on("close", (code, signal) => {
                if (code !== 0 || childFailed || inputFailed)
                  reject(new Error(`child_failed:${code}:${signal}`));
                else {
                  try {
                    resolve(JSON.parse(output));
                  } catch {
                    reject(new Error("child_result_invalid"));
                  }
                }
              });
            },
          ),
      ),
    );
    const results = joined.map((result) => {
      assert.equal(result.status, "fulfilled");
      if (result.status !== "fulfilled") throw new Error("child_join_failed");
      return result.value;
    });
    assert.equal(
      results.filter((result) => result.status === "completed").length,
      1,
    );
    for (const result of results)
      assert.equal(result.generated, result.status === "completed" ? 3 : 0);
    const saved = JSON.parse(
      fs.readFileSync(path.join(f.directory, "access-management.json"), "utf8"),
    ) as AccessManagementState;
    assert.equal(saved.revision, 4);
    assert.equal(saved.credentials.length, 4);
    assert.equal(saved.unresolvedKeyExchanges.length, 1);
    assert.deepEqual(saved.users, f.state.users);
    assert.deepEqual(saved.initialization, f.state.initialization);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 未確認の交換を別の明示交換へ引き継ぐ。
 * @responsibility 四経路と二提示状態を新相関へ一出版で置換する。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition Hostで既存managerへ保存済みの交換と三Role資格。
 * @stimulus not_attempted／unconfirmedから四経路の別交換と再送を行う。
 * @observation 新record・改訂・旧資格失効・提示保持・次要求のtoken null。
 * @oracle 新record一件、新鍵一件、旧参照の誤再送は保存0。
 * @cleanup Fixture回収。
 * @boundary 明示交換の意味と実Filesystem保存。
 */
test("鍵交換引継ぎは四経路で未確認記録を新交換へ置換する", (t) => {
  for (const presentation of ["not_attempted", "unconfirmed"] as const)
    for (const entry of ["workbench", "host"] as const)
      for (const scope of ["targeted", "all"] as const) {
        const f = managementFixture(t);
        const target = f.state.credentials[1];
        assert.ok(target);
        const old = exchangeCredentialsFromHost(
          f.root,
          1,
          "00000000-0000-4000-8000-000000000090",
          "targeted",
          target.userId,
          [target.credentialId],
          true,
        );
        assert.equal(old.status, "completed");
        if (old.status !== "completed") continue;
        let revision = old.revision;
        if (presentation === "unconfirmed") {
          const presented = updateCredentialPresentationState(f.root, {
            credentialId: old.credentialId,
            issuanceOperationId: old.operationId,
            expectedRevision: revision,
            target: "unconfirmed",
          });
          assert.equal(presented.status, "completed");
          if (presented.status !== "completed") continue;
          revision = presented.value.revision;
        }
        const current = path.join(f.directory, "access-management.json");
        const before = JSON.parse(
          fs.readFileSync(current, "utf8"),
        ) as AccessManagementState;
        const recipient = scope === "all" ? before.users[0] : before.users[1];
        assert.ok(recipient);
        const ids = before.credentials
          .filter(
            (credential) =>
              !credential.revoked &&
              (scope === "all" || credential.userId === recipient.userId),
          )
          .map((credential) => credential.credentialId);
        const operationId = "00000000-0000-4000-8000-000000000091";
        /**
         * 固定新交換を選択した入口と範囲へ搬送する。
         * @responsibility 元回復参照と期待改訂を他の入力から分離する。
         * @trace RFD-IT-013
         * @trace RFD-IT-017
         * @precondition 元交換と現在の発行先・旧資格集合を観測済み。
         * @stimulus 期待改訂と旧回復参照で別明示交換を要求する。
         * @observation 新相関・改訂・保存結果と誤再送拒否。
         * @oracle 四経路の新交換は一出版し、旧参照再送は更新0。
         * @cleanup 外側fixtureが実保存Rootを回収する。
         * @boundary 公開Host／Workbench交換APIの直接呼出し。
         */
        const invoke = (expected: number, previous = old.recoveryId) =>
          entry === "host"
            ? exchangeCredentialsFromHost(
                f.root,
                expected,
                operationId,
                scope,
                recipient.userId,
                ids,
                true,
                previous,
              )
            : exchangeCredentials(
                f.root,
                f.tokens.administrator,
                expected,
                operationId,
                scope,
                recipient.userId,
                ids,
                scope === "all",
                previous,
              );
        const exchanged = invoke(revision);
        assert.equal(exchanged.status, "completed");
        if (exchanged.status !== "completed") continue;
        assert.equal(exchanged.operationId, operationId);
        assert.equal(exchanged.revision, revision + 3);
        assert.equal(typeof exchanged.token, "string");
        assert.notEqual(exchanged.credentialId, old.credentialId);
        const saved = JSON.parse(
          fs.readFileSync(current, "utf8"),
        ) as AccessManagementState;
        assert.equal(saved.unresolvedKeyExchanges.length, 1);
        assert.equal(
          saved.unresolvedKeyExchanges[0]?.recoveryId,
          exchanged.recoveryId,
        );
        assert.equal(saved.credentials.length, before.credentials.length + 1);
        assert.equal(
          saved.credentials.find((c) => c.credentialId === old.credentialId)
            ?.revoked,
          true,
        );
        assert.equal(
          saved.credentials.find((c) => c.credentialId === old.credentialId)
            ?.presentation,
          presentation,
        );
        assert.deepEqual(saved.initialization, before.initialization);
        const bytesBefore = fs.readFileSync(current);
        const wrong =
          entry === "host"
            ? exchangeCredentialsFromHost(
                f.root,
                exchanged.revision,
                operationId,
                scope,
                recipient.userId,
                ids,
                true,
                "access-management.key-exchange.00000000-0000-4000-8000-000000000099",
              )
            : exchangeCredentials(
                f.root,
                exchanged.token ?? "",
                exchanged.revision,
                operationId,
                scope,
                recipient.userId,
                ids,
                scope === "all",
                "access-management.key-exchange.00000000-0000-4000-8000-000000000099",
              );
        assert.equal(wrong.status, "unavailable");
        assert.deepEqual(fs.readFileSync(current), bytesBefore);
        const retried =
          entry === "host"
            ? invoke(exchanged.revision)
            : exchangeCredentials(
                f.root,
                scope === "all"
                  ? (exchanged.token ?? "")
                  : f.tokens.administrator,
                exchanged.revision,
                operationId,
                scope,
                recipient.userId,
                ids,
                scope === "all",
                old.recoveryId,
              );
        assert.equal(retried.status, "completed");
        if (retried.status === "completed") assert.equal(retried.token, null);
        assert.deepEqual(fs.readFileSync(current), bytesBefore);
      }
});

/**
 * 引継ぎ出版前後の最後の確定相関を分離する。
 * @responsibility 新要求の失敗を旧交換の成功や新交換の確定へ変換しない。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 保存済みHost指定交換と出版／清掃故障Hook。
 * @stimulus 新preparedのrename前または清掃時に停止し、元入力で再入場する。
 * @observation 旧／新のRecovery・operation・段階、current、再入場時生成。
 * @oracle 出版前は旧相関保持、確定後は新相関へ同時切替。材料処置要求は停止。
 * @cleanup Hook復元とFixture回収。
 * @boundary current確定と返却の相関。
 */
test("鍵交換引継ぎは置換出版の故障前後で確定相関を保持する", (t) => {
  for (const mode of ["publish", "cleanup"] as const) {
    const f = managementFixture(t);
    const target = f.state.credentials[1];
    assert.ok(target);
    const old = exchangeCredentialsFromHost(
      f.root,
      1,
      "00000000-0000-4000-8000-000000000090",
      "targeted",
      target.userId,
      [target.credentialId],
      true,
    );
    assert.equal(old.status, "completed");
    if (old.status !== "completed") continue;
    const operationId = "00000000-0000-4000-8000-000000000091";
    const rename = fs.renameSync;
    const remove = fs.rmSync;
    let hit = false;
    fs.renameSync = (from, to) => {
      if (
        mode === "publish" &&
        !hit &&
        String(to) === path.join(f.directory, "access-management.json")
      ) {
        hit = true;
        throw new Error("injected_publish");
      }
      rename(from, to);
    };
    fs.rmSync = (file, options) => {
      if (
        mode === "cleanup" &&
        !hit &&
        String(file) ===
          path.join(f.directory, "access-management.pending.json")
      ) {
        hit = true;
        throw new Error("injected_cleanup");
      }
      remove(file, options);
    };
    let result: ReturnType<typeof exchangeCredentialsFromHost>;
    try {
      result = exchangeCredentialsFromHost(
        f.root,
        4,
        operationId,
        "targeted",
        target.userId,
        [old.credentialId],
        true,
        old.recoveryId,
      );
    } finally {
      fs.renameSync = rename;
      fs.rmSync = remove;
    }
    assert.equal(hit, true);
    assert.equal(result.status, "unavailable");
    if (
      result.status !== "unavailable" ||
      result.reason !== "key_exchange_unavailable"
    )
      continue;
    assert.equal(result.operationId, operationId);
    assert.equal(
      result.lastConfirmedOperationId,
      mode === "publish" ? old.operationId : operationId,
    );
    assert.equal(
      result.recoveryId,
      mode === "publish"
        ? old.recoveryId
        : `access-management.key-exchange.${operationId}`,
    );
    assert.equal(
      result.lastConfirmedStage,
      mode === "publish" ? "credential_stored" : "prepared",
    );
    const current = path.join(f.directory, "access-management.json");
    const saved = JSON.parse(
      fs.readFileSync(current, "utf8"),
    ) as AccessManagementState;
    assert.equal(saved.credentials.length, f.state.credentials.length + 1);
    assert.equal(saved.unresolvedKeyExchanges.length, 1);
    assert.equal(
      exchangeCredentialsFromHost(
        f.root,
        saved.revision,
        operationId,
        "targeted",
        target.userId,
        [old.credentialId],
        true,
        old.recoveryId,
      ).status,
      "unavailable",
    );
    if (mode === "cleanup") {
      const resumed = exchangeCredentialsFromHost(
        f.root,
        saved.revision,
        operationId,
        "targeted",
        target.userId,
        [old.credentialId],
        true,
        old.recoveryId,
      );
      assert.equal(resumed.status, "completed");
      if (resumed.status === "completed") assert.equal(resumed.revision, 7);
    } else {
      assert.equal(
        fs.existsSync(path.join(f.directory, "access-management.pending.json")),
        true,
      );
      assert.deepEqual(JSON.parse(fs.readFileSync(current, "utf8")), saved);
    }
  }
});

/**
 * 提示確認済み交換だけを現在認可で整理する。
 * @responsibility 起点と整理入口を分離し、記録以外の情報を保持する。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 三RoleのRootと管理者以外への保存済み指定交換。
 * @stimulus 両起点・両終了入口で未提示、未確認、確認済みを処置する。
 * @observation 改訂、資格・初回・User保持、record除去と再要求拒否。
 * @oracle 未確認の処置0、確認済み一出版、二回目は完了を再構成しない。
 * @cleanup Fixture回収。
 * @boundary 提示保存・現在認可・交換終了。
 */
test("鍵交換終了は確認済み記録だけ除去して資格を保持する", (t) => {
  for (const origin of ["workbench", "host"] as const)
    for (const entry of ["workbench", "host"] as const) {
      const f = managementFixture(t);
      const target = f.state.credentials[1];
      assert.ok(target);
      const exchangeId = "00000000-0000-4000-8000-000000000090";
      const old =
        origin === "host"
          ? exchangeCredentialsFromHost(
              f.root,
              1,
              exchangeId,
              "targeted",
              target.userId,
              [target.credentialId],
              true,
            )
          : exchangeCredentials(
              f.root,
              f.tokens.administrator,
              1,
              exchangeId,
              "targeted",
              target.userId,
              [target.credentialId],
              false,
            );
      assert.equal(old.status, "completed");
      if (old.status !== "completed") continue;
      const current = path.join(f.directory, "access-management.json");
      const closeId = "00000000-0000-4000-8000-000000000091";
      const unpresented = fs.readFileSync(current);
      assert.equal(
        finishKeyExchangeFromHost(f.root, 4, closeId, old.recoveryId).status,
        "unavailable",
      );
      assert.deepEqual(fs.readFileSync(current), unpresented);
      const started = updateCredentialPresentationState(f.root, {
        credentialId: old.credentialId,
        issuanceOperationId: old.operationId,
        expectedRevision: 4,
        target: "unconfirmed",
      });
      assert.equal(started.status, "completed");
      if (started.status !== "completed") continue;
      const unconfirmed = fs.readFileSync(current);
      assert.equal(
        finishKeyExchange(
          f.root,
          f.tokens.administrator,
          5,
          closeId,
          old.recoveryId,
        ).status,
        "unavailable",
      );
      assert.deepEqual(fs.readFileSync(current), unconfirmed);
      assert.equal(
        updateCredentialPresentationState(f.root, {
          credentialId: old.credentialId,
          issuanceOperationId: old.operationId,
          expectedRevision: 5,
          target: "confirmed",
          presentationOperationId: started.value.presentationOperationId,
        }).status,
        "completed",
      );
      const before = JSON.parse(
        fs.readFileSync(current, "utf8"),
      ) as AccessManagementState;
      const beforeBytes = fs.readFileSync(current);
      assert.equal(
        finishKeyExchange(
          f.root,
          f.tokens.developer,
          6,
          closeId,
          old.recoveryId,
        ).status,
        "unavailable",
      );
      assert.equal(
        finishKeyExchangeFromHost(f.root, 5, closeId, old.recoveryId).status,
        "unavailable",
      );
      assert.equal(
        finishKeyExchangeFromHost(f.root, 6, exchangeId, old.recoveryId).status,
        "unavailable",
      );
      assert.deepEqual(fs.readFileSync(current), beforeBytes);
      const finished =
        entry === "host"
          ? finishKeyExchangeFromHost(f.root, 6, closeId, old.recoveryId)
          : finishKeyExchange(
              f.root,
              f.tokens.administrator,
              6,
              closeId,
              old.recoveryId,
            );
      assert.deepEqual(finished, {
        status: "completed",
        revision: 7,
        operationId: closeId,
        recoveryId: old.recoveryId,
        cleanupConfirmed: true,
      });
      const saved = JSON.parse(
        fs.readFileSync(current, "utf8"),
      ) as AccessManagementState;
      assert.deepEqual(saved, {
        ...before,
        revision: 7,
        operationId: closeId,
        unresolvedKeyExchanges: [],
      });
      const afterBytes = fs.readFileSync(current);
      assert.equal(
        finishKeyExchangeFromHost(f.root, 7, closeId, old.recoveryId).status,
        "unavailable",
      );
      assert.deepEqual(fs.readFileSync(current), afterBytes);
      assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
    }
});

/**
 * 確認済み交換終了の故障を実保存で観測する。
 * @responsibility 出版状態と主失敗・解放不明を混同しない。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 確認済みHost交換と対象限定Filesystem故障Hook。
 * @stimulus 終了の出版・読戻し・清掃・Lock解放を停止する。
 * @observation failure相関、record有無、資格保持、復元後再要求。
 * @oracle 不明をcompletedへ変換せず、終了済み不在から再完了を作らない。
 * @cleanup Hook復元とFixture回収。
 * @boundary 既存Lock・出版・current読戻し。
 */
test("鍵交換終了は出版故障と後続解放不明を分離する", (t) => {
  for (const mode of [
    "publish",
    "read_back",
    "cleanup",
    "release",
    "publish_release",
  ] as const) {
    const f = managementFixture(t);
    const target = f.state.credentials[1];
    assert.ok(target);
    const old = exchangeCredentialsFromHost(
      f.root,
      1,
      "00000000-0000-4000-8000-000000000090",
      "targeted",
      target.userId,
      [target.credentialId],
      true,
    );
    assert.ok(old.status === "completed");
    const started = updateCredentialPresentationState(f.root, {
      credentialId: old.credentialId,
      issuanceOperationId: old.operationId,
      expectedRevision: 4,
      target: "unconfirmed",
    });
    assert.ok(started.status === "completed");
    assert.equal(
      updateCredentialPresentationState(f.root, {
        credentialId: old.credentialId,
        issuanceOperationId: old.operationId,
        expectedRevision: 5,
        target: "confirmed",
        presentationOperationId: started.value.presentationOperationId,
      }).status,
      "completed",
    );
    const current = path.join(f.directory, "access-management.json");
    const before = JSON.parse(
      fs.readFileSync(current, "utf8"),
    ) as AccessManagementState;
    const rename = fs.renameSync;
    const open = fs.openSync;
    const remove = fs.rmSync;
    let published = false;
    let hit = false;
    fs.renameSync = (from, to) => {
      if (String(to) === current) {
        if (mode === "publish" || mode === "publish_release") {
          hit = true;
          throw new Error("injected_publish");
        }
        published = true;
      }
      rename(from, to);
    };
    fs.openSync = (file, flags, fileMode) => {
      if (
        mode === "read_back" &&
        published &&
        !hit &&
        String(file) === current
      ) {
        hit = true;
        throw new Error("injected_read");
      }
      return open(file, flags, fileMode);
    };
    fs.rmSync = (file, options) => {
      if (
        (mode === "cleanup" &&
          String(file) ===
            path.join(f.directory, "access-management.pending.json")) ||
        ((mode === "release" || mode === "publish_release") &&
          String(file) === path.join(f.directory, "access-management.lock"))
      ) {
        hit = true;
        throw new Error("injected_remove");
      }
      remove(file, options);
    };
    let result: ReturnType<typeof finishKeyExchangeFromHost>;
    const operationId = "00000000-0000-4000-8000-000000000091";
    try {
      result = finishKeyExchangeFromHost(
        f.root,
        6,
        operationId,
        old.recoveryId,
      );
    } finally {
      fs.renameSync = rename;
      fs.openSync = open;
      fs.rmSync = remove;
    }
    assert.equal(hit, true);
    assert.ok(
      result.status === "unavailable" &&
        result.reason === "key_exchange_completion_unavailable",
    );
    assert.equal(result.recoveryId, old.recoveryId);
    assert.equal(result.operationId, operationId);
    assert.equal(
      result.firstFailure,
      mode === "publish_release" ? "publish" : mode,
    );
    assert.equal(
      result.secondaryFailure,
      mode === "publish_release" ? "release" : null,
    );
    const saved = JSON.parse(
      fs.readFileSync(current, "utf8"),
    ) as AccessManagementState;
    assert.deepEqual(saved.credentials, before.credentials);
    assert.deepEqual(saved.initialization, before.initialization);
    assert.equal(saved.unresolvedKeyExchanges.length, published ? 0 : 1);
    const savedBytes = fs.readFileSync(current);
    assert.equal(
      finishKeyExchangeFromHost(
        f.root,
        saved.revision,
        operationId,
        old.recoveryId,
      ).status,
      "unavailable",
    );
    assert.deepEqual(fs.readFileSync(current), savedBytes);
  }
});

/**
 * 実Process喪失後の引継ぎと終了材料を観測する。
 * @responsibility 保存前のunknownと保存済みrecord不存在を区別する。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 自己生成Rootと既存試験Worker。
 * @stimulus 引継ぎ三出版または終了一出版のrename前後でProcessを終了する。
 * @observation 子終了、record・資格、信頼保存Ownerの材料処置、fresh再入場。
 * @oracle base材料保持、next材料回収。不存在から終了completedを再構成しない。
 * @cleanup 子Process joinとFixture回収。
 * @boundary 実Process・Filesystem・既存保存Owner。
 */
test("鍵交換終了と引継ぎは実Process喪失後のbaseとnextを区別する", (t) => {
  for (const operation of ["host_exchange", "host_finish"] as const)
    for (const phase of operation === "host_exchange" ? [1, 2, 3] : [1])
      for (const timing of ["before", "after"] as const) {
        const f = managementFixture(t);
        const target = f.state.credentials[1];
        assert.ok(target);
        const old = exchangeCredentialsFromHost(
          f.root,
          1,
          "00000000-0000-4000-8000-000000000090",
          "targeted",
          target.userId,
          [target.credentialId],
          true,
        );
        assert.ok(old.status === "completed");
        let expectedRevision = 4;
        if (operation === "host_finish") {
          const started = updateCredentialPresentationState(f.root, {
            credentialId: old.credentialId,
            issuanceOperationId: old.operationId,
            expectedRevision: 4,
            target: "unconfirmed",
          });
          assert.ok(started.status === "completed");
          assert.equal(
            updateCredentialPresentationState(f.root, {
              credentialId: old.credentialId,
              issuanceOperationId: old.operationId,
              expectedRevision: 5,
              target: "confirmed",
              presentationOperationId: started.value.presentationOperationId,
            }).status,
            "completed",
          );
          expectedRevision = 6;
        }
        const operationId = "00000000-0000-4000-8000-000000000091";
        const worker = path.resolve(
          import.meta.dirname,
          "../../fixtures/credential-management-worker.ts",
        );
        const child = spawnSync(process.execPath, [worker], {
          input: JSON.stringify({
            directory: f.directory,
            token: "",
            operationId,
            userId: target.userId,
            credentialId: "",
            operation,
            expectedRevision,
            scope: "targeted",
            displayedOldCredentialIds: [old.credentialId],
            previousRecoveryId: old.recoveryId,
            recoveryId: old.recoveryId,
            crashPhase: phase,
            crashTiming: timing,
          }),
          encoding: "utf8",
          timeout: 30000,
        });
        assert.equal(child.error, undefined);
        assert.equal(child.status, 71);
        assert.equal(child.stdout, "");
        const current = path.join(f.directory, "access-management.json");
        const before = JSON.parse(
          fs.readFileSync(current, "utf8"),
        ) as AccessManagementState;
        const observed = readAccessManagementState(f.root);
        if (timing === "before") {
          assert.equal(observed.status, "unavailable");
          assert.equal(
            fs.existsSync(
              path.join(f.directory, "access-management.pending.json"),
            ),
            true,
          );
          assert.deepEqual(
            JSON.parse(fs.readFileSync(current, "utf8")),
            before,
          );
          continue;
        }
        assert.equal(observed.status, "completed");
        assert.deepEqual(fs.readdirSync(f.directory), [
          "access-management.json",
        ]);
        if (operation === "host_finish") {
          assert.equal(before.unresolvedKeyExchanges.length, 0);
          assert.equal(
            finishKeyExchangeFromHost(
              f.root,
              before.revision,
              operationId,
              old.recoveryId,
            ).status,
            "unavailable",
          );
        } else {
          const resumed = exchangeCredentialsFromHost(
            f.root,
            before.revision,
            operationId,
            "targeted",
            target.userId,
            [old.credentialId],
            true,
            old.recoveryId,
          );
          assert.ok(resumed.status === "completed");
          assert.equal(resumed.revision, 7);
          assert.equal(resumed.token === null, phase === 3);
        }
      }
});

/**
 * 初回途中の引継ぎと終了を同UserのHost指定へ閉じる。
 * @responsibility 元初回試行と初資格を保存し、最新確認対象だけ更新する。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @trace RFD-IT-024
 * @precondition 初回credential_storedの単一管理者。
 * @stimulus Host交換を別交換へ引き継ぎ、提示を確認して終了する。
 * @observation 初回歴史ID、最新確認資格、Workbench／全員拒否、record除去。
 * @oracle Host同Userだけ。初回completedや本人受領は推定しない。
 * @cleanup Fixture回収。
 * @boundary 初回確認Bindingと交換終了。
 */
test("鍵交換終了と引継ぎは初回Hostの同ユーザーだけを保持する", (t) => {
  const f = managementFixture(t);
  const admin = f.state.users[0];
  const original = f.state.credentials[0];
  assert.ok(admin && original);
  f.state.users = [admin];
  f.state.credentials = [original];
  original.operationId = f.state.initialization.attemptId;
  f.state.initialization = {
    stage: "credential_stored",
    attemptId: original.operationId,
    userId: admin.userId,
    initialCredentialId: original.credentialId,
    confirmationCredentialId: original.credentialId,
  };
  const current = path.join(f.directory, "access-management.json");
  fs.writeFileSync(current, bytes(f.state));
  const old = exchangeCredentialsFromHost(
    f.root,
    1,
    "00000000-0000-4000-8000-000000000090",
    "targeted",
    admin.userId,
    [original.credentialId],
    true,
  );
  assert.ok(old.status === "completed");
  const operationId = "00000000-0000-4000-8000-000000000091";
  const before = fs.readFileSync(current);
  assert.equal(
    exchangeCredentials(
      f.root,
      old.token ?? "",
      4,
      operationId,
      "targeted",
      admin.userId,
      [old.credentialId],
      false,
      old.recoveryId,
    ).status,
    "unavailable",
  );
  assert.equal(
    exchangeCredentialsFromHost(
      f.root,
      4,
      operationId,
      "all",
      admin.userId,
      [old.credentialId],
      true,
      old.recoveryId,
    ).status,
    "unavailable",
  );
  assert.deepEqual(fs.readFileSync(current), before);
  const next = exchangeCredentialsFromHost(
    f.root,
    4,
    operationId,
    "targeted",
    admin.userId,
    [old.credentialId],
    true,
    old.recoveryId,
  );
  assert.ok(next.status === "completed");
  const started = updateCredentialPresentationState(f.root, {
    credentialId: next.credentialId,
    issuanceOperationId: next.operationId,
    expectedRevision: 7,
    target: "unconfirmed",
  });
  assert.ok(started.status === "completed");
  assert.equal(
    updateCredentialPresentationState(f.root, {
      credentialId: next.credentialId,
      issuanceOperationId: next.operationId,
      expectedRevision: 8,
      target: "confirmed",
      presentationOperationId: started.value.presentationOperationId,
    }).status,
    "completed",
  );
  const closeId = "00000000-0000-4000-8000-000000000092";
  assert.equal(
    finishKeyExchange(f.root, next.token ?? "", 9, closeId, next.recoveryId)
      .status,
    "unavailable",
  );
  assert.equal(
    finishKeyExchangeFromHost(f.root, 9, closeId, next.recoveryId).status,
    "completed",
  );
  const saved = JSON.parse(
    fs.readFileSync(current, "utf8"),
  ) as AccessManagementState;
  assert.deepEqual(saved.initialization, {
    ...f.state.initialization,
    confirmationCredentialId: next.credentialId,
  });
  assert.equal(saved.unresolvedKeyExchanges.length, 0);
  assert.equal(saved.revision, 10);
  assert.equal(parseAccessManagementState(bytes(saved)).status, "parsed");
});

/**
 * 二Processの引継ぎと終了を一採用に閉じる。
 * @responsibility 同時要求の旧参照を重複生成・二重整理へ使わせない。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 同じRoot・期待改訂の前交換、終了だけ提示confirmed。
 * @stimulus 同new操作／別new操作の引継ぎ、同終了操作を並行実行する。
 * @observation 両子close、生成総数、改訂、資格数、record集合。
 * @oracle 一採用、敗者生成0、引継ぎrecord一件または終了record0。
 * @cleanup 両子join後にFixture回収。
 * @boundary 実Processと既存単一Lock。
 */
test("鍵交換終了と引継ぎの二Process競合は一採用だけ保存する", async (t) => {
  for (const mode of ["same", "different", "completion"] as const) {
    const f = managementFixture(t);
    const target = f.state.credentials[1];
    assert.ok(target);
    const old = exchangeCredentialsFromHost(
      f.root,
      1,
      "00000000-0000-4000-8000-000000000090",
      "targeted",
      target.userId,
      [target.credentialId],
      true,
    );
    assert.ok(old.status === "completed");
    let expectedRevision = 4;
    if (mode === "completion") {
      const started = updateCredentialPresentationState(f.root, {
        credentialId: old.credentialId,
        issuanceOperationId: old.operationId,
        expectedRevision: 4,
        target: "unconfirmed",
      });
      assert.ok(started.status === "completed");
      assert.equal(
        updateCredentialPresentationState(f.root, {
          credentialId: old.credentialId,
          issuanceOperationId: old.operationId,
          expectedRevision: 5,
          target: "confirmed",
          presentationOperationId: started.value.presentationOperationId,
        }).status,
        "completed",
      );
      expectedRevision = 6;
    }
    const worker = path.resolve(
      import.meta.dirname,
      "../../fixtures/credential-management-worker.ts",
    );
    const joined = await Promise.allSettled(
      [0, 1].map(
        (index) =>
          new Promise<{ status: string; generated: number }>(
            (resolve, reject) => {
              const child = spawn(process.execPath, [worker], {
                timeout: 10000,
              });
              let output = "";
              let failed = false;
              child.stdout.on("data", (chunk) => {
                output += String(chunk);
              });
              child.stderr.resume();
              child.on("error", () => {
                failed = true;
              });
              child.stdin.on("error", () => {
                failed = true;
              });
              child.stdin.end(
                JSON.stringify({
                  directory: f.directory,
                  token: "",
                  operationId: `00000000-0000-4000-8000-00000000009${mode === "different" ? index + 1 : 1}`,
                  userId: target.userId,
                  credentialId: "",
                  expectedRevision,
                  operation:
                    mode === "completion" ? "host_finish" : "host_exchange",
                  scope: "targeted",
                  displayedOldCredentialIds: [old.credentialId],
                  previousRecoveryId: old.recoveryId,
                  recoveryId: old.recoveryId,
                }),
              );
              child.on("close", (code, signal) => {
                if (code !== 0 || signal || failed)
                  reject(new Error("child_failed"));
                else {
                  try {
                    resolve(JSON.parse(output));
                  } catch {
                    reject(new Error("child_result_invalid"));
                  }
                }
              });
            },
          ),
      ),
    );
    const results = joined.map((result) => {
      assert.ok(result.status === "fulfilled");
      return result.value;
    });
    assert.equal(
      results.filter((result) => result.status === "completed").length,
      1,
    );
    assert.equal(
      results.reduce((sum, result) => sum + result.generated, 0),
      mode === "completion" ? 0 : 3,
    );
    const saved = JSON.parse(
      fs.readFileSync(path.join(f.directory, "access-management.json"), "utf8"),
    ) as AccessManagementState;
    assert.equal(saved.revision, 7);
    assert.equal(saved.credentials.length, mode === "completion" ? 4 : 5);
    assert.equal(
      saved.unresolvedKeyExchanges.length,
      mode === "completion" ? 0 : 1,
    );
    assert.deepEqual(saved.users, f.state.users);
    assert.deepEqual(saved.initialization, f.state.initialization);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * Host二経路を一度提示と確認済み終了へ接続する。
 * @responsibility core保存・提示・記録終了の順序と非秘密結果を検証する。
 * @trace RFD-IT-017
 * @precondition 三Roleの自己生成Rootと局所TTY代役。
 * @stimulus 指定と全員交換を保存から一度提示・終了まで行う。
 * @observation TTY時のunconfirmed、write回数、最後の改訂、Secret非保存。
 * @oracle 一write、record0、資格確認済み。streamをend／destroyしない。
 * @cleanup Listener確認後にFixture回収。
 * @boundary Host内部composition・既存保存・Node Writable。
 */
test("Host交換compositionは指定と全員を一度提示して記録を閉じる", async (t) => {
  for (const scope of ["targeted", "all"] as const) {
    const f = managementFixture(t);
    const user = f.state.users[scope === "all" ? 0 : 1];
    assert.ok(user);
    const ids = f.state.credentials
      .filter((c) => scope === "all" || c.userId === user.userId)
      .map((c) => c.credentialId);
    let writes = 0;
    let key = "";
    const terminal = Object.assign(
      new Writable({
        highWaterMark: 1,
        write(chunk, _encoding, callback) {
          writes++;
          const current = JSON.parse(
            fs.readFileSync(
              path.join(f.directory, "access-management.json"),
              "utf8",
            ),
          ) as AccessManagementState;
          assert.equal(current.revision, 5);
          assert.equal(current.credentials.at(-1)?.presentation, "unconfirmed");
          assert.equal(
            fs.existsSync(path.join(f.directory, "access-management.lock")),
            false,
          );
          key = chunk.toString("utf8").split("\n")[1];
          setImmediate(callback);
        },
      }),
      { isTTY: true },
    ) as unknown as NodeJS.WriteStream;
    const result = await exchangeFromHost(
      f.root,
      {
        expectedRevision: 1,
        exchangeOperationId: "00000000-0000-4000-8000-000000000090",
        completionOperationId: "00000000-0000-4000-8000-000000000091",
        scope,
        recipientUserId: user.userId,
        displayedOldCredentialIds: ids,
        confirmed: true,
      },
      terminal,
      new AbortController().signal,
    );
    assert.equal(result.status, "completed");
    assert.equal(writes, 1);
    assert.equal(Object.hasOwn(result, "token"), false);
    const stored = JSON.parse(
      fs.readFileSync(path.join(f.directory, "access-management.json"), "utf8"),
    ) as AccessManagementState;
    assert.equal(stored.revision, 7);
    assert.equal(stored.unresolvedKeyExchanges.length, 0);
    const credential = stored.credentials.at(-1);
    assert.ok(credential);
    assert.equal(credential.presentation, "confirmed");
    assert.equal(verifyCredentialToken(key, credential), true);
    assert.equal(bytes(stored).includes(Buffer.from(key)), false);
    key = "";
    assert.equal(terminal.destroyed, false);
    assert.equal(terminal.writableEnded, false);
    assert.equal(terminal.listenerCount("error"), 0);
    assert.equal(terminal.listenerCount("close"), 0);
  }
});

/**
 * Host再入場でSecretを再取得せず提示状態を処置する。
 * @responsibility confirmedだけ終了し、未確認を別明示交換へ渡す。
 * @trace RFD-IT-017
 * @precondition 同じHost交換の保存済み三提示状態。
 * @stimulus 同交換入力で再入場する。
 * @observation TTY0、資格数不変、record保持／除去。
 * @oracle 未確認は再交換必要、confirmedは終了だけ。再表示0。
 * @cleanup Fixture回収。
 * @boundary fresh交換読取りとHost再入場。
 */
test("Host交換compositionは保存済み鍵を再表示せず確認済みだけ閉じる", async (t) => {
  for (const presentation of [
    "not_attempted",
    "unconfirmed",
    "confirmed",
  ] as const) {
    const f = managementFixture(t);
    const target = f.state.credentials[1];
    assert.ok(target);
    const exchangeOperationId = "00000000-0000-4000-8000-000000000090";
    const old = exchangeCredentialsFromHost(
      f.root,
      1,
      exchangeOperationId,
      "targeted",
      target.userId,
      [target.credentialId],
      true,
    );
    assert.ok(old.status === "completed");
    let revision = 4;
    if (presentation !== "not_attempted") {
      const started = updateCredentialPresentationState(f.root, {
        credentialId: old.credentialId,
        issuanceOperationId: old.operationId,
        expectedRevision: revision,
        target: "unconfirmed",
      });
      assert.ok(started.status === "completed");
      revision = 5;
      if (presentation === "confirmed") {
        assert.equal(
          updateCredentialPresentationState(f.root, {
            credentialId: old.credentialId,
            issuanceOperationId: old.operationId,
            expectedRevision: revision,
            target: "confirmed",
            presentationOperationId: started.value.presentationOperationId,
          }).status,
          "completed",
        );
        revision = 6;
      }
    }
    let writes = 0;
    const terminal = Object.assign(
      new Writable({
        write(_chunk, _encoding, callback) {
          writes++;
          callback();
        },
      }),
      { isTTY: true },
    ) as unknown as NodeJS.WriteStream;
    const result = await exchangeFromHost(
      f.root,
      {
        expectedRevision: revision,
        exchangeOperationId,
        completionOperationId: "00000000-0000-4000-8000-000000000091",
        scope: "targeted",
        recipientUserId: target.userId,
        displayedOldCredentialIds: [target.credentialId],
        confirmed: true,
      },
      terminal,
      new AbortController().signal,
    );
    assert.equal(
      result.status,
      presentation === "confirmed" ? "completed" : "key_exchange_required",
    );
    assert.equal(writes, 0);
    const stored = JSON.parse(
      fs.readFileSync(path.join(f.directory, "access-management.json"), "utf8"),
    ) as AccessManagementState;
    assert.equal(stored.credentials.length, 4);
    assert.equal(
      stored.unresolvedKeyExchanges.length,
      presentation === "confirmed" ? 0 : 1,
    );
    assert.equal(
      stored.revision,
      revision + (presentation === "confirmed" ? 1 : 0),
    );
  }
});

/**
 * Host交換の取消と遅延出力通知を反証する。
 * @responsibility 保存後取消をEffect0へ丸めず、遅延成功で提示を復活させない。
 * @trace RFD-IT-017
 * @precondition 三RoleのRoot、取消Controller、TTYとrename限定Hook。
 * @stimulus 開始前、資格保存後、TTY中、callback直後errorで停止する。
 * @observation 書込み数、確定段階と元相関、提示状態、Listener回収。
 * @oracle 開始前だけcancelled。保存後はblockedでrecord保持、confirmed／finish0。
 * @cleanup Hook復元・callback join・Fixture回収。
 * @boundary 保存と非同期TTYの取消境界。
 */
test("Host交換compositionは保存後取消と遅延通知を成功にしない", async (t) => {
  for (const mode of [
    "before",
    "after_store",
    "during_tty",
    "late_error",
    "after_finish",
  ] as const) {
    const f = managementFixture(t);
    const target = f.state.credentials[1];
    assert.ok(target);
    const controller = new AbortController();
    if (mode === "before") controller.abort();
    const rename = fs.renameSync;
    let publications = 0;
    fs.renameSync = (from, to) => {
      rename(from, to);
      if (
        String(to) === path.join(f.directory, "access-management.json") &&
        ((++publications === 3 && mode === "after_store") ||
          (publications === 6 && mode === "after_finish"))
      )
        controller.abort();
    };
    let writes = 0;
    const terminal = Object.assign(
      new Writable({
        write(_chunk, _encoding, callback) {
          writes++;
          if (mode === "during_tty") controller.abort();
          setImmediate(() => {
            callback();
            if (mode === "late_error")
              terminal.emit("error", new Error("injected_late_error"));
          });
        },
      }),
      { isTTY: true },
    ) as unknown as NodeJS.WriteStream;
    let result: Awaited<ReturnType<typeof exchangeFromHost>>;
    try {
      result = await exchangeFromHost(
        f.root,
        {
          expectedRevision: 1,
          exchangeOperationId: "00000000-0000-4000-8000-000000000090",
          completionOperationId: "00000000-0000-4000-8000-000000000091",
          scope: "targeted",
          recipientUserId: target.userId,
          displayedOldCredentialIds: [target.credentialId],
          confirmed: true,
        },
        terminal,
        controller.signal,
      );
    } finally {
      fs.renameSync = rename;
    }
    assert.equal(result.status, mode === "before" ? "cancelled" : "blocked");
    assert.equal(writes, mode === "before" || mode === "after_store" ? 0 : 1);
    const stored = JSON.parse(
      fs.readFileSync(path.join(f.directory, "access-management.json"), "utf8"),
    ) as AccessManagementState;
    assert.equal(
      stored.revision,
      mode === "before"
        ? 1
        : mode === "after_store"
          ? 4
          : mode === "after_finish"
            ? 7
            : 5,
    );
    assert.equal(
      stored.unresolvedKeyExchanges.length,
      mode === "before" || mode === "after_finish" ? 0 : 1,
    );
    if (result.status === "blocked") {
      assert.equal(
        result.lastConfirmedOperationId,
        "00000000-0000-4000-8000-000000000090",
      );
      assert.equal(result.lastConfirmedStage, "credential_stored");
      assert.equal(
        result.recoveryId,
        "access-management.key-exchange.00000000-0000-4000-8000-000000000090",
      );
      assert.equal(
        stored.credentials.at(-1)?.presentation,
        mode === "after_store"
          ? "not_attempted"
          : mode === "after_finish"
            ? "confirmed"
            : "unconfirmed",
      );
    }
    assert.equal(terminal.listenerCount("error"), 0);
    assert.equal(terminal.listenerCount("close"), 0);
    assert.equal(terminal.destroyed, false);
    assert.equal(terminal.writableEnded, false);
  }
});

/**
 * Host再観測の解放不明を清掃成功へ変換しない。
 * @responsibility core保存の既知清掃と後続Readerのunknownを分ける。
 * @trace RFD-IT-017
 * @precondition stored再入場とReader側Lock解放の限定故障。
 * @stimulus 二回目のLock解放を拒否する。
 * @observation 非秘密blocked・cleanup false・元相関・TTY0・current不変。
 * @oracle 観測不明から提示／終了へ進めない。
 * @cleanup Hook復元とFixture回収。
 * @boundary 既存保存からfresh Readerへの待機後処置。
 */
test("Host交換compositionは再観測の解放不明で清掃を保証しない", async (t) => {
  const f = managementFixture(t);
  const target = f.state.credentials[1];
  assert.ok(target);
  const exchangeOperationId = "00000000-0000-4000-8000-000000000090";
  const old = exchangeCredentialsFromHost(
    f.root,
    1,
    exchangeOperationId,
    "targeted",
    target.userId,
    [target.credentialId],
    true,
  );
  assert.ok(old.status === "completed");
  const current = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(current);
  const remove = fs.rmSync;
  let releases = 0;
  fs.rmSync = (file, options) => {
    if (
      String(file) === path.join(f.directory, "access-management.lock") &&
      ++releases === 2
    )
      throw new Error("injected_reader_release");
    remove(file, options);
  };
  let writes = 0;
  const terminal = Object.assign(
    new Writable({
      write(_chunk, _encoding, callback) {
        writes++;
        callback();
      },
    }),
    { isTTY: true },
  ) as unknown as NodeJS.WriteStream;
  let result: Awaited<ReturnType<typeof exchangeFromHost>>;
  try {
    result = await exchangeFromHost(
      f.root,
      {
        expectedRevision: 4,
        exchangeOperationId,
        completionOperationId: "00000000-0000-4000-8000-000000000091",
        scope: "targeted",
        recipientUserId: target.userId,
        displayedOldCredentialIds: [target.credentialId],
        confirmed: true,
      },
      terminal,
      new AbortController().signal,
    );
  } finally {
    fs.rmSync = remove;
  }
  assert.ok(result.status === "blocked");
  assert.equal(result.firstFailure, "observation");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.recoveryId, old.recoveryId);
  assert.equal(writes, 0);
  assert.deepEqual(fs.readFileSync(current), before);
});

/**
 * Host提示保存と終了の失敗を一度出力の事実と分離する。
 * @responsibility 表示済みでもrecord整理完了を捏造しない。
 * @trace RFD-IT-017
 * @precondition 新Host交換、成功TTY、提示開始／提示確認／終了一出版のrename故障。
 * @stimulus 四・五・六番目の出版をそれぞれ停止する。
 * @observation 出力0／1、現在提示状態、残record、非秘密Failure。
 * @oracle 提示開始未確定は出力0、提示確認未確定は出力1で終了0。交換元相関と主失敗を保持し自動再発行0。
 * @cleanup Hook復元とFixture回収。
 * @boundary TTY提示と交換終了の別事実。
 */
test("Host交換compositionは提示保存と終了の故障で元参照を保持する", async (t) => {
  for (const failedPublication of [4, 5, 6]) {
    const f = managementFixture(t);
    const target = f.state.credentials[1];
    assert.ok(target);
    const rename = fs.renameSync;
    let publications = 0;
    fs.renameSync = (from, to) => {
      if (
        String(to) === path.join(f.directory, "access-management.json") &&
        ++publications === failedPublication
      )
        throw new Error("injected_finish");
      rename(from, to);
    };
    let writes = 0;
    const terminal = Object.assign(
      new Writable({
        write(_chunk, _encoding, callback) {
          writes++;
          callback();
        },
      }),
      { isTTY: true },
    ) as unknown as NodeJS.WriteStream;
    let result: Awaited<ReturnType<typeof exchangeFromHost>>;
    try {
      result = await exchangeFromHost(
        f.root,
        {
          expectedRevision: 1,
          exchangeOperationId: "00000000-0000-4000-8000-000000000090",
          completionOperationId: "00000000-0000-4000-8000-000000000091",
          scope: "targeted",
          recipientUserId: target.userId,
          displayedOldCredentialIds: [target.credentialId],
          confirmed: true,
        },
        terminal,
        new AbortController().signal,
      );
    } finally {
      fs.renameSync = rename;
    }
    assert.ok(result.status === "blocked");
    assert.equal(
      result.stage,
      failedPublication === 6 ? "completion" : "presentation",
    );
    assert.equal(
      result.firstFailure,
      failedPublication === 6 ? "publish" : "presentation",
    );
    assert.equal(writes, failedPublication === 4 ? 0 : 1);
    assert.equal(publications, failedPublication);
    assert.equal(Object.hasOwn(result, "token"), false);
    const stored = JSON.parse(
      fs.readFileSync(path.join(f.directory, "access-management.json"), "utf8"),
    ) as AccessManagementState;
    assert.equal(stored.revision, failedPublication);
    assert.equal(
      stored.credentials.at(-1)?.presentation,
      failedPublication === 4
        ? "not_attempted"
        : failedPublication === 5
          ? "unconfirmed"
          : "confirmed",
    );
    assert.equal(stored.credentials.length, 4);
    assert.equal(stored.unresolvedKeyExchanges.length, 1);
    assert.equal(
      result.recoveryId,
      stored.unresolvedKeyExchanges[0]?.recoveryId,
    );
    assert.equal(
      result.lastConfirmedOperationId,
      "00000000-0000-4000-8000-000000000090",
    );
    assert.equal(result.lastConfirmedStage, "credential_stored");
    assert.equal(result.publication, "unconfirmed");
    assert.equal(terminal.listenerCount("error"), 0);
    assert.equal(terminal.destroyed, false);
    terminal.destroy();
  }
});

/**
 * 三段階を閉じた非秘密投影で観測する。
 * @responsibility Host起点の読取りをWorkbench継続の許可にしない。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 自己生成Root、三Role、Host起点の管理者以外への交換。
 * @stimulus 各段階で保存を停止し、Hostと現在管理者でexact参照を読む。
 * @observation DTO own field、起点entry・旧集合・提示、凍結、current byte。
 * @oracle 秘密・内部Pathなし。材料処置後の次要求だけ観測し、保存／生成／継続0。
 * @cleanup Hook復元とFixture回収。
 * @boundary current・現在認証・専用交換Reader。
 */
test("交換状態Readerは三段階を非秘密の閉集合で返す", (t) => {
  for (const phase of [1, 2, 3]) {
    const f = managementFixture(t);
    const target = f.state.credentials[1];
    assert.ok(target);
    const operationId = "00000000-0000-4000-8000-000000000090";
    const recoveryId = `access-management.key-exchange.${operationId}`;
    const remove = fs.rmSync;
    let removals = 0;
    if (phase < 3)
      fs.rmSync = (file, options) => {
        if (
          String(file) ===
            path.join(f.directory, "access-management.pending.json") &&
          ++removals === phase
        )
          throw new Error("injected_stop");
        return remove(file, options);
      };
    try {
      exchangeCredentialsFromHost(
        f.root,
        1,
        operationId,
        "targeted",
        target.userId,
        [target.credentialId],
        true,
      );
    } finally {
      fs.rmSync = remove;
    }
    const current = path.join(f.directory, "access-management.json");
    const before = fs.readFileSync(current);
    if (phase < 3)
      assert.equal(
        readKeyExchangeStateFromHost(f.root, recoveryId).status,
        "unavailable",
      );
    const result = readKeyExchangeState(
      f.root,
      f.tokens.administrator,
      recoveryId,
    );
    assert.equal(result.status, "observed");
    if (result.status !== "observed") continue;
    const snapshot = result.snapshot;
    assert.equal(snapshot.revision, phase + 1);
    assert.equal(
      snapshot.stage,
      ["prepared", "revoked", "credential_stored"][phase - 1],
    );
    assert.equal(snapshot.entry, "host");
    assert.deepEqual(snapshot.oldCredentialIds, [target.credentialId]);
    assert.deepEqual(
      Object.keys(snapshot).sort(),
      [
        "entry",
        "oldCredentialIds",
        "operationId",
        "recipientUserId",
        "recoveryId",
        "revision",
        "scope",
        "stage",
        ...(phase === 3 ? ["newCredentialId", "presentation"] : []),
      ].sort(),
    );
    if (snapshot.stage === "credential_stored")
      assert.equal(snapshot.presentation, "not_attempted");
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(Object.isFrozen(snapshot.oldCredentialIds), true);
    assert.deepEqual(readKeyExchangeStateFromHost(f.root, recoveryId), result);
    assert.deepEqual(fs.readFileSync(current), before);
    assert.equal(
      exchangeCredentials(
        f.root,
        f.tokens.administrator,
        snapshot.revision,
        operationId,
        "targeted",
        target.userId,
        [target.credentialId],
        false,
      ).status,
      "unavailable",
    );
    assert.deepEqual(fs.readFileSync(current), before);
    if (snapshot.stage === "credential_stored") {
      const started = updateCredentialPresentationState(f.root, {
        credentialId: snapshot.newCredentialId,
        issuanceOperationId: operationId,
        expectedRevision: snapshot.revision,
        target: "unconfirmed",
      });
      assert.equal(started.status, "completed");
      if (started.status !== "completed") continue;
      for (const presentation of ["unconfirmed", "confirmed"] as const) {
        if (presentation === "confirmed")
          assert.equal(
            updateCredentialPresentationState(f.root, {
              credentialId: snapshot.newCredentialId,
              issuanceOperationId: operationId,
              expectedRevision: snapshot.revision + 1,
              target: "confirmed",
              presentationOperationId: started.value.presentationOperationId,
            }).status,
            "completed",
          );
        const bytesBeforeRead = fs.readFileSync(current);
        const observed = readKeyExchangeState(
          f.root,
          f.tokens.administrator,
          recoveryId,
        );
        assert.equal(observed.status, "observed");
        if (observed.status !== "observed") continue;
        assert.deepEqual(observed.snapshot, {
          ...snapshot,
          revision:
            snapshot.revision + (presentation === "unconfirmed" ? 1 : 2),
          presentation,
        });
        assert.deepEqual(
          readKeyExchangeStateFromHost(f.root, recoveryId),
          observed,
        );
        assert.deepEqual(fs.readFileSync(current), bytesBeforeRead);
      }
    }
  }
});

/**
 * Workbench自己交換後のHost観測を固定する。
 * @responsibility 旧Bearerの失効と起点を維持した非秘密観測を分ける。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 三Roleの自己生成Rootと管理者資格。
 * @stimulus Workbenchで自己交換し旧BearerとHostでexact参照を読む。
 * @observation 固定拒否、元入口・旧集合・新資格・改訂、current byte。
 * @oracle 旧資格では取得不可。Hostはworkbench起点を保持して現在段階だけ返す。
 * @cleanup Fixture回収。
 * @boundary 現在資格とHostの内部読取り。
 */
test("交換状態ReaderはWorkbench自己交換後もHostで起点を保持する", (t) => {
  const f = managementFixture(t);
  const target = f.state.credentials[0];
  assert.ok(target);
  const operationId = "00000000-0000-4000-8000-000000000090";
  const result = exchangeCredentials(
    f.root,
    f.tokens.administrator,
    1,
    operationId,
    "targeted",
    target.userId,
    [target.credentialId],
    false,
  );
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  const current = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(current);
  assert.deepEqual(
    readKeyExchangeState(f.root, f.tokens.administrator, result.recoveryId),
    { status: "unavailable", reason: "key_exchange_state_unavailable" },
  );
  assert.deepEqual(readKeyExchangeStateFromHost(f.root, result.recoveryId), {
    status: "observed",
    snapshot: {
      revision: 4,
      recoveryId: result.recoveryId,
      operationId,
      entry: "workbench",
      scope: "targeted",
      recipientUserId: target.userId,
      oldCredentialIds: [target.credentialId],
      stage: "credential_stored",
      newCredentialId: result.credentialId,
      presentation: "not_attempted",
    },
  });
  assert.deepEqual(fs.readFileSync(current), before);
});

/**
 * 現在認可を先行材料処置より前に反証する。
 * @responsibility 未許可・別参照・record不存在を同じ未取得へ閉じる。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition stored交換とbase／next一致の通常pending。
 * @stimulus 非管理者・失効資格・別参照を読み、許可Actorの処置とfresh読取りを分ける。
 * @observation currentと材料byte、固定結果と次要求改訂。
 * @oracle 拒否時材料保持、処置要求fact0。不存在から完了を推定しない。
 * @cleanup Fixture回収。
 * @boundary 現在認証・exact参照・材料処置。
 */
test("交換状態Readerは現在認可と材料処置をfresh観測から分ける", (t) => {
  for (const published of [false, true]) {
    const f = managementFixture(t);
    const target = f.state.credentials[1];
    assert.ok(target);
    const operationId = "00000000-0000-4000-8000-000000000090";
    const recoveryId = `access-management.key-exchange.${operationId}`;
    const stored = exchangeCredentialsFromHost(
      f.root,
      1,
      operationId,
      "targeted",
      target.userId,
      [target.credentialId],
      true,
    );
    assert.equal(stored.status, "completed");
    const current = path.join(f.directory, "access-management.json");
    const saved = JSON.parse(
      fs.readFileSync(current, "utf8"),
    ) as AccessManagementState;
    const next = structuredClone(saved);
    next.revision++;
    next.operationId = "00000000-0000-4000-8000-000000000091";
    prepare({ ...f, state: saved }, next);
    if (published) fs.writeFileSync(current, bytes(next));
    const before = fs
      .readdirSync(f.directory)
      .map((file) => [file, fs.readFileSync(path.join(f.directory, file))]);
    const unavailable = {
      status: "unavailable",
      reason: "key_exchange_state_unavailable",
    };
    for (const token of [f.tokens.manager, f.tokens.developer, "invalid"])
      assert.deepEqual(
        readKeyExchangeState(f.root, token, recoveryId),
        unavailable,
      );
    assert.deepEqual(
      readKeyExchangeState(
        f.root,
        f.tokens.administrator,
        "access-management.key-exchange.00000000-0000-4000-8000-000000000092",
      ),
      unavailable,
    );
    assert.deepEqual(
      fs
        .readdirSync(f.directory)
        .map((file) => [file, fs.readFileSync(path.join(f.directory, file))]),
      before,
    );
    assert.deepEqual(
      readKeyExchangeState(f.root, f.tokens.administrator, recoveryId),
      unavailable,
    );
    const observed = readKeyExchangeState(
      f.root,
      f.tokens.administrator,
      recoveryId,
    );
    assert.equal(observed.status, "observed");
    if (observed.status === "observed")
      assert.equal(observed.snapshot.revision, published ? 5 : 4);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * Readerの観測・清掃・解放不明とcredential baseを反証する。
 * @responsibility 不明時の古いSnapshot返却と自動出版を行わない。
 * @trace RFD-IT-017
 * @precondition 自己生成stored交換。
 * @stimulus read／cleanup／Lock故障、破損pending、credential base材料。
 * @observation fixed未取得、current保持、材料保持、復元後fresh観測。
 * @oracle 全故障fact0。credential base自動処置0、生成0。
 * @cleanup Hook復元とFixture回収。
 * @boundary 完全current・短命材料・外側Lock。
 */
test("交換状態Readerは観測清掃解放不明とcredential baseを保持する", (t) => {
  for (const mode of [
    "read",
    "cleanup",
    "lock",
    "corrupt",
    "credential_base",
  ] as const) {
    const f = managementFixture(t);
    const target = f.state.credentials[1];
    assert.ok(target);
    const operationId = "00000000-0000-4000-8000-000000000090";
    const recoveryId = `access-management.key-exchange.${operationId}`;
    exchangeCredentialsFromHost(
      f.root,
      1,
      operationId,
      "targeted",
      target.userId,
      [target.credentialId],
      true,
    );
    const current = path.join(f.directory, "access-management.json");
    const saved = JSON.parse(
      fs.readFileSync(current, "utf8"),
    ) as AccessManagementState;
    const pending = path.join(f.directory, "access-management.pending.json");
    if (mode === "cleanup" || mode === "credential_base") {
      const next = structuredClone(saved);
      next.revision++;
      next.operationId = "00000000-0000-4000-8000-000000000091";
      prepare({ ...f, state: saved }, next);
      if (mode === "credential_base") {
        const material = JSON.parse(fs.readFileSync(pending, "utf8"));
        material.kind = "credential";
        fs.writeFileSync(pending, bytes(material));
      }
    } else if (mode === "corrupt") fs.writeFileSync(pending, "{");
    const before = fs.readFileSync(current);
    const open = fs.openSync;
    const remove = fs.rmSync;
    if (mode === "read")
      fs.openSync = (file, flags, permissions) => {
        if (String(file) === current) throw new Error("injected_read");
        return open(file, flags, permissions);
      };
    if (mode === "cleanup" || mode === "lock")
      fs.rmSync = (file, options) => {
        if (
          String(file) ===
          (mode === "lock"
            ? path.join(f.directory, "access-management.lock")
            : pending)
        )
          throw new Error("injected_cleanup");
        return remove(file, options);
      };
    try {
      assert.deepEqual(readKeyExchangeStateFromHost(f.root, recoveryId), {
        status: "unavailable",
        reason: "key_exchange_state_unavailable",
      });
    } finally {
      fs.openSync = open;
      fs.rmSync = remove;
    }
    assert.deepEqual(fs.readFileSync(current), before);
    if (mode === "corrupt" || mode === "credential_base") {
      assert.equal(fs.existsSync(pending), true);
      assert.equal(
        readKeyExchangeStateFromHost(f.root, recoveryId).status,
        "unavailable",
      );
    } else {
      if (mode === "cleanup")
        assert.equal(
          readKeyExchangeStateFromHost(f.root, recoveryId).status,
          "unavailable",
        );
      assert.equal(
        readKeyExchangeStateFromHost(f.root, recoveryId).status,
        "observed",
      );
      assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
    }
  }
});

/**
 * 初回Host特例と不正参照の観測0を固定する。
 * @responsibility 初回途中Workbench・不正形式・record不在を通常読取りへしない。
 * @trace RFD-IT-017
 * @trace RFD-IT-024
 * @precondition 自己生成Rootと初回同User交換。
 * @stimulus 不正参照、record不在、Host指定後のHost／Workbench読取り。
 * @observation open0、閉じた未取得、Hostだけの新確認資格投影。
 * @oracle 初回完了・新生成・提示・record整理0。
 * @cleanup open Hook復元とFixture回収。
 * @boundary 入力・初回段階・現在Authority。
 */
test("交換状態Readerは初回Hostだけと不正参照の観測0を守る", (t) => {
  const f = managementFixture(t);
  const open = fs.openSync;
  let opened = 0;
  fs.openSync = ((...args) => {
    opened++;
    return open(...args);
  }) as typeof fs.openSync;
  try {
    assert.equal(
      readKeyExchangeStateFromHost(f.root, "invalid").status,
      "unavailable",
    );
    assert.equal(opened, 0);
  } finally {
    fs.openSync = open;
  }
  const recoveryId =
    "access-management.key-exchange.00000000-0000-4000-8000-000000000090";
  assert.deepEqual(readKeyExchangeStateFromHost(f.root, recoveryId), {
    status: "unavailable",
    reason: "key_exchange_state_unavailable",
  });
  const admin = f.state.users[0];
  const old = f.state.credentials[0];
  assert.ok(admin && old);
  f.state.users = [admin];
  f.state.credentials = [old];
  old.operationId = f.state.initialization.attemptId;
  f.state.initialization = {
    stage: "credential_stored",
    attemptId: old.operationId,
    userId: admin.userId,
    initialCredentialId: old.credentialId,
    confirmationCredentialId: old.credentialId,
  };
  fs.writeFileSync(
    path.join(f.directory, "access-management.json"),
    bytes(f.state),
  );
  const stored = exchangeCredentialsFromHost(
    f.root,
    1,
    "00000000-0000-4000-8000-000000000090",
    "targeted",
    admin.userId,
    [old.credentialId],
    true,
  );
  assert.equal(stored.status, "completed");
  if (stored.status !== "completed") return;
  assert.equal(
    readKeyExchangeState(f.root, stored.token ?? "", recoveryId).status,
    "unavailable",
  );
  const observed = readKeyExchangeStateFromHost(f.root, recoveryId);
  assert.equal(observed.status, "observed");
  if (
    observed.status === "observed" &&
    observed.snapshot.stage === "credential_stored"
  )
    assert.equal(observed.snapshot.newCredentialId, stored.credentialId);
});
