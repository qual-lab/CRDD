/**
 * 修復の純粋技術checkpointと保存前後の遷移を反証する。
 * @packageDocumentation
 * @responsibility 値の成立をOS処置や実回収の証明と区別する。
 * @trace ERB-UT-036
 * @level UT
 * @scope 固定九処置、三用途実体、発行と確認の相関、元修復と分離した回収進捗の純粋値。
 * @boundary N/A: メモリ内の固定値だけ。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeDockerRuntimeRepairCheckpoint as decode,
  dockerRuntimeRepairCheckpointIsSettled as isSettled,
  validateDockerRuntimeRepairCheckpointTransition as transition,
  decodeDockerRuntimeRepairDisposalCheckpoint as decodeDisposal,
  createDockerRuntimeRepairDisposalCheckpoint as createDisposal,
  validateDockerRuntimeRepairDisposalTransition as disposalTransition,
  dockerRuntimeRepairDisposalIsSettled as disposalSettled,
  decodeDockerRuntimeRepairRetentionTargets as decodeTargets,
} from "../../src/index.ts";
import {
  prepareDockerRuntimeRepairSessionCheckpoint as beginSession,
  validateDockerRuntimeRepairSessionCheckpoint as sessionTransition,
} from "../../src/desktop/repair-checkpoint.ts";

/**
 * 保持対象の形検査を元checkpointや実観測と分離する。
 * @responsibility 同じNode実体契約を再利用し不明をnullへ変換しない。
 * @trace ERB-UT-036
 * @precondition 非秘密の固定三用途値。
 * @stimulus 余剰・欠測・不正実体・Accessor・Proxyと正常値。
 * @observation 凍結コピー、入力非凍結、hostile trap到達。
 * @oracle 閉じたDTOだけ復号し、現実の引渡しは主張しない。
 * @cleanup N/A: メモリだけ。
 * @boundary 値codecのみ。OS／保存なし。
 */
test("保持対象codecは閉じた三用途を独立コピーする", () => {
  const identity = { dev: "1", ino: "2", birthtimeNs: "3" };
  const input = { primary: identity, failed: null, auxiliary: null };
  const result = decodeTargets(input);
  assert.deepEqual(result, input);
  assert.ok(result?.primary);
  assert.notStrictEqual(result, input);
  assert.notStrictEqual(result.primary, identity);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.primary), true);
  assert.equal(Object.isFrozen(identity), false);
  let hits = 0;
  const accessor = {
    failed: null,
    auxiliary: null,
    get primary() {
      hits++;
      return identity;
    },
  };
  const proxy = new Proxy(input, {
    ownKeys() {
      hits++;
      return Reflect.ownKeys(input);
    },
  });
  for (const invalid of [
    null,
    {},
    { ...input, extra: true },
    { primary: identity, failed: null },
    { ...input, primary: { ...identity, dev: "0" } },
    { ...input, primary: { ...identity, ino: "01" } },
    { ...input, primary: { ...identity, birthtimeNs: "1".repeat(41) } },
    { ...input, primary: { ...identity, extra: true } },
    accessor,
    proxy,
  ])
    assert.equal(decodeTargets(invalid), null);
  assert.equal(hits, 0);
  identity.ino = "9";
  assert.equal(result.primary.ino, "2");
});

const actionNames = [
  "stop_runtime",
  "terminate_runtime",
  "stop_backend",
  "retain_runtime",
  "start_runtime",
  "stop_failed_runtime",
  "retain_failed_runtime",
  "retain_auxiliary_runtime",
  "restart_runtime",
] as const;
const directoryNames = ["primary", "failed", "auxiliary"] as const;
const id = { dev: "1", ino: "2", birthtimeNs: "3" };

