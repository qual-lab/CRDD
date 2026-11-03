/**
 * 共有端末の完了・取消・例外を有限Adapterで確認する。
 * @responsibility 製品に専用送信同意を残さずPA端末の通知順を検証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 端末I/Oは有限代役。外部AI・Docker・実端末なし。
 * @boundary メモリ内の完了結果。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmInteractiveConsoleChallengeOutcomeUsingAdapter,
  confirmInteractiveConsoleChallengeUsingAdapter,
} from "../../support/console.ts";
/** 共有端末Adapterの正常・取消・故障を有限値で反証する。 */
function resolveDeferredBoolean(resolver: unknown, isResolved: boolean) {
  assert.equal(typeof resolver, "function");
  (resolver as (isSuccessful: boolean) => void)(isResolved);
}

/** 共有端末Adapterの正常・取消・故障を有限値で反証する。 */
function resolveDeferredLine(resolver: unknown, line: string | null) {
  assert.equal(typeof resolver, "function");
  (resolver as (resolvedLine: string | null) => void)(line);
}

/** 共有端末Adapterの正常・取消・故障を有限値で反証する。 */
test("承認失敗は公開値を含まないbounded outcomeへ分類する", async () => {
  for (const status of [
    "cancelled",
    "timeout",
    "reader_failed",
    "cleanup_unknown",
  ] as const) {
    const outcome = await confirmInteractiveConsoleChallengeOutcomeUsingAdapter(
      "safe notice",
      "123456",
      { input: 1, output: 2 },
      new AbortController().signal,
      Object.freeze({
        writeText: async () => true,
        readLine: async () => Object.freeze({ status, line: null }),
      }),
    );
    assert.deepEqual(outcome, { status });
  }
  const declined = await confirmInteractiveConsoleChallengeOutcomeUsingAdapter(
    "safe notice",
    "123456",
    { input: 1, output: 2 },
    new AbortController().signal,
    Object.freeze({
      writeText: async () => true,
      readLine: async () =>
        Object.freeze({ status: "completed" as const, line: "654321" }),
    }),
  );
  assert.deepEqual(declined, { status: "declined_invalid" });

  let writeCount = 0;
  const readFailed =
    await confirmInteractiveConsoleChallengeOutcomeUsingAdapter(
      "safe notice",
      "123456",
      { input: 1, output: 2 },
      new AbortController().signal,
      Object.freeze({
        writeText: async () => {
          writeCount += 1;
          return true;
        },
        readLine: async () => {
          throw new Error("fixture_read_failed");
        },
      }),
    );
  assert.deepEqual(readFailed, { status: "reader_failed" });
  assert.equal(writeCount, 2);

  for (const [line, expected] of [
    ["123456", "unavailable"],
    ["654321", "declined_invalid"],
  ] as const) {
    let writes = 0;
    const newlineFailed =
      await confirmInteractiveConsoleChallengeOutcomeUsingAdapter(
        "safe notice",
        "123456",
        { input: 1, output: 2 },
        new AbortController().signal,
        Object.freeze({
          writeText: async () => {
            writes += 1;
            return writes === 1;
          },
          readLine: async () =>
            Object.freeze({ status: "completed" as const, line }),
        }),
      );
    assert.deepEqual(newlineFailed, { status: expected });
  }
});

