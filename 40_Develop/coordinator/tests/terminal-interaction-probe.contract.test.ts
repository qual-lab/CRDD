import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  type InteractiveConsoleReadOutcome,
  withInteractiveConsoleAsyncOutcomeUsingAdapter,
} from "../src/core/interactive-console.ts";
import {
  runTerminalInteractionProbeUsingAdapter,
  type TerminalInteractionProbeAdapter,
} from "./fixtures/terminal-interaction-probe.ts";

function createProbeFixture(
  options: {
    read?: InteractiveConsoleReadOutcome;
    writeFailureAt?: number;
    writeCleanupUnknown?: boolean;
    closeFailure?: boolean;
    readThrows?: boolean;
    triggerAbort?: boolean;
  } = {},
) {
  const events: string[] = [];
  const texts: string[] = [];
  const descriptors = new Set<number>();
  let abortCallback: (() => void) | null = null;
  let timerActive = false;
  const adapter: TerminalInteractionProbeAdapter = {
    withConsole: (operation) =>
      withInteractiveConsoleAsyncOutcomeUsingAdapter(
        "win32",
        {
          open: () => {
            const descriptor = descriptors.size + 10;
            descriptors.add(descriptor);
            events.push(`open:${descriptor}`);
            return descriptor;
          },
          close: (descriptor) => {
            events.push(`close:${descriptor}`);
            descriptors.delete(descriptor);
            if (options.closeFailure) throw new Error("close-failed");
          },
          validate: () => true,
        },
        operation,
      ),
    writeText: async (_descriptor, text) => {
      texts.push(text);
      events.push("write");
      return {
        status:
          texts.length === options.writeFailureAt
            ? options.writeCleanupUnknown
              ? "cleanup_unknown"
              : "write_failed"
            : "completed",
      };
    },
    readLine: async (_descriptor, signal) => {
      events.push("read");
      assert.equal(texts.length, 1, "The prompt must finish before reading");
      if (options.readThrows) throw new Error("read-failed");
      if (options.triggerAbort) {
        assert.ok(abortCallback);
        abortCallback();
        assert.equal(signal.aborted, true);
        events.push("reader-stopped");
        return options.read ?? { status: "cancelled", line: null };
      }
      return options.read ?? { status: "completed", line: "123456" };
    },
    scheduleAbort: (callback, milliseconds) => {
      assert.equal(timerActive, false);
      timerActive = true;
      abortCallback = callback;
      events.push(`timer:${milliseconds}`);
      return () => {
        timerActive = false;
        abortCallback = null;
        events.push("timer-cleared");
      };
    },
  };
  return {
    adapter,
    events,
    texts,
    assertReleased: () => {
      assert.equal(timerActive, false);
      assert.equal(descriptors.size, 0);
      assert.equal(abortCallback, null);
      assert.deepEqual(events.slice(-2), ["close:10", "close:11"]);
    },
  };
}

test("端末確認は表示後に一度だけ読み取り、値や権限を結果へ搬送しない", async () => {
  const fixture = createProbeFixture();
  const report = await runTerminalInteractionProbeUsingAdapter(
    ["match"],
    fixture.adapter,
  );
  assert.equal(report.status, "matched");
  assert.equal(report.scenarioMatched, true);
  assert.equal(report.cleanupConfirmed, true);
  assert.equal(report.authorizationIssued, false);
  assert.equal(report.providerEffectIssued, false);
  assert.equal(JSON.stringify(report).includes("123456"), false);
  assert.deepEqual(fixture.texts.slice(1), ["\n"]);
  assert.equal(fixture.events.filter((event) => event === "read").length, 1);
  assert.ok(fixture.texts[0]?.includes("Enterを1回"));
  fixture.assertReleased();
});

test("入力不一致と期待シナリオの不成立を分離する", async () => {
  for (const scenario of ["match", "mismatch"]) {
    const fixture = createProbeFixture({
      read: { status: "completed", line: "654321" },
    });
    const report = await runTerminalInteractionProbeUsingAdapter(
      [scenario],
      fixture.adapter,
    );
    assert.equal(report.status, "mismatched");
    assert.equal(report.scenarioMatched, scenario === "mismatch");
    assert.equal(JSON.stringify(report).includes("654321"), false);
    const prompt = fixture.texts[0];
    assert.ok(prompt);
    assert.ok(prompt.includes("Enterを1回"));
    if (scenario === "mismatch") {
      assert.equal(
        prompt,
        "次に進むために654321を入力してEnterを1回押してください: ",
      );
      assert.equal(prompt.includes("123456"), false);
    } else {
      assert.ok(prompt.includes("123456 を入力"));
      assert.equal(prompt.includes("654321"), false);
    }
    fixture.assertReleased();
  }
});

test("取消と時間切れはreader停止を待ちtimerと両descriptorを回収する", async () => {
  for (const scenario of ["cancel", "timeout", "match"]) {
    const fixture = createProbeFixture({ triggerAbort: true });
    const report = await runTerminalInteractionProbeUsingAdapter(
      [scenario],
      fixture.adapter,
    );
    assert.equal(
      report.status,
      scenario === "cancel" ? "cancelled" : "timeout",
    );
    assert.ok(
      fixture.events.includes(
        `timer:${scenario === "cancel" ? 1000 : scenario === "timeout" ? 5000 : 60000}`,
      ),
    );
    assert.ok(
      fixture.events.indexOf("reader-stopped") <
        fixture.events.indexOf("close:10"),
    );
    fixture.assertReleased();
  }
});