/**
 * 回収進捗の未保存初期値を三用途で構成する。
 * @responsibility 試験ごとに独立した変更可能な入力を返す。
 * @trace ERB-UT-036
 * @precondition N/A: 固定値だけ。
 * @stimulus 各試験から呼び出す。
 * @observation 用途ごとの意図・要求・観測を変更して評価する。
 * @oracle 全用途が未保存・未発行・未観測である。
 * @cleanup N/A: メモリ値だけ。
 * @boundary 実Writer・物理処置・現在許可は扱わない。
 */
function initialDisposal() {
  return {
    directories: Object.fromEntries(
      directoryNames.map((purpose) => [
        purpose,
        {
          intent: "not_saved",
          request: "not_issued",
          absence: "unobserved",
        },
      ]),
    ) as Record<
      (typeof directoryNames)[number],
      { intent: string; request: string; absence: string }
    >,
  };
}

/**
 * 回収判断用初期値が削除意図を先取りしないことを確認する。
 * @responsibility 全三用途の初期値と呼出し間の独立性を固定する。
 * @trace ERB-UT-036
 * @precondition 外部資源なし。
 * @stimulus 公開initializerを二回呼び出す。
 * @observation 全文・各用途の参照・凍結状態・decoder。
 * @oracle 独立の初期値と一致し、全階層が凍結される。
 * @cleanup N/A: メモリのみ。
 * @boundary 物理保存・削除・Authorityは対象外。
 */
test("回収checkpoint: 初期化は削除意図を保存せず独立凍結値を返す", () => {
  const a = createDisposal();
  const b = createDisposal();
  assert.deepEqual(a, initialDisposal());
  assert.deepEqual(a, decodeDisposal(a));
  assert.notEqual(a, b);
  assert.notEqual(a.directories, b.directories);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.directories));
  for (const purpose of directoryNames) {
    assert.notEqual(a.directories[purpose], b.directories[purpose]);
    assert.ok(Object.isFrozen(a.directories[purpose]));
  }
});

/**
 * 回収値の全tupleと一用途遷移を有限集合で反証する。
 * @responsibility 意図の飛越し・要求不明の消去・確定後発行を拒否する。
 * @trace ERB-UT-036
 * @precondition 三用途それぞれに同じ18組合せを与える。
 * @stimulus 合法10形の100前後組を各用途へ適用する。
 * @observation decoder、purpose固定validator、元入力全文を照合する。
 * @oracle 独立の固定許可行列と一致し、他用途変更と未知purposeは拒否する。
 * @cleanup N/A: 値だけ。
 * @boundary 保存前削除0・fresh実体・Scope・Authorityは後続ITの検証義務。
 */
test("回収checkpoint: 合法10形と300遷移は元修復を変更せず閉じる", () => {
  const tuples: Array<{ intent: string; request: string; absence: string }> = [
    { intent: "not_saved", request: "not_issued", absence: "unobserved" },
    ...["not_issued", "issued", "unknown"].flatMap((request) =>
      ["unobserved", "confirmed_absent", "unknown"].map((absence) => ({
        intent: "saved",
        request,
        absence,
      })),
    ),
  ];
  const allowed = [
    [0, 1],
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
    [2],
    [2, 3, 5, 6, 8, 9],
    [4, 5, 6],
    [5],
    [5, 6],
    [7, 8, 9],
    [8],
    [8, 9],
  ];
  for (const purpose of directoryNames) {
    for (const intent of ["not_saved", "saved"])
      for (const request of ["not_issued", "issued", "unknown"])
        for (const absence of ["unobserved", "confirmed_absent", "unknown"]) {
          const value = initialDisposal();
          value.directories[purpose] = { intent, request, absence };
          assert.equal(
            decodeDisposal(value) !== null,
            intent === "saved" ||
              (request === "not_issued" && absence === "unobserved"),
          );
        }
    for (const [a, beforeTuple] of tuples.entries())
      for (const [b, afterTuple] of tuples.entries()) {
        const before = initialDisposal(),
          after = initialDisposal();
        before.directories[purpose] = { ...beforeTuple };
        after.directories[purpose] = { ...afterTuple };
        const original = structuredClone(before);
        assert.equal(
          disposalTransition(before, after, purpose),
          allowed[a]?.includes(b),
          `${purpose}:${a}>${b}`,
        );
        assert.deepEqual(before, original);
        const other = directoryNames.find((key) => key !== purpose);
        assert.ok(other);
        after.directories[other] = {
          intent: "saved",
          request: "not_issued",
          absence: "unobserved",
        };
        assert.equal(disposalTransition(before, after, purpose), false);
      }
  }
  for (const purpose of [
    null,
    undefined,
    "other",
    "",
    0,
    {},
    Symbol("purpose"),
  ])
    assert.equal(
      disposalTransition(initialDisposal(), initialDisposal(), purpose),
      false,
    );
});

