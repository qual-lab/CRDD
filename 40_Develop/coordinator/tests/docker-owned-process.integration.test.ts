import assert from "node:assert/strict";
import test from "node:test";
import {
  createDockerProcessEnvironment,
  startOwnedProcess,
  STDERR_LIMIT_BYTES,
  STDOUT_LIMIT_BYTES,
} from "../src/security/docker-owned-process.ts";
import {
  createOwnedProcessTreeFixture,
  ownedProcessWorker,
  waitForCondition,
} from "./fixtures/docker-owned-process-test-support.ts";

const windowsOnly = { skip: process.platform !== "win32", timeout: 20_000 };

test(
  "本番共通process: UTF-8標準入力と正常/非0終了を実観測",
  windowsOnly,
  async (t) => {
    for (const mode of ["echo", "nonzero"]) {
      const input = mode === "echo" ? "日本語\r\nfixed input\n" : null;
      const handle = startOwnedProcess(
        process.execPath,
        [ownedProcessWorker, mode],
        createDockerProcessEnvironment(),
        input,
      );
      t.after(async () => {
        assert.equal(await handle.terminateAndWait(5_000), true);
      });
      const result = await handle.wait(5_000);
      assert.ok(result);
      assert.equal(result.status, mode === "echo" ? 0 : 7);
      assert.equal(result.stdout, input ?? "");
      assert.equal(result.stderr, "");
      assert.equal(result.outputExceeded, false);
      assert.equal(handle.closed(), true);
    }
  },
);

test(
  "本番共通process: 待機期限は取消ではなく、重複取消後に実子孫とcloseを確認",
  windowsOnly,
  async (t) => {
    const fixture = createOwnedProcessTreeFixture();
    t.after(() => fixture.dispose());
    const handle = fixture.start();
    await fixture.ready();
    assert.equal(await handle.wait(10), null);
    assert.equal(handle.closed(), false);
    assert.deepEqual(
      await Promise.all([
        handle.terminateAndWait(5_000),
        handle.terminateAndWait(5_000),
      ]),
      [true, true],
    );
    fixture.assertAbsent();
    assert.equal(await handle.terminateAndWait(5_000), true);
  },
);

for (const mode of ["stdout-limit", "stderr-limit"]) {
  test(
    `本番共通process: ${mode}は実processを終了し出力保持を制限`,
    windowsOnly,
    async (t) => {
      const handle = startOwnedProcess(
        process.execPath,
        [ownedProcessWorker, mode],
        createDockerProcessEnvironment(),
        null,
      );
      t.after(async () => {
        assert.equal(await handle.terminateAndWait(5_000), true);
      });
      const result = await handle.wait(10_000);
      assert.ok(result);
      assert.equal(result.outputExceeded, true);
      assert.ok(Buffer.byteLength(result.stdout) <= STDOUT_LIMIT_BYTES);
      assert.ok(Buffer.byteLength(result.stderr) <= STDERR_LIMIT_BYTES);
      assert.equal(handle.closed(), true);
    },
  );
}

test(
  "本番共通process: 起動失敗はerror結果とcloseを区別して観測",
  windowsOnly,
  async (t) => {
    const handle = startOwnedProcess(
      `${ownedProcessWorker}.missing.exe`,
      [],
      createDockerProcessEnvironment(),
      null,
    );
    t.after(async () => {
      assert.equal(await handle.terminateAndWait(5_000), true);
    });
    const result = await handle.wait(5_000);
    assert.ok(result);
    assert.equal(result.status, null);
    await waitForCondition(handle.closed);
    assert.equal(handle.closed(), true);
  },
);