test("取消と完了の競合およびcleanup不明は入力成功へ戻さない", async () => {
  for (const read of [
    { status: "completed", line: "123456" },
    { status: "cleanup_unknown", line: null },
    { status: "reader_failed", line: null },
  ] as const) {
    const fixture = createProbeFixture({ triggerAbort: true, read });
    const report = await runTerminalInteractionProbeUsingAdapter(
      ["cancel"],
      fixture.adapter,
    );
    assert.equal(
      report.status,
      read.status === "completed" ? "cancelled" : read.status,
    );
    assert.equal(report.cleanupConfirmed, read.status !== "cleanup_unknown");
    fixture.assertReleased();
  }
});

test("表示失敗はreaderを開始せず、最終改行失敗も成功にしない", async () => {
  for (const writeFailureAt of [1, 2]) {
    for (const isWriteCleanupUnknown of [false, true]) {
      const fixture = createProbeFixture({
        writeFailureAt,
        writeCleanupUnknown: isWriteCleanupUnknown,
      });
      const report = await runTerminalInteractionProbeUsingAdapter(
        ["match"],
        fixture.adapter,
      );
      assert.equal(
        report.status,
        isWriteCleanupUnknown ? "cleanup_unknown" : "write_failed",
      );
      assert.equal(report.scenarioMatched, false);
      assert.equal(fixture.events.includes("read"), writeFailureAt === 2);
      fixture.assertReleased();
    }
  }
});

test("reader失敗・不正完了・例外・descriptor回収失敗を通常成功にしない", async () => {
  for (const options of [
    { read: { status: "reader_failed", line: null } as const },
    { read: { status: "completed", line: null } as const },
    { readThrows: true },
    { closeFailure: true },
  ]) {
    const fixture = createProbeFixture(options);
    const report = await runTerminalInteractionProbeUsingAdapter(
      ["match"],
      fixture.adapter,
    );
    assert.equal(report.scenarioMatched, false);
    assert.equal(report.authorizationIssued, false);
    assert.equal(report.providerEffectIssued, false);
    if ("closeFailure" in options || "readThrows" in options)
      assert.equal(report.cleanupConfirmed, false);
    fixture.assertReleased();
  }
});

test("取消要求だけでは完了せず、保留readerの停止結果まで資源を保持する", async () => {
  const fixture = createProbeFixture();
  let completeRead: (outcome: InteractiveConsoleReadOutcome) => void = () => {
    throw new Error("read-resolver-not-created");
  };
  const pendingRead = new Promise<InteractiveConsoleReadOutcome>((resolve) => {
    completeRead = resolve;
  });
  let announceReadStarted: () => void = () => {
    throw new Error("start-resolver-not-created");
  };
  const readStarted = new Promise<void>((resolve) => {
    announceReadStarted = resolve;
  });
  let capturedSignal: AbortSignal | null = null;
  let abortCallback: (() => void) | null = null;
  let isSettled = false;
  const pending = runTerminalInteractionProbeUsingAdapter(["cancel"], {
    ...fixture.adapter,
    readLine: async (_descriptor, signal) => {
      capturedSignal = signal;
      announceReadStarted();
      return pendingRead;
    },
    scheduleAbort: (callback, milliseconds) => {
      abortCallback = callback;
      return fixture.adapter.scheduleAbort(callback, milliseconds);
    },
  }).then((report) => {
    isSettled = true;
    return report;
  });
  await readStarted;
  assert.ok(abortCallback);
  (abortCallback as () => void)();
  assert.equal((capturedSignal as AbortSignal | null)?.aborted, true);
  await Promise.resolve();
  assert.equal(isSettled, false);
  assert.equal(
    fixture.events.some((event) => event.startsWith("close:")),
    false,
  );
  completeRead({ status: "cancelled", line: null });
  const report = await pending;
  assert.equal(report.status, "cancelled");
  fixture.assertReleased();
});

test("不正引数はconsole取得より前に拒否し、不足情報を入力要求で補わない", async () => {
  for (const argv of [[], ["unknown"], ["match", "123456"], ["MATCH"]]) {
    const fixture = createProbeFixture();
    const report = await runTerminalInteractionProbeUsingAdapter(
      argv,
      fixture.adapter,
    );
    assert.equal(report.status, "invalid_arguments");
    assert.equal(report.scenarioMatched, false);
    assert.deepEqual(fixture.events, []);
  }
});

test("端末が取得できない場合は標準入力へfallbackしない", async () => {
  const fixture = createProbeFixture();
  const report = await runTerminalInteractionProbeUsingAdapter(["match"], {
    ...fixture.adapter,
    withConsole: async () => ({ status: "unavailable", value: null }),
  });
  assert.equal(report.status, "unavailable");
  assert.deepEqual(fixture.events, []);
});

test("実子の不正引数入口は非対話でJSONを返し、追加Enterを待たない", () => {
  const entrypoint = fileURLToPath(
    new URL("./fixtures/terminal-interaction-probe.ts", import.meta.url),
  );
  const result = spawnSync(process.execPath, [entrypoint, "invalid"], {
    cwd: fileURLToPath(new URL("./fixtures/", import.meta.url)),
    env: {},
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5000,
    encoding: "utf8",
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 2);
  assert.equal(result.stderr, "");
  assert.equal(JSON.parse(result.stdout).status, "invalid_arguments");
  const source = fs.readFileSync(entrypoint, "utf8");
  assert.ok(source.includes("withConsole: withInteractiveConsoleAsyncOutcome"));
  assert.ok(source.includes("writeText: writeInteractiveConsoleTextOutcome"));
  assert.ok(source.includes("readLine: readInteractiveConsoleLineOutcome"));
  assert.deepEqual(
    [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]),
    ["node:path", "node:url", "../../src/core/interactive-console.ts"],
  );
});