/**
 * 回収値の閉集合・独立コピーとhostile入力拒否を確認する。
 * @responsibility getter・Proxyの実行と非正規値の補完を防ぐ。
 * @trace ERB-UT-036
 * @precondition 正規初期値と三層の不正値を使う。
 * @stimulus 余剰・欠測・継承・配列・未知値・Accessor・Proxyを与える。
 * @observation null拒否、trap件数、freezeと入力変更後のコピーを確認する。
 * @oracle 不正値はすべてnull、trap0、正規結果は全層で凍結・独立する。
 * @cleanup N/A: 値だけ。
 * @boundary 復号成功は実保存・実資源不存在を証明しない。
 */
test("回収checkpoint: 閉集合と独立コピーを固定しhostile入力を実行しない", () => {
  const input = initialDisposal();
  const result = decodeDisposal(input);
  assert.ok(
    result && Object.isFrozen(result) && Object.isFrozen(result.directories),
  );
  for (const purpose of directoryNames)
    assert.ok(Object.isFrozen(result.directories[purpose]));
  input.directories.primary.intent = "saved";
  assert.equal(result.directories.primary.intent, "not_saved");
  let traps = 0;
  const getter = {
    get directories() {
      traps++;
      throw Error("unexpected_getter");
    },
  };
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        traps++;
        throw Error("unexpected_proxy");
      },
    },
  );
  const initial = initialDisposal();
  for (const invalid of [
    null,
    [],
    {},
    Object.create(initial),
    { ...initial, extra: true },
    getter,
    proxy,
    { directories: proxy },
    { directories: [] },
    { directories: { ...initial.directories, primary: proxy } },
    {
      directories: {
        ...initial.directories,
        primary: {
          ...initial.directories.primary,
          get request() {
            traps++;
            throw Error("unexpected_getter");
          },
        },
      },
    },
    {
      directories: {
        ...initial.directories,
        primary: { ...initial.directories.primary, request: "invalid" },
      },
    },
    {
      directories: {
        ...initial.directories,
        primary: { ...initial.directories.primary, intent: "invalid" },
      },
    },
    {
      directories: {
        ...initial.directories,
        primary: { ...initial.directories.primary, absence: "invalid" },
      },
    },
    {
      directories: {
        ...initial.directories,
        primary: { ...initial.directories.primary, extra: true },
      },
    },
    { directories: { ...initial.directories, primary: undefined } },
  ]) {
    assert.equal(decodeDisposal(invalid), null);
    assert.equal(disposalSettled(invalid), false);
    assert.equal(disposalTransition(initial, invalid, "primary"), false);
    assert.equal(disposalTransition(invalid, initial, "primary"), false);
  }
  assert.equal(traps, 0);
});

/**
 * 不明な過去要求を維持した値上終端を確認する。
 * @responsibility 三用途の一部確認を全体完了へ昇格しない。
 * @trace ERB-UT-036
 * @precondition 各用途は保存意図あり・現在不存在確認済みとする。
 * @stimulus 要求未発行・発行・不明を混在し、一用途ずつ確認を欠測する。
 * @observation predicate、過去unknownの不変、旧checkpointのdecoderを確認する。
 * @oracle 全用途確認時だけtrue。unknown要求を消さず、旧DTOへ混入しない。
 * @cleanup N/A: 値だけ。
 * @boundary 後続Driverの実観測／保存確認・Native cleanupは別条件。
 */
