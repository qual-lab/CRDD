import assert from "node:assert/strict";
import test from "node:test";

import { createDevelopmentMeasurementConstraints } from "../../src/security/development-measurement-constraints.ts";
import { assertPresent } from "../support/test-support.ts";

const BINDING_HASH =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FIRST_SCOPE_HASH =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SECOND_SCOPE_HASH =
  "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

function observation(wallTimeMs = 100, monotonicTimeMs = wallTimeMs) {
  return { bindingSha256: BINDING_HASH, wallTimeMs, monotonicTimeMs };
}

function configuration() {
  return {
    bindingSha256: BINDING_HASH,
    expiresAtMs: 1_100,
    tasks: [
      { scopeSha256: FIRST_SCOPE_HASH, executor: "codex", reviewer: "claude" },
      { scopeSha256: SECOND_SCOPE_HASH, executor: "claude", reviewer: "codex" },
    ],
  };
}

function createConstraints() {
  const constraints = createDevelopmentMeasurementConstraints(
    configuration(),
    observation(),
  );
  assertPresent(constraints);
  return constraints;
}

function unwrap<T>(
  result: { status: "recorded"; value: T } | { status: "blocked" },
) {
  assert.equal(result.status, "recorded");
  if (result.status !== "recorded") throw new Error("reservation not recorded");
  return result.value;
}

test("2Task各4回、総8回を記録し枠の返却・Task再実行・9回目を拒否する", () => {
  const constraints = createConstraints();
  for (const [scope, executor, reviewer] of [
    [FIRST_SCOPE_HASH, "codex", "claude"],
    [SECOND_SCOPE_HASH, "claude", "codex"],
  ] as const) {
    const taskToken = unwrap(constraints.reserveTask(scope, observation()));
    for (const role of [
      "executor",
      "reviewer",
      "executor",
      "reviewer",
    ] as const) {
      const provider = role === "executor" ? executor : reviewer;
      const invocationToken = unwrap(
        constraints.reserveInvocation(taskToken, provider, role, observation()),
      );
      unwrap(
        constraints.consumeInvocation(
          invocationToken,
          taskToken,
          provider,
          role,
          observation(),
        ),
      );
      assert.equal(
        constraints.consumeInvocation(
          invocationToken,
          taskToken,
          provider,
          role,
          observation(),
        ).status,
        "blocked",
      );
      unwrap(constraints.settleInvocation(invocationToken));
      assert.equal(
        constraints.settleInvocation(invocationToken).status,
        "blocked",
      );
    }
    assert.equal(
      constraints.reserveInvocation(
        taskToken,
        executor,
        "executor",
        observation(),
      ).status,
      "blocked",
    );
    unwrap(constraints.settleTask(taskToken, "finished"));
    assert.equal(
      constraints.reserveTask(scope, observation()).status,
      "blocked",
    );
  }
  assert.deepEqual(constraints.inspect(), {
    productionAuthorityConferred: false,
    invocationCount: 8,
    reservedTaskCount: 2,
    settledTaskCount: 2,
    stopReason: null,
  });
});

test("準備失敗で起動しなくても予約枠を返却せず、重複並行開始を拒否する", () => {
  const constraints = createConstraints();
  const taskToken = unwrap(
    constraints.reserveTask(FIRST_SCOPE_HASH, observation()),
  );
  assert.equal(
    constraints.reserveTask(SECOND_SCOPE_HASH, observation()).status,
    "blocked",
  );
  for (let index = 0; index < 4; index += 1) {
    const token = unwrap(
      constraints.reserveInvocation(
        taskToken,
        "codex",
        "executor",
        observation(),
      ),
    );
    assert.equal(
      constraints.reserveInvocation(
        taskToken,
        "codex",
        "executor",
        observation(),
      ).status,
      "blocked",
    );
    assert.equal(
      constraints.settleTask(taskToken, "finished").status,
      "blocked",
    );
    unwrap(constraints.settleInvocation(token));
    assert.equal(
      constraints.consumeInvocation(
        token,
        taskToken,
        "codex",
        "executor",
        observation(),
      ).status,
      "blocked",
    );
  }
  assert.equal(constraints.inspect().invocationCount, 4);
  assert.equal(
    constraints.reserveInvocation(taskToken, "codex", "executor", observation())
      .status,
    "blocked",
  );
});

