/**
 * Runtime署名準備の能力境界の局所拒否を確認する。
 * @packageDocumentation
 * @responsibility 偽造Rootと複製Sessionから準備・清掃Effectを発行しないことを確認する。
 * @trace AIT-IT-013
 * @level IT
 * @scope AIT-IT-013の固定Snapshot・配置前準備の部分境界。署名・配置成立は未評価。
 * @boundary 準備Module→既存Root能力と一時操作Owner。実署名、実Repository候補、Process起動、昇格は対象外。
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test, { mock } from "node:test";
import {
  createTemporaryOperation,
  resumeTemporaryOperation,
  settleTemporaryOperation,
} from "../../../domain-model/src/index.ts";
import {
  verifyRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/repository/location.ts";
import {
  prepareReleaseRuntime,
  recoverAppliedReleaseRuntimePreparation,
  releaseReleaseRuntimePreparation,
  type ReleaseRuntimePreparationSession,
} from "../../scripts/prepare-release-runtime.ts";
import { createFixedRuntimeSigningFixture } from "../fixtures/fixed-runtime-signing-fixture.ts";

/**
 * Root能力のJSON複製を準備Authorityへ昇格しない。
 * @responsibility 固定版Identityがあっても偽造Rootを拒否する。
 * @trace AIT-IT-013
 * @precondition 実Repositoryや一時領域を作成しない。
 * @stimulus Rootの形だけを持つ非登録objectを渡す。
 * @observation 停止、Sessionなし、回復参照なし。
 * @oracle 展開や一時操作作成前の拒否。
 * @cleanup N/A: 作成Effectなし。
 * @boundary 準備利用側→VCS Root所有者。
 */
test("preparation rejects a forged repository capability before effects", () => {
  const result = prepareReleaseRuntime({} as VerifiedRepositoryRoot, {
    commit: "a".repeat(40),
    tree: "b".repeat(40),
    operationId: "caller-operation",
    identity: "caller-identity",
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.session, null);
  assert.equal(result.recoveryReference, null);
  assert.equal(result.cleanupConfirmed, true);
});

/**
 * 保存・複製したSessionを清掃能力へ昇格しない。
 * @responsibility 既存exact能力なしの終了要求を拒否する。
 * @trace AIT-IT-013
 * @precondition 実Operationや子Processは存在しない。
 * @stimulus JSONから復元した空参照を全終端結果で渡す。
 * @observation 停止、清掃未成立、回復Authorityなし。
 * @oracle 偽造Sessionを既存Ownerへ渡さない。
 * @cleanup N/A: 清掃Effectなし。
 * @boundary 準備利用側→Process-local Session所有者。
 */
test("settlement rejects serialized sessions for every terminal outcome", () => {
  const clone = JSON.parse("{}") as ReleaseRuntimePreparationSession;
  for (const outcome of [
    "completed",
    "failed",
    "cancelled",
    "timed_out",
    "parent_lost",
  ] as const) {
    const result = releaseReleaseRuntimePreparation(clone, outcome);
    assert.equal(result.status, "blocked");
    assert.equal(result.cleanupConfirmed, false);
    assert.equal(result.recoveryRequired, false);
    assert.equal(result.recoveryReference, null);
  }
});

/**
 * 固定版入力をdescriptorから検証し、外部コードを実行しない。
 * @responsibility getter・Proxy・余分なfieldと不正なcaller-known両Identityの拒否を確認する。
 * @trace AIT-IT-013
 * @precondition 実Root、候補、秘密を使用しない。
 * @stimulus accessor、Proxy、非閉Schemaを渡す。
 * @observation 停止とgetter/trap実行0。
 * @oracle 入力評価からEffectや署名へ進まない。
 * @cleanup N/A: 書込みEffectなし。
 * @boundary 利用側入力→plain snapshot。
 */
test("fixed identity rejects accessors and proxies without evaluating them", () => {
  const verified = verifyRepositoryRoot(
    path.resolve(import.meta.dirname, "../../../.."),
  );
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw new Error("test_root_invalid");
  const valid = {
    commit: "a".repeat(40),
    tree: "b".repeat(40),
    operationId: "caller-operation",
    identity: "caller-identity",
  };
  let evaluated = 0;
  const accessor = {
    get commit() {
      evaluated += 1;
      throw new Error("must_not_run");
    },
    tree: "b".repeat(40),
    operationId: "caller-operation",
    identity: "caller-identity",
  };
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        evaluated += 1;
        throw new Error("must_not_run");
      },
      get() {
        evaluated += 1;
        throw new Error("must_not_run");
      },
    },
  );
  const invalidInputs: unknown[] = [
    accessor,
    proxy,
    { ...valid, extra: true },
    { ...valid, commit: 1 },
    { commit: valid.commit, tree: valid.tree },
    null,
  ];
  for (const field of ["operationId", "identity"] as const) {
    for (const invalid of [
      undefined,
      null,
      1,
      "",
      ".bad",
      "../bad",
      "a".repeat(129),
    ])
      invalidInputs.push({ ...valid, [field]: invalid });
    invalidInputs.push(
      Object.defineProperty({ ...valid }, field, {
        get() {
          evaluated += 1;
          throw new Error("must_not_read_identity");
        },
      }),
    );
  }
  let writes = 0;
  const mkdir = mock.method(fs, "mkdirSync", () => {
    writes += 1;
    throw new Error("must_not_write");
  });
  const mkdtemp = mock.method(fs, "mkdtempSync", () => {
    writes += 1;
    throw new Error("must_not_write");
  });
  const write = mock.method(fs, "writeFileSync", () => {
    writes += 1;
    throw new Error("must_not_write");
  });
  try {
    for (const input of invalidInputs) {
      const result = prepareReleaseRuntime(verified.capability, input);
      assert.equal(result.status, "blocked");
      assert.equal(result.session, null);
      assert.equal(result.recoveryReference, null);
      assert.equal(result.cleanupConfirmed, true);
    }
    assert.equal(evaluated, 0);
    assert.equal(writes, 0);
  } finally {
    write.mock.restore();
    mkdtemp.mock.restore();
    mkdir.mock.restore();
  }
});