test("回収checkpoint: 不明要求を残して三用途の不存在だけを終端判定する", () => {
  const value = initialDisposal();
  for (const [index, purpose] of directoryNames.entries())
    value.directories[purpose] = {
      intent: "saved",
      request: ["not_issued", "issued", "unknown"][index] ?? "invalid",
      absence: "confirmed_absent",
    };
  const before = structuredClone(value);
  assert.equal(disposalSettled(value), true);
  assert.deepEqual(value, before);
  for (const purpose of directoryNames) {
    for (const absence of ["unknown", "unobserved"]) {
      const missing = structuredClone(value);
      missing.directories[purpose].absence = absence;
      assert.ok(decodeDisposal(missing));
      assert.equal(disposalSettled(missing), false);
      assert.equal(disposalTransition(value, missing, purpose), false);
    }
  }
  assert.equal(decode(value), null);
  assert.equal(decodeDisposal(initial()), null);
});

/**
 * 観測資源の回収不明を既存失敗fieldへ接続する。
 * @responsibility Native成功による解除と失敗理由上書きを拒否する。
 * @trace ERB-UT-036
 * @precondition 固定checkpointだけ。
 * @stimulus pendingから観測回収不明、理由差替え・解除・fresh準備を試す。
 * @observation codec、通常遷移、Session準備。
 * @oracle unknownだけ受理し、非null理由保持、fresh拒否。
 * @cleanup N/A: 値のみ。
 * @boundary 技術資源cleanupの純粋契約。
 */
test("修復checkpoint: 観測回収不明は成功や別理由へ畳まない", () => {
  const before = { ...initial(), cleanup: "pending" };
  const failed = {
    ...before,
    cleanup: "unknown",
    cleanupFailure: "observation_cleanup_unknown",
  };
  assert.ok(decode(failed));
  assert.equal(transition(before, failed), true);
  assert.equal(decode({ ...failed, cleanup: "confirmed" }), null);
  assert.equal(transition(failed, { ...failed, cleanupFailure: null }), false);
  assert.equal(
    transition(failed, { ...failed, cleanupFailure: "helper_cleanup_unknown" }),
    false,
  );
  assert.equal(beginSession(failed), null);
});

/**
 * 前呼出し回収済みからのfresh準備だけを分離する。
 * @responsibility 通常巻戻し拒否を維持し、失敗と他の事実の消去を反証する。
 * @trace ERB-UT-036
 * @precondition メモリ内の固定checkpointだけ。
 * @stimulus cleanup四状態、失敗記録と候補の各fieldを変える。
 * @observation 専用候補の完全一致と通常遷移の拒否。
 * @oracle confirmed・失敗なしだけcleanup pendingへ移り、他fieldは不変。
 * @cleanup N/A: メモリ値のみ。
 * @boundary N/A: OS取得と上位の修復phaseは別試験。
 */
test("修復checkpoint: cleanなfresh Session準備だけを別遷移にする", () => {
  const before = { ...initial(), cleanup: "confirmed" };
  const after = beginSession(before);
  assert.ok(after);
  assert.equal(after.cleanup, "pending");
  assert.deepEqual({ ...after, cleanup: "confirmed" }, decode(before));
  assert.equal(transition(before, after), false);
  assert.equal(sessionTransition(before, after), true);
  assert.equal(sessionTransition(after, after), false);
  assert.ok(Object.isFrozen(after));
  for (const cleanup of ["not_requested", "pending", "unknown"]) {
    assert.equal(beginSession({ ...before, cleanup }), null);
    assert.equal(sessionTransition({ ...before, cleanup }, after), false);
  }
  for (const cleanupFailure of [
    "helper_cleanup_unknown",
    "helper_protocol_failed",
  ]) {
    assert.equal(beginSession({ ...before, cleanupFailure }), null);
  }
  for (const changed of [
    { ...after, engine: "ready" },
    { ...after, hostSafety: "safe" },
    { ...after, cleanupFailure: "helper_cleanup_unknown" },
    {
      ...after,
      actions: {
        ...after.actions,
        stop_runtime: {
          intent: "not_saved",
          request: "not_issued",
          result: "not_required",
        },
      },
    },
    { ...after, extra: true },
  ])
    assert.equal(sessionTransition(before, changed), false);
});