for (const scenario of [
  "cancel",
  "wall_expiry",
  "monotonic_expiry",
  "identity",
  "clock_regression",
  "invalid",
] as const) {
  test(`予約後の${scenario}で起動枠消費を拒否し、終了記録だけは可能`, () => {
    const constraints = createConstraints();
    const taskToken = unwrap(
      constraints.reserveTask(FIRST_SCOPE_HASH, observation()),
    );
    const token = unwrap(
      constraints.reserveInvocation(
        taskToken,
        "codex",
        "executor",
        observation(),
      ),
    );
    let next: unknown = observation();
    if (scenario === "cancel") constraints.cancel();
    if (scenario === "wall_expiry") next = observation(1_100, 101);
    if (scenario === "monotonic_expiry") next = observation(101, 1_100);
    if (scenario === "identity")
      next = { ...observation(), bindingSha256: "d".repeat(64) };
    if (scenario === "clock_regression") next = observation(99, 100);
    if (scenario === "invalid") next = null;
    assert.equal(
      constraints.consumeInvocation(token, taskToken, "codex", "executor", next)
        .status,
      "blocked",
    );
    const stopped = constraints.inspect().stopReason;
    assert.notEqual(stopped, null);
    // Restoring the original observation must not resurrect an expired/revoked session.
    assert.equal(
      constraints.consumeInvocation(
        token,
        taskToken,
        "codex",
        "executor",
        observation(),
      ).status,
      "blocked",
    );
    unwrap(constraints.settleInvocation(token));
    unwrap(constraints.settleTask(taskToken, "finished"));
    assert.equal(
      constraints.reserveTask(SECOND_SCOPE_HASH, observation()).status,
      "blocked",
    );
    assert.equal(constraints.inspect().stopReason, stopped);
    assert.equal(constraints.inspect().productionAuthorityConferred, false);
  });
}

test("cleanup不明は後続Taskを拒否し、遅延した既存呼出しの終了記録で解除しない", () => {
  const constraints = createConstraints();
  const taskToken = unwrap(
    constraints.reserveTask(FIRST_SCOPE_HASH, observation()),
  );
  const token = unwrap(
    constraints.reserveInvocation(
      taskToken,
      "codex",
      "executor",
      observation(),
    ),
  );
  unwrap(constraints.settleTask(taskToken, "cleanup_unknown"));
  unwrap(constraints.settleInvocation(token));
  assert.equal(
    constraints.reserveTask(SECOND_SCOPE_HASH, observation()).status,
    "blocked",
  );
  assert.equal(constraints.inspect().stopReason, "cleanup_unknown");
});

test("Task・呼出しtokenの偽造、別session、複製、Provider／役割差替えを拒否する", () => {
  const constraints = createConstraints();
  const foreign = createConstraints();
  const taskToken = unwrap(
    constraints.reserveTask(FIRST_SCOPE_HASH, observation()),
  );
  const token = unwrap(
    constraints.reserveInvocation(
      taskToken,
      "codex",
      "executor",
      observation(),
    ),
  );
  assert.equal(
    foreign.reserveInvocation(taskToken, "codex", "executor", observation())
      .status,
    "blocked",
  );
  for (const wrongToken of [
    {},
    { ...token },
    JSON.parse(JSON.stringify(token)),
  ]) {
    assert.equal(
      constraints.consumeInvocation(
        wrongToken,
        taskToken,
        "codex",
        "executor",
        observation(),
      ).status,
      "blocked",
    );
    assert.equal(constraints.settleInvocation(wrongToken).status, "blocked");
  }
  assert.equal(
    constraints.consumeInvocation(token, {}, "codex", "executor", observation())
      .status,
    "blocked",
  );
  assert.equal(
    constraints.consumeInvocation(
      token,
      taskToken,
      "claude",
      "executor",
      observation(),
    ).status,
    "blocked",
  );
  assert.equal(
    constraints.consumeInvocation(
      token,
      taskToken,
      "codex",
      "reviewer",
      observation(),
    ).status,
    "blocked",
  );
  unwrap(
    constraints.consumeInvocation(
      token,
      taskToken,
      "codex",
      "executor",
      observation(),
    ),
  );
});