/**
 * 選択固定Git入力の展開から既存Ownerによる終了まで接続する。
 * @responsibility 合成Rootの正常準備と制御記録観測不能時のexact参照保持を確認する。
 * @trace AIT-IT-013
 * @precondition 共通fixtureが非秘密の最小RuntimeとNativeのGit objectを所有する。
 * @stimulus 正常準備・終了後、別の準備操作の制御記録を一時退避し終了を要求する。
 * @observation prepared、選択展開、正常終了の不存在、失敗時参照一致、復元後終了。
 * @oracle caller-known両Identityと返却exact参照が一致し、失敗を清掃成立にせず同じ操作だけが終了する。初回返却前の中断は既存RuntimeData temporary-operation-lifecycle試験のCanonical公開前／初回staging書込み中反例が所有し、この局所試験は実Process喪失を主張しない。
 * @cleanup 全Session終了とfixture.cleanupの不存在確認。実署名・実候補は使用しない。
 * @boundary 合成Git Reader→選択materialize→TemporaryOperation Owner。
 */
test("synthetic fixed runtime prepares and settles with exact failure recovery reference", () => {
  const fixture = createFixedRuntimeSigningFixture("preparation");
  try {
    const verified = verifyRepositoryRoot(fixture.source);
    assert.equal(verified.status, "completed");
    if (verified.status !== "completed")
      throw new Error("fixture_root_invalid");
    const identity = {
      commit: fixture.commit,
      tree: fixture.tree,
      operationId: randomUUID(),
      identity: randomUUID(),
    };
    const expectedReference = {
      operationId: identity.operationId,
      identity: identity.identity,
      owner: "coordinator-release-runtime",
      storage: "signature",
      generation: 1,
    };
    const prepared = prepareReleaseRuntime(verified.capability, identity);
    assert.equal(prepared.status, "prepared");
    if (prepared.status !== "prepared")
      throw new Error("fixture_prepare_failed");
    assert.equal(prepared.crddCommit, fixture.commit);
    assert.equal(prepared.crddTree, fixture.tree);
    assert.equal(prepared.runtimeAuthorityConferred, false);
    assert.deepEqual(prepared.recoveryReference, expectedReference);
    assert.equal(
      path.dirname(path.dirname(prepared.workDirectory)),
      path.join(fixture.source, ".crdd", "tmp"),
    );
    assert.equal(
      fs.existsSync(path.join(prepared.workDirectory, ".git")),
      false,
    );
    const operationDirectory = path.dirname(prepared.workDirectory);
    const control = path.join(
      fixture.source,
      ".crdd/tmp/signature",
      "preparation.json",
    );
    assert.equal(fs.existsSync(control), true);
    const controlBeforeInvalid = fs.readFileSync(control);
    let coerced = 0;
    const coercion = {
      /**
       * 不正終端値の文字列化を検出する。
       * @responsibility 入力拒否時に利用側コードを実行していないことを確認する。
       * @trace AIT-IT-013
       * @precondition 終端値としてobjectを渡す合成試験だけで使用する。
       * @stimulus 文字列化が呼ばれた場合は回数を加算して例外にする。
       * @observation 呼出し回数。
       * @oracle 不正入力の拒否後も呼出し0。
       * @cleanup N/A: Process内の局所値だけを持つ。
       * @boundary 入力objectと終端値検査。
       */
      toString() {
        coerced += 1;
        throw new Error("must_not_coerce_outcome");
      },
    };
    for (const invalid of ["invalid", 0, null, undefined, coercion]) {
      const rejected = releaseReleaseRuntimePreparation(
        prepared.session,
        invalid,
      );
      assert.equal(rejected.status, "blocked");
      assert.equal(rejected.cleanupConfirmed, false);
      assert.equal(rejected.recoveryRequired, false);
      assert.deepEqual(rejected.recoveryReference, prepared.recoveryReference);
      assert.deepEqual(fs.readFileSync(control), controlBeforeInvalid);
      assert.equal(fs.existsSync(prepared.workDirectory), true);
    }
    assert.equal(coerced, 0);
    const settled = releaseReleaseRuntimePreparation(
      prepared.session,
      "completed",
    );
    assert.equal(settled.status, "completed");
    assert.equal(settled.cleanupConfirmed, true);
    assert.equal(settled.recoveryReference, null);
    assert.equal(fs.existsSync(operationDirectory), false);
    assert.equal(fs.existsSync(control), false);
    assert.equal(fs.existsSync(fixture.distributionRoot), true);
    assert.equal(
      releaseReleaseRuntimePreparation(prepared.session, "completed").status,
      "blocked",
    );

    const nextIdentity = {
      ...identity,
      operationId: randomUUID(),
      identity: randomUUID(),
    };
    const next = prepareReleaseRuntime(verified.capability, nextIdentity);
    assert.equal(next.status, "prepared");
    if (next.status !== "prepared") throw new Error("fixture_prepare_failed");
    assert.deepEqual(next.recoveryReference, {
      ...expectedReference,
      operationId: nextIdentity.operationId,
      identity: nextIdentity.identity,
    });
    const nextControl = path.join(
      fixture.source,
      ".crdd/tmp/signature",
      "preparation.json",
    );
    const hiddenControl = `${nextControl}.test-hidden`;
    fs.renameSync(nextControl, hiddenControl);
    try {
      const failed = releaseReleaseRuntimePreparation(next.session, "failed");
      assert.equal(failed.status, "blocked");
      assert.equal(failed.cleanupConfirmed, false);
      assert.deepEqual(failed.recoveryReference, next.recoveryReference);
      assert.equal(fs.existsSync(next.workDirectory), true);
    } finally {
      fs.renameSync(hiddenControl, nextControl);
    }
    const retry = releaseReleaseRuntimePreparation(next.session, "failed");
    assert.equal(retry.status, "completed");
    assert.equal(retry.cleanupConfirmed, true);
    assert.equal(fs.existsSync(path.dirname(next.workDirectory)), false);
    assert.equal(fs.existsSync(nextControl), false);
    assert.equal(fs.existsSync(fixture.distributionRoot), true);

    for (const fault of ["owner_transfer", "removal_failure"] as const) {
      const pendingIdentity = {
        ...identity,
        operationId: randomUUID(),
        identity: randomUUID(),
      };
      const pending = prepareReleaseRuntime(
        verified.capability,
        pendingIdentity,
      );
      assert.equal(pending.status, "prepared");
      if (pending.status !== "prepared")
        throw new Error("fixture_prepare_failed");
      assert.deepEqual(pending.recoveryReference, {
        ...expectedReference,
        operationId: pendingIdentity.operationId,
        identity: pendingIdentity.identity,
      });
      const pendingDirectory = path.dirname(pending.workDirectory);
      const pendingControl = path.join(
        fixture.source,
        ".crdd/tmp/signature",
        "preparation.json",
      );
      const originalRemove = fs.rmSync;
      const removal =
        fault === "removal_failure"
          ? mock.method(
              fs,
              "rmSync",
              (target: fs.PathLike, options?: fs.RmOptions) => {
                if (target === pending.workDirectory)
                  throw new Error("injected_removal_failure");
                return originalRemove(target, options);
              },
            )
          : null;
      let transferred: ReturnType<typeof releaseReleaseRuntimePreparation>;
      try {
        // 合成試験のOwner移送であり、実Process喪失を主張しない。
        transferred = releaseReleaseRuntimePreparation(
          pending.session,
          fault === "owner_transfer" ? "parent_lost" : "failed",
        );
      } finally {
        removal?.mock.restore();
      }
      assert.equal(transferred.status, "blocked");
      assert.equal(transferred.cleanupConfirmed, false);
      assert.equal(transferred.recoveryRequired, true);
      assert.deepEqual(
        transferred.recoveryReference,
        pending.recoveryReference,
      );
      assert.equal(fs.existsSync(pendingDirectory), true);
      assert.equal(
        releaseReleaseRuntimePreparation(pending.session, "failed").status,
        "blocked",
      );
      const resumed = resumeTemporaryOperation(
        verified.capability,
        pending.recoveryReference,
        randomUUID(),
      );
      assert.equal(resumed.status, "completed");
      if (resumed.status !== "completed")
        throw new Error("fixture_resume_failed");
      const recovered = settleTemporaryOperation(
        resumed.capability,
        "failed",
        null,
      );
      assert.equal(recovered.cleanupConfirmed, true);
      assert.equal(fs.existsSync(pendingDirectory), false);
      assert.equal(fs.existsSync(pendingControl), false);
      assert.equal(fs.existsSync(fixture.distributionRoot), true);
    }

    // 合成Manifestで全bytes照合と清掃のみを確認し、真正な署名とは主張しない。
    const manifestRelative =
      "template/tools/coordinator/coordinator-package-manifest.json";
    const formal = path.join(fixture.source, manifestRelative);
    fs.mkdirSync(path.dirname(formal), { recursive: true });
    fs.writeFileSync(formal, "fixture-only-envelope\n");
    for (const isMatching of [false, true]) {
      const owned = createTemporaryOperation(verified.capability, {
        operationId: randomUUID(),
        identity: randomUUID(),
        owner: "coordinator-release-runtime",
        storage: "signature",
        purpose: "fixed-runtime-signing-preparation",
        allowedContent: ["runtime-files", "signed-manifest"],
        evidencePromotion: "not_required",
      });
      assert.equal(owned.status, "completed");
      if (owned.status !== "completed")
        throw new Error("fixture_operation_invalid");
      const candidate = path.join(owned.workDirectory, manifestRelative);
      fs.mkdirSync(path.dirname(candidate), { recursive: true });
      fs.writeFileSync(
        candidate,
        isMatching ? "fixture-only-envelope\n" : "different-envelope\n",
      );
      settleTemporaryOperation(owned.capability, "parent_lost", null);
      const recovered = recoverAppliedReleaseRuntimePreparation(
        verified.capability,
        owned.recoveryReference,
        randomUUID(),
      );
      assert.equal(recovered.status, isMatching ? "completed" : "blocked");
      assert.equal(fs.readFileSync(formal, "utf8"), "fixture-only-envelope\n");
      if (!isMatching) {
        assert.ok(recovered.recoveryReference);
        assert.equal(fs.existsSync(candidate), true);
        const cleanup = resumeTemporaryOperation(
          verified.capability,
          recovered.recoveryReference,
          randomUUID(),
        );
        assert.equal(cleanup.status, "completed");
        if (cleanup.status === "completed")
          assert.equal(
            settleTemporaryOperation(cleanup.capability, "failed", null)
              .cleanupConfirmed,
            true,
          );
      }
      assert.equal(fs.existsSync(path.dirname(owned.workDirectory)), false);
    }
  } finally {
    fixture.cleanup();
  }
});