/**
 * 外部資源を持たない固定初期値を生成する。
 * @responsibility 毎Caseが独立した可変入力を使う。
 * @trace ERB-UT-036
 * @precondition メモリ内の固定値だけ。
 * @stimulus 九処置と三用途の初期値を構成する。
 * @observation 呼出し側が返却値を検査する。
 * @oracle 発行・観測を捏造しない初期値。
 * @cleanup N/A: 外部資源なし。
 * @boundary N/A: 値生成だけ。
 */
function initial() {
  return {
    actions: Object.fromEntries(
      actionNames.map((key) => [
        key,
        { intent: "not_saved", request: "not_issued", result: "unobserved" },
      ]),
    ) as Record<
      (typeof actionNames)[number],
      { intent: string; request: string; result: string }
    >,
    directories: Object.fromEntries(
      directoryNames.map((key) => [
        key,
        {
          expected: null as typeof id | null,
          source: { state: "unobserved", identity: null as typeof id | null },
          retained: { state: "unobserved", identity: null as typeof id | null },
        },
      ]),
    ) as Record<
      (typeof directoryNames)[number],
      {
        expected: typeof id | null;
        source: { state: string; identity: typeof id | null };
        retained: { state: string; identity: typeof id | null };
      }
    >,
    engine: "unobserved",
    stale: "unknown",
    hostSafety: "unknown",
    cleanup: "not_requested",
    cleanupFailure: null as string | null,
  };
}

/**
 * 九処置の意図保存、発行、確認と退避実体を順に接続する。
 * @responsibility 全固定slotの肯定経路と凍結コピーを観測する。
 * @trace ERB-UT-036
 * @precondition 固定初期値と自己生成Identity。
 * @stimulus 各slotを意図保存→発行→結果確定へ進める。
 * @observation 各前後の復号・遷移と元値の不変性。
 * @oracle 九slotすべて正順序だけで確定し、退避はsource不存在とtarget同実体を要求する。
 * @cleanup N/A: メモリ内だけ。
 * @boundary N/A: 純粋codec。
 */
test("修復checkpoint: 九処置の保存意図・発行・確認を分ける", () => {
  let current = initial();
  const first = decode(current);
  assert.ok(first);
  assert.ok(Object.isFrozen(first.actions.stop_runtime));
  current.actions.stop_runtime.intent = "saved";
  assert.equal(first.actions.stop_runtime.intent, "not_saved");
  current = initial();
  for (const [index, key] of actionNames.entries()) {
    let next = structuredClone(current);
    next.actions[key].intent = "saved";
    assert.ok(transition(current, next), `${key}: intent`);
    current = next;
    next = structuredClone(current);
    next.actions[key].request = "issued";
    assert.ok(transition(current, next), `${key}: issued`);
    current = next;
    next = structuredClone(current);
    next.actions[key].result = "confirmed";
    const purpose =
      index === 3
        ? "primary"
        : index === 6
          ? "failed"
          : index === 7
            ? "auxiliary"
            : null;
    if (purpose) {
      next.directories[purpose] = {
        expected: id,
        source: { state: "absent", identity: null },
        retained: { state: "present", identity: id },
      };
      next.stale = "retained";
    }
    assert.ok(decode(next), `${key}: complete shape`);
    assert.ok(transition(current, next), `${key}: confirmed`);
    current = next;
  }
  const snapshot = decode(current);
  assert.ok(snapshot);
  assert.equal(snapshot.actions.restart_runtime.result, "confirmed");
  assert.equal(snapshot.stale, "retained");
  assert.equal(isSettled(snapshot), true);
});