/** 共有端末Adapterの正常・取消・故障を有限値で反証する。 */
test("承認表示完了後だけchallengeを読み最終表示完了後だけ成功する", async () => {
  const challenge = "123456";
  const controller = new AbortController();
  let readCount = 0;
  const writtenValues: string[] = [];
  let completePrompt: ((isSuccessful: boolean) => void) | null = null;
  let completeNewline: ((isSuccessful: boolean) => void) | null = null;
  const confirmation = confirmInteractiveConsoleChallengeUsingAdapter(
    "確認対象",
    challenge,
    Object.freeze({ input: 11, output: 12 }),
    controller.signal,
    Object.freeze({
      writeText: (_descriptor: number, value: string) => {
        writtenValues.push(value);
        return new Promise<boolean>((resolve) => {
          if (writtenValues.length === 1) completePrompt = resolve;
          else completeNewline = resolve;
        });
      },
      readLine: async () => {
        readCount += 1;
        return challenge;
      },
    }),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(readCount, 0);
  resolveDeferredBoolean(completePrompt, true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(readCount, 1);
  assert.equal(typeof completeNewline, "function");
  let isConfirmationCompleted = false;
  void confirmation.then(() => {
    isConfirmationCompleted = true;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(isConfirmationCompleted, false);
  resolveDeferredBoolean(completeNewline, true);
  assert.equal(await confirmation, true);
});

/** 共有端末Adapterの正常・取消・故障を有限値で反証する。 */
test("承認表示・入力・最終表示の各失敗をGrant候補へ進めない", async () => {
  const handles = Object.freeze({ input: 11, output: 12 });
  const cancellationSignal = new AbortController().signal;
  let readCount = 0;
  assert.equal(
    await confirmInteractiveConsoleChallengeUsingAdapter(
      "確認対象",
      "123456",
      handles,
      cancellationSignal,
      Object.freeze({
        writeText: async () => false,
        readLine: async () => {
          readCount += 1;
          return "123456";
        },
      }),
    ),
    false,
  );
  assert.equal(readCount, 0);

  for (const scenario of ["cancelled", "newline", "incorrect"] as const) {
    const line =
      scenario === "cancelled"
        ? null
        : scenario === "incorrect"
          ? "654321"
          : "123456";
    let writeCount = 0;
    const isConfirmed = await confirmInteractiveConsoleChallengeUsingAdapter(
      "確認対象",
      "123456",
      handles,
      cancellationSignal,
      Object.freeze({
        writeText: async () => {
          writeCount += 1;
          return scenario !== "newline" || writeCount === 1;
        },
        readLine: async () => line,
      }),
    );
    assert.equal(isConfirmed, false, scenario);
    assert.equal(writeCount, scenario === "cancelled" ? 1 : 2, scenario);
  }
});

/** 共有端末Adapterの正常・取消・故障を有限値で反証する。 */
test("取消状態を承認表示開始から最終表示完了まで保持する", async () => {
  const handles = Object.freeze({ input: 11, output: 12 });

  {
    const controller = new AbortController();
    controller.abort();
    let writeCount = 0;
    assert.equal(
      await confirmInteractiveConsoleChallengeUsingAdapter(
        "確認対象",
        "123456",
        handles,
        controller.signal,
        Object.freeze({
          writeText: async () => {
            writeCount += 1;
            return true;
          },
          readLine: async () => "123456",
        }),
      ),
      false,
    );
    assert.equal(writeCount, 0);
  }

  {
    const controller = new AbortController();
    let completePrompt: ((isSuccessful: boolean) => void) | null = null;
    let readCount = 0;
    const confirmation = confirmInteractiveConsoleChallengeUsingAdapter(
      "確認対象",
      "123456",
      handles,
      controller.signal,
      Object.freeze({
        writeText: () =>
          new Promise<boolean>((resolve) => {
            completePrompt = resolve;
          }),
        readLine: async () => {
          readCount += 1;
          return "123456";
        },
      }),
    );
    controller.abort();
    resolveDeferredBoolean(completePrompt, true);
    assert.equal(await confirmation, false);
    assert.equal(readCount, 0);
  }

  {
    const controller = new AbortController();
    let completeRead: ((line: string | null) => void) | null = null;
    let writeCount = 0;
    const confirmation = confirmInteractiveConsoleChallengeUsingAdapter(
      "確認対象",
      "123456",
      handles,
      controller.signal,
      Object.freeze({
        writeText: async () => {
          writeCount += 1;
          return true;
        },
        readLine: () =>
          new Promise<string | null>((resolve) => {
            completeRead = resolve;
          }),
      }),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    controller.abort();
    resolveDeferredLine(completeRead, "123456");
    assert.equal(await confirmation, false);
    assert.equal(writeCount, 1);
  }

  {
    const controller = new AbortController();
    let completeNewline: ((isSuccessful: boolean) => void) | null = null;
    let writeCount = 0;
    const confirmation = confirmInteractiveConsoleChallengeUsingAdapter(
      "確認対象",
      "123456",
      handles,
      controller.signal,
      Object.freeze({
        writeText: () => {
          writeCount += 1;
          return writeCount === 1
            ? Promise.resolve(true)
            : new Promise<boolean>((resolve) => {
                completeNewline = resolve;
              });
        },
        readLine: async () => "123456",
      }),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    controller.abort();
    resolveDeferredBoolean(completeNewline, true);
    assert.equal(await confirmation, false);
    assert.equal(writeCount, 2);
  }
});