test("許可外Taskと経路は枠を消費せず拒否する", () => {
  const constraints = createConstraints();
  assert.equal(
    constraints.reserveTask("d".repeat(64), observation()).status,
    "blocked",
  );
  const taskToken = unwrap(
    constraints.reserveTask(FIRST_SCOPE_HASH, observation()),
  );
  assert.equal(
    constraints.reserveInvocation(
      taskToken,
      "claude",
      "executor",
      observation(),
    ).status,
    "blocked",
  );
  assert.equal(
    constraints.reserveInvocation(taskToken, "codex", "reviewer", observation())
      .status,
    "blocked",
  );
  assert.equal(constraints.inspect().invocationCount, 0);
});

test("constructorはshape、期限、Task数・重複・経路を厳格検証する", () => {
  const valid = configuration();
  for (const invalid of [
    null,
    { ...valid, extra: true },
    { ...valid, bindingSha256: "d".repeat(64) },
    { ...valid, expiresAtMs: 100 },
    { ...valid, expiresAtMs: 3_600_101 },
    { ...valid, expiresAtMs: Number.NaN },
    { ...valid, tasks: [] },
    { ...valid, tasks: [valid.tasks[0]] },
    { ...valid, tasks: [...valid.tasks, valid.tasks[0]] },
    { ...valid, tasks: [valid.tasks[0], valid.tasks[0]] },
    {
      ...valid,
      tasks: [
        { scopeSha256: FIRST_SCOPE_HASH, executor: "codex", reviewer: "codex" },
        valid.tasks[1],
      ],
    },
  ])
    assert.equal(
      createDevelopmentMeasurementConstraints(invalid, observation()),
      null,
    );
  assertPresent(
    createDevelopmentMeasurementConstraints(
      { ...valid, expiresAtMs: 3_600_100 },
      observation(),
    ),
  );
});

test("getter／Proxyを実行せず拒否し、入力の後変更を保持しない", () => {
  let trapCalls = 0;
  const accessor = Object.defineProperty(configuration(), "expiresAtMs", {
    get() {
      trapCalls += 1;
      return 1_100;
    },
  });
  const proxy = new Proxy(configuration(), {
    ownKeys() {
      trapCalls += 1;
      return [];
    },
  });
  assert.equal(
    createDevelopmentMeasurementConstraints(accessor, observation()),
    null,
  );
  assert.equal(
    createDevelopmentMeasurementConstraints(proxy, observation()),
    null,
  );
  const config = configuration();
  const constraints = createDevelopmentMeasurementConstraints(
    config,
    observation(),
  );
  assertPresent(constraints);
  config.tasks.length = 0;
  config.expiresAtMs = 10_000;
  unwrap(constraints.reserveTask(FIRST_SCOPE_HASH, observation()));
  assert.equal(
    constraints.reserveTask(SECOND_SCOPE_HASH, observation(1_100)).status,
    "blocked",
  );
  assert.equal(trapCalls, 0);
});

test("単調時計の巻戻り、非有限値、観測getterはsessionを終端化する", () => {
  for (const invalid of [
    observation(101, 99),
    observation(101, Number.POSITIVE_INFINITY),
    observation(Number.NaN),
    { ...observation(), extra: true },
    Object.defineProperty(observation(), "wallTimeMs", {
      get() {
        throw new Error("must not execute");
      },
    }),
  ]) {
    const constraints = createConstraints();
    assert.equal(
      constraints.reserveTask(FIRST_SCOPE_HASH, invalid).status,
      "blocked",
    );
    assert.equal(constraints.inspect().stopReason, "observation_invalid");
  }
});