/**
 * 未観測と処置不要を区別し、清掃の全遷移を反証する。
 * @responsibility 部分完了と清掃巻戻しを終端へ昇格しない。
 * @trace ERB-UT-036
 * @precondition 外部資源なしの固定checkpoint。
 * @stimulus 九slotの未観測、全不要、4×4清掃遷移と失敗相関を与える。
 * @observation decoder、技術終端predicate、遷移validatorの結果。
 * @oracle 初期値は復号可だが非終端。清掃不明後は確認への収束だけを許す。
 * @cleanup N/A: 値のみ。
 * @boundary N/A: 実清掃の証明ではない。
 */
test("修復checkpoint: 九処置の終端と清掃の単調matrix", () => {
  assert.ok(decode(initial()));
  assert.equal(isSettled(initial()), false);
  assert.equal(isSettled({}), false);
  const complete = initial();
  for (const name of actionNames)
    complete.actions[name].result = "not_required";
  assert.equal(isSettled(complete), true);
  for (const name of actionNames) {
    const incomplete = structuredClone(complete);
    incomplete.actions[name].result = "unobserved";
    assert.ok(decode(incomplete));
    assert.equal(isSettled(incomplete), false, name);
  }
  const allowed = {
    not_requested: ["not_requested", "pending", "unknown", "confirmed"],
    pending: ["pending", "unknown", "confirmed"],
    unknown: ["unknown", "confirmed"],
    confirmed: ["confirmed"],
  };
  for (const before of Object.keys(allowed) as (keyof typeof allowed)[])
    for (const after of Object.keys(allowed)) {
      const a = { ...initial(), cleanup: before };
      const b = { ...initial(), cleanup: after };
      assert.equal(
        transition(a, b),
        allowed[before].includes(after),
        `${before}>${after}`,
      );
    }
  for (const cleanup of Object.keys(allowed)) {
    const value = {
      ...initial(),
      cleanup,
      cleanupFailure: "helper_cleanup_unknown",
    };
    assert.equal(
      decode(value) !== null,
      cleanup === "unknown" || cleanup === "confirmed",
    );
  }
});

/**
 * 不正構造と発行・結果の相関違反を処置前に拒否する。
 * @responsibility 未評価field、前処置飛越、意図なし発行を許可しない。
 * @trace ERB-UT-036
 * @precondition 初期値とメモリ内の変異。
 * @stimulus 各slotの欠落／余分、発行・確認の不正組合せを与える。
 * @observation 復号nullとgetter／Proxy評価0。
 * @oracle 単独で妥当そうなfieldから全体受理を推定しない。
 * @cleanup N/A: 外部資源なし。
 * @boundary N/A: 値検査のみ。
 */
test("修復checkpoint: 構造・順序・hostile値を拒否する", () => {
  for (const key of actionNames) {
    const missing = initial();
    Reflect.deleteProperty(missing.actions, key);
    assert.equal(decode(missing), null, `${key}: missing`);
    for (const wrong of [
      { intent: "not_saved", request: "issued", result: "unobserved" },
      { intent: "saved", request: "not_issued", result: "confirmed" },
      { intent: "saved", request: "unknown", result: "confirmed" },
      { intent: "saved", request: "issued", result: "not_required" },
    ]) {
      const value = initial();
      value.actions[key] = wrong;
      assert.equal(decode(value), null, `${key}: relation`);
    }
  }
  for (const key of actionNames.slice(1)) {
    const skipped = initial();
    skipped.actions[key].intent = "saved";
    assert.equal(decode(skipped), null, `${key}: order`);
  }
  assert.equal(decode({ ...initial(), disposition: "approved" }), null);
  assert.equal(
    decode({ ...initial(), actions: { ...initial().actions, extra: {} } }),
    null,
  );
  let calls = 0;
  const proxy = new Proxy(
    {},
    {
      getPrototypeOf() {
        calls += 1;
        throw new Error();
      },
    },
  );
  const getter = Object.defineProperty(initial(), "engine", {
    get() {
      calls += 1;
      throw new Error();
    },
  });
  assert.equal(decode(proxy), null);
  assert.equal(decode(getter), null);
  const nested = initial();
  Object.defineProperty(nested.actions, "stop_runtime", {
    get() {
      calls += 1;
      throw new Error();
    },
  });
  assert.equal(decode(nested), null);
  assert.equal(calls, 0);
  assert.equal(decode(Object.create(initial())), null);
});

/**
 * 不明・確定・不要を未発行へ戻さず再処置を抑止する。
 * @responsibility 単独validな値の組でも不正な前後遷移を拒否する。
 * @trace ERB-UT-036
 * @precondition 最初のslotだけを使う固定値。
 * @stimulus 意図前発行、unknown再発行、confirmed／not_required巻戻しを与える。
 * @observation 遷移falseと回収失敗の不変性。
 * @oracle 発行前保存と既知事実の単調性を維持する。
 * @cleanup N/A: 外部資源なし。
 * @boundary N/A: 値比較だけ。
 */
test("修復checkpoint: unknown再発行と既知結果の巻戻しを拒否する", () => {
  const before = initial();
  const issued = initial();
  issued.actions.stop_runtime = {
    intent: "saved",
    request: "issued",
    result: "unobserved",
  };
  assert.ok(decode(issued));
  assert.equal(transition(before, issued), false);
  for (const result of ["confirmed", "unknown"]) {
    const known = structuredClone(issued);
    known.actions.stop_runtime.result = result;
    assert.ok(decode(known));
    assert.equal(transition(known, issued), false);
    assert.equal(transition(known, before), false);
  }
  const unknown = initial();
  unknown.actions.stop_runtime = {
    intent: "saved",
    request: "unknown",
    result: "unknown",
  };
  assert.ok(decode(unknown));
  assert.equal(transition(unknown, issued), false);
  const unnecessary = initial();
  unnecessary.actions.stop_runtime.result = "not_required";
  assert.ok(transition(before, unnecessary));
  assert.equal(transition(unnecessary, issued), false);
  const failed = initial();
  failed.cleanup = "unknown";
  failed.cleanupFailure = "helper_cleanup_unknown";
  const recovered = structuredClone(failed);
  recovered.cleanup = "confirmed";
  assert.ok(transition(failed, recovered));
  recovered.cleanupFailure = null;
  assert.equal(transition(failed, recovered), false);
});

/**
 * 退避実体をPathなしで固定し、不存在と不明を分ける。
 * @responsibility 同名別実体や保持済み対象の消去を拒否する。
 * @trace ERB-UT-036
 * @precondition 三用途の固定実体と観測。
 * @stimulus 期待実体の置換、観測不整合、stale値偽装を与える。
 * @observation 復号または遷移の拒否。
 * @oracle presentだけ実体を持ち、保持済み実体と最初の期待値は変えない。
 * @cleanup N/A: Filesystemなし。
 * @boundary N/A: 値検査のみ。
 */
test("修復checkpoint: 三用途の実体固定と保持を検査する", () => {
  for (const key of directoryNames) {
    const before = initial();
    before.directories[key].expected = id;
    before.directories[key].source = { state: "present", identity: id };
    assert.ok(decode(before));
    const swapped = structuredClone(before);
    const other = { ...id, ino: "4" };
    swapped.directories[key].expected = other;
    swapped.directories[key].source.identity = other;
    assert.ok(decode(swapped));
    assert.equal(transition(before, swapped), false);
    const retained = structuredClone(before);
    retained.directories[key].source = { state: "absent", identity: null };
    retained.directories[key].retained = { state: "present", identity: id };
    retained.stale = "retained";
    assert.ok(transition(before, retained));
    assert.equal(transition(retained, before), false);
    retained.stale = "unknown";
    assert.equal(decode(retained), null);
    const malformed = structuredClone(before);
    malformed.directories[key].source.state = "unknown";
    assert.equal(decode(malformed), null);
  }
});
