/**
 * 固定端末署名入口の受付と終了後の端末回収を検証する。
 *
 * @packageDocumentation
 * @responsibility 秘密なしCommandと局所streamで引数、時刻、TTY、結果保持およびreader回収を確認する。
 * @trace AIT-IT-015
 * @level IT
 * @scope 固定端末署名入口
 * @boundary AIT-IT-015=Direct Boundary: 端末署名入口→既存署名Command接続／画面保持reader
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";
import { runReleaseTerminalCommand } from "../../scripts/sign-release-terminal.ts";

const requiredArgs = [
  "--distribution-root",
  "C:/project/CRDD/.crdd/release/test-candidate",
  "--crdd-version",
  "v0.22.0",
  "--release-sequence",
  "2026100601",
  "--crdd-commit",
  "a".repeat(40),
  "--crdd-tree",
  "b".repeat(40),
];

/**
 * 端末署名入口へ秘密を扱わないstreamとCommandを接続する。
 *
 * @responsibility 終了通知、出力、Command引数とstream回収を観測するfixtureを所有する。
 * @trace AIT-IT-015
 * @precondition 終了操作と秘密を扱わないCommandを呼出し側から受け取る。
 * @stimulus 固定入口へ接続する局所streamと現在UTCを用意する。
 * @observation 出力、Command引数、現在時刻観測件数とListenerを取得する。
 * @oracle 呼出し側が受付、直列接続、結果保持と回収を判定できる。
 * @cleanup disposeで全streamをdestroyする。
 * @boundary AIT-IT-015=Direct Boundary: 局所fixture→固定端末署名入口
 */
function createTerminalFixture(
  ending: "enter" | "eof" | "cancel" = "enter",
  command: (args: string[]) => Promise<void> = async () => {},
) {
  const input = new PassThrough();
  const output = new PassThrough();
  const errorOutput = new PassThrough();
  const observations = {
    output: "",
    errorOutput: "",
    commandArgs: [] as string[][],
    timeReads: 0,
  };
  output.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    observations.output += text;
    if (text.includes("結果を確認したら")) {
      setImmediate(() => {
        if (ending === "eof") input.end();
        else input.write(ending === "cancel" ? "\u0003" : "\r");
      });
    }
  });
  errorOutput.on("data", (chunk: Buffer) => {
    observations.errorOutput += chunk.toString();
  });
  return {
    input,
    output,
    errorOutput,
    observations,
    bindings: {
      input,
      output,
      errorOutput,
      stdinIsTTY: true,
      stdoutIsTTY: true,
      nodeVersion: "24.12.0",
      now: () => {
        observations.timeReads += 1;
        return new Date("2026-10-06T23:59:59.999Z");
      },
      runCommand: async (args: string[]) => {
        observations.commandArgs.push(args);
        await command(args);
      },
    },
    dispose: () => {
      input.destroy();
      output.destroy();
      errorOutput.destroy();
    },
  };
}

/**
 * 有効期間と非秘密参照を既存Command引数へ一意に変換する。
 *
 * @responsibility 単一現在UTC、期限算出、既存引数の完全一致と終了後回収を確認する。
 * @trace AIT-IT-015
 * @precondition 固定公開引数と秘密なしCommandを使用する。
 * @stimulus 七日間の明示指定と非秘密の鍵Pathを渡す。
 * @observation Command引数、時刻観測件数、終了codeと入力Listenerを取得する。
 * @oracle 現在UTC観測は一回、翌七日同時刻の期限、Command一回、code0とListener残存0。
 * @cleanup 全streamをdestroyする。
 * @boundary AIT-IT-015=Direct Boundary: 固定署名入口→Command／端末
 */
test("固定署名入口は単一現在UTCから期限を算出し非秘密引数だけを渡す", async (t) => {
  const fixture = createTerminalFixture();
  t.after(fixture.dispose);
  const code = await runReleaseTerminalCommand(
    [
      ...requiredArgs,
      "--private-key",
      "C:/keys/release.pem",
      "--valid-for-days",
      "7",
    ],
    fixture.bindings,
  );
  assert.equal(code, 0);
  assert.equal(fixture.observations.timeReads, 1);
  assert.deepEqual(fixture.observations.commandArgs, [
    [
      ...requiredArgs,
      "--private-key",
      "C:/keys/release.pem",
      "--issued-at",
      "2026-10-06T23:59:59.999Z",
      "--expires-at",
      "2026-10-13T23:59:59.999Z",
    ],
  ]);
  assert.match(fixture.observations.output, /SIGN_EXIT=0/u);
  assert.equal(fixture.input.listenerCount("data"), 0);
  assert.equal(fixture.input.listenerCount("end"), 0);
  assert.equal(fixture.input.listenerCount("keypress"), 0);
});

/**
 * 署名Commandが保留中は画面保持readerを接続しない。
 *
 * @responsibility 秘密入力とEnter用入力の同時所有を拒否する直列接続を確認する。
 * @trace AIT-IT-015
 * @precondition 明示期限なしと完了を制御できる秘密なしCommandを使用する。
 * @stimulus Commandを保留して入力Listenerと表示を確認した後に完了させる。
 * @observation 保留中のListener、表示、完了後の引数とcodeを取得する。
 * @oracle 保留中reader0、完了後だけEnter案内、期限なしをそのまま渡す。
 * @cleanup Commandを完了し全streamをdestroyする。
 * @boundary AIT-IT-015=Direct Boundary: 署名Command完了→画面保持reader
 */
test("署名Command完了前にEnter readerを開始しない", async (t) => {
  let completeCommand = () => {};
  const commandCompletion = new Promise<void>((resolve) => {
    completeCommand = resolve;
  });
  const fixture = createTerminalFixture("enter", async () => commandCompletion);
  t.after(() => {
    completeCommand();
    fixture.dispose();
  });
  const pending = runReleaseTerminalCommand(
    [...requiredArgs, "--no-expiry"],
    fixture.bindings,
  );
  assert.equal(fixture.observations.commandArgs.length, 1);
  assert.equal(fixture.input.listenerCount("data"), 0);
  assert.equal(fixture.observations.output, "");
  completeCommand();
  assert.equal(await pending, 0);
  assert.deepEqual(fixture.observations.commandArgs[0], [
    ...requiredArgs,
    "--issued-at",
    "2026-10-06T23:59:59.999Z",
    "--no-expiry",
  ]);
});

for (const ending of ["enter", "eof", "cancel"] as const) {
  for (const shouldFailCommand of [false, true]) {
    /**
     * 画面保持の全終端で元の署名結果とreader回収を維持する。
     *
     * @responsibility Enter、EOF、Ctrl+Cと署名成功／失敗の組合せを確認する。
     * @trace AIT-IT-015
     * @precondition 秘密なしの成功または失敗Commandと各終了操作を使用する。
     * @stimulus Command終了後の画面保持へ終了操作を送る。
     * @observation 終了code、失敗診断、Command件数と入力Listenerを取得する。
     * @oracle 元codeを維持し再試行0、入力ListenerとSIGINT所有Listener残存0。
     * @cleanup 全streamをdestroyする。
     * @boundary AIT-IT-015=Direct Boundary: Command結果→画面保持終端
     */
    test(`画面保持${ending}は署名${shouldFailCommand ? "失敗" : "成功"}の結果を変えない`, async (t) => {
      const initialSignalListenerCount = process.listenerCount("SIGINT");
      const fixture = createTerminalFixture(ending, async () => {
        if (shouldFailCommand) throw new Error("release_manifest_test_failure");
      });
      t.after(fixture.dispose);
      assert.equal(
        await runReleaseTerminalCommand(
          [...requiredArgs, "--no-expiry"],
          fixture.bindings,
        ),
        shouldFailCommand ? 1 : 0,
      );
      assert.equal(fixture.observations.commandArgs.length, 1);
      assert.equal(fixture.input.listenerCount("data"), 0);
      assert.equal(fixture.input.listenerCount("end"), 0);
      assert.equal(fixture.input.listenerCount("keypress"), 0);
      assert.equal(process.listenerCount("SIGINT"), initialSignalListenerCount);
      if (shouldFailCommand)
        assert.match(
          fixture.observations.errorOutput,
          /release_manifest_test_failure/u,
        );
    });
  }
}

/**
 * 閉じた公開引数の不正文法をCommand前に拒否する。
 *
 * @responsibility 排他、未知、重複、数値とUTC期限境界の負例を確認する。
 * @trace AIT-IT-015
 * @precondition 有限の不正引数集合と秘密なしCommandを使用する。
 * @stimulus 各不正引数を固定入口へ渡す。
 * @observation code、Command件数と入力Listenerを取得する。
 * @oracle 全例code1、Command0、reader回収後のListener0。
 * @cleanup 各例のstreamをdestroyする。
 * @boundary AIT-IT-015=Direct Boundary: 公開引数→Command前拒否
 */
test("閉じた引数と期限の境界違反は署名Commandを呼ばない", async () => {
  const invalidArgs = [
    requiredArgs,
    [...requiredArgs, "--no-expiry", "--valid-for-days", "7"],
    [...requiredArgs, "--no-expiry", "--no-expiry"],
    [...requiredArgs, "--issued-at", "2020-01-01T00:00:00.000Z", "--no-expiry"],
    [...requiredArgs, "--passphrase", "sentinel-not-a-secret", "--no-expiry"],
    [...requiredArgs, "--crdd-tree", "c".repeat(40), "--no-expiry"],
    [...requiredArgs, "--private-key", "relative.pem", "--no-expiry"],
    [...requiredArgs.slice(0, -1), "b".repeat(64), "--no-expiry"],
    [...requiredArgs, "--private-key", "C:/keys/a\0.pem", "--no-expiry"],
    ...["0", "-1", "1.5", "01", "1e2", "9007199254740992", "999999999"].map(
      (days) => [...requiredArgs, "--valid-for-days", days],
    ),
  ];
  for (const args of invalidArgs) {
    const fixture = createTerminalFixture("eof");
    try {
      assert.equal(await runReleaseTerminalCommand(args, fixture.bindings), 1);
      assert.equal(fixture.observations.commandArgs.length, 0);
      assert.doesNotMatch(
        fixture.observations.errorOutput,
        /sentinel-not-a-secret/u,
      );
      assert.equal(fixture.input.listenerCount("data"), 0);
    } finally {
      fixture.dispose();
    }
  }
});

/**
 * 非対話端末と未対応Nodeを入力readerと署名Commandの前に拒否する。
 *
 * @responsibility 入出力TTYとRuntimeの各拒否境界を確認する。
 * @trace AIT-IT-015
 * @precondition 非TTYまたは未対応Node観測を用意する。
 * @stimulus 固定入口へ各観測を渡す。
 * @observation code、時刻観測、Command件数と端末Listenerを取得する。
 * @oracle 全例code1、時刻／Command／reader0。
 * @cleanup 全streamをdestroyする。
 * @boundary AIT-IT-015=Direct Boundary: Runtime／TTY観測→署名前拒否
 */
test("非TTYと未対応Runtimeは画面保持も署名も開始しない", async () => {
  for (const observation of [
    { stdinIsTTY: false },
    { stdoutIsTTY: false },
    { nodeVersion: "24.11.0" },
  ]) {
    const fixture = createTerminalFixture();
    try {
      assert.equal(
        await runReleaseTerminalCommand([...requiredArgs, "--no-expiry"], {
          ...fixture.bindings,
          ...observation,
        }),
        1,
      );
      assert.equal(fixture.observations.timeReads, 0);
      assert.equal(fixture.observations.commandArgs.length, 0);
      assert.equal(fixture.observations.output, "");
      assert.equal(fixture.input.listenerCount("data"), 0);
    } finally {
      fixture.dispose();
    }
  }
});

/**
 * 画面出力失敗が完了した署名結果を上書きしない。
 *
 * @responsibility 端末保持の失敗を署名失敗と混同しないことを確認する。
 * @trace AIT-IT-015
 * @precondition 成功Commandと表示時に失敗する局所端末を使用する。
 * @stimulus 終了表示のwriteを失敗させる。
 * @observation code、Command件数と入力Listenerを取得する。
 * @oracle code0を維持しCommand一回、reader0。
 * @cleanup 全streamをdestroyする。
 * @boundary AIT-IT-015=Direct Boundary: 署名完了→画面保持失敗
 */
test("画面保持の出力失敗は署名成功を上書きしない", async (t) => {
  const fixture = createTerminalFixture();
  t.after(fixture.dispose);
  fixture.output.write = (() => {
    throw new Error("terminal_test_output_failed");
  }) as typeof fixture.output.write;
  assert.equal(
    await runReleaseTerminalCommand(
      [...requiredArgs, "--no-expiry"],
      fixture.bindings,
    ),
    0,
  );
  assert.equal(fixture.observations.commandArgs.length, 1);
  assert.equal(fixture.input.listenerCount("data"), 0);
});

/**
 * 固定CLIは別の起動Directoryでも非TTYを安全に拒否する。
 *
 * @responsibility module基準の入口と子Process／保存処理を持たないSource境界を確認する。
 * @trace AIT-IT-015
 * @precondition 検証済みNodeと固定Scriptの絶対Pathを使用する。
 * @stimulus 異なるRepository内Directoryからpipe付きCLIを実行しSourceを照合する。
 * @observation code、診断とSourceの禁止操作を取得する。
 * @oracle code1、非TTY拒否、passphrase案内0、子Process／file書込み0。
 * @cleanup spawnSync完了後に子Processは残らず、Filesystemを変更しない。
 * @boundary AIT-IT-015=Direct Boundary: 実Node CLI→TTY拒否
 */
test("固定CLIは起動Directoryによらず非TTYを拒否し追加資源を作らない", () => {
  const script = path.resolve(
    import.meta.dirname,
    "../../scripts/sign-release-terminal.ts",
  );
  const result = spawnSync(
    process.execPath,
    [script, ...requiredArgs, "--no-expiry"],
    {
      cwd: path.resolve(import.meta.dirname, "../../../artifact-signing"),
      encoding: "utf8",
      shell: false,
    },
  );
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /release_terminal_interactive_terminal_required/u,
  );
  assert.doesNotMatch(result.stdout, /passphrase|SIGN_EXIT/u);
  const source = fs.readFileSync(script, "utf8");
  assert.doesNotMatch(
    source,
    /node:child_process|writeFile|appendFile|mkdir|\.env/u,
  );
});

/**
 * 画面保持は既存Listenerと端末のraw modeを変更しない。
 *
 * @responsibility 自分のListenerだけを回収する終了後入力所有を確認する。
 * @trace AIT-IT-015
 * @precondition 各streamに既存Listenerとraw mode観測を用意する。
 * @stimulus 署名成功後にEnterで終了する。
 * @observation 各streamのListener Identityとraw mode呼出し件数を取得する。
 * @oracle 既存Listenerを全て保全し、新Listener0、raw mode呼出し0。
 * @cleanup 全streamと試験所有Listenerを回収する。
 * @boundary AIT-IT-015=Direct Boundary: 終了後reader→既存端末資源
 */
test("画面保持は既存Listenerを保全しraw modeを変えない", async (t) => {
  const fixture = createTerminalFixture();
  t.after(fixture.dispose);
  let rawModeCalls = 0;
  Object.defineProperty(fixture.input, "setRawMode", {
    value: () => {
      rawModeCalls += 1;
    },
  });
  /**
   * 既存data ListenerのIdentityを試験用に保持する。
   *
   * @responsibility 画面保持処理が既存Listenerを除去しないことを確認する。
   * @trace AIT-IT-015
   * @precondition fixtureのstreamのdataへこの固定関数を登録する。
   * @stimulus 署名終了後の画面保持処理を実行しEnterを入力する。
   * @observation 終了後のlisteners("data")から関数Identityを取得する。
   * @oracle 同じ登録済み関数が残り、新しいListenerは残らない。
   * @cleanup t.afterのfixture.disposeで試験所有streamを回収する。
   * @boundary 画面保持処理と既存streamのdata Listener集合。
   */
  const existingDataListener = () => {};
  /**
   * 既存end ListenerのIdentityを試験用に保持する。
   *
   * @responsibility 画面保持処理が既存Listenerを除去しないことを確認する。
   * @trace AIT-IT-015
   * @precondition fixtureのstreamのendへこの固定関数を登録する。
   * @stimulus 署名終了後の画面保持処理を実行しEnterを入力する。
   * @observation 終了後のlisteners("end")から関数Identityを取得する。
   * @oracle 同じ登録済み関数が残り、新しいListenerは残らない。
   * @cleanup t.afterのfixture.disposeで試験所有streamを回収する。
   * @boundary 画面保持処理と既存streamのend Listener集合。
   */
  const existingEndListener = () => {};
  /**
   * 既存error ListenerのIdentityを試験用に保持する。
   *
   * @responsibility 画面保持処理が既存Listenerを除去しないことを確認する。
   * @trace AIT-IT-015
   * @precondition fixtureのstreamのerrorへこの固定関数を登録する。
   * @stimulus 署名終了後の画面保持処理を実行しEnterを入力する。
   * @observation 終了後のlisteners("error")から関数Identityを取得する。
   * @oracle 同じ登録済み関数が残り、新しいListenerは残らない。
   * @cleanup t.afterのfixture.disposeで試験所有streamを回収する。
   * @boundary 画面保持処理と既存streamのerror Listener集合。
   */
  const existingErrorListener = () => {};
  fixture.input.on("data", existingDataListener);
  fixture.input.on("end", existingEndListener);
  fixture.input.on("error", existingErrorListener);
  fixture.output.on("error", existingErrorListener);
  fixture.errorOutput.on("error", existingErrorListener);
  assert.equal(
    await runReleaseTerminalCommand(
      [...requiredArgs, "--no-expiry"],
      fixture.bindings,
    ),
    0,
  );
  assert.deepEqual(fixture.input.listeners("data"), [existingDataListener]);
  assert.deepEqual(fixture.input.listeners("end"), [existingEndListener]);
  assert.deepEqual(fixture.input.listeners("error"), [existingErrorListener]);
  assert.deepEqual(fixture.output.listeners("error"), [existingErrorListener]);
  assert.deepEqual(fixture.errorOutput.listeners("error"), [
    existingErrorListener,
  ]);
  assert.equal(rawModeCalls, 0);
});

for (const stage of [
  "command_output",
  "command_error_output",
  "exit_display",
  "prompt",
  "waiting_error_output",
  "early_diagnostic",
] as const) {
  /**
   * 非同期の出力errorでも画面待機を有限に終え元codeを保持する。
   *
   * @responsibility Command期間、終了表示、prompt、待機と非TTY診断のasync errorを確認する。
   * @trace AIT-IT-015
   * @precondition callbackとerror通知を実Writableが非同期発行する各失敗段階を用意する。
   * @stimulus 該当段階のwrite callbackを失敗させ、待機中errorも発行する。
   * @observation code、Command件数、error通知件数とListener回収を取得する。
   * @oracle Command完了時0、非TTY時1、各errorを観測して有限完了、追加Listener0。
   * @cleanup 全試験streamをdestroyする。
   * @boundary AIT-IT-015=Direct Boundary: 非同期stream error→固定署名入口終端
   */
  test(`非同期出力error ${stage} でも結果と回収を維持する`, {
    timeout: 3000,
  }, async (t) => {
    const fixture = createTerminalFixture();
    t.after(fixture.dispose);
    let errorNotifications = 0;
    const failingOutput = new Writable({
      write: (chunk: Buffer, _encoding, callback) => {
        const text = chunk.toString();
        const shouldFailWrite =
          (stage === "command_output" && text === "command-result") ||
          (stage === "command_error_output" && text === "command-diagnostic") ||
          (stage === "exit_display" && text.startsWith("SIGN_EXIT=")) ||
          (stage === "prompt" && text.includes("結果を確認したら")) ||
          stage === "early_diagnostic";
        setImmediate(() =>
          callback(
            shouldFailWrite
              ? new Error("terminal_test_async_output_failed")
              : undefined,
          ),
        );
      },
    });
    t.after(() => failingOutput.destroy());
    /**
     * 非同期出力エラーの既存通知回数を観測する。
     *
     * @responsibility 既存Listenerを保全し、出力エラーを通知できることを確認する。
     * @trace AIT-IT-015
     * @precondition errorNotificationsを0にしfailingOutputへ登録する。
     * @stimulus 各出力段階に非同期errorを発生させ画面保持の終了を待つ。
     * @observation errorNotifications、処理結果と既存Listener残存を取得する。
     * @oracle error通知は一回、既存Listenerを保持し、画面出力の失敗でCommandの元終了Codeを上書きしない。
     * @cleanup t.afterでfailingOutput.destroyとfixture.disposeを実行する。
     * @boundary 出力streamのerror通知と画面保持の終了処理。
     */
    const existingErrorListener = () => {
      errorNotifications += 1;
    };
    failingOutput.on("error", existingErrorListener);
    const bindings = {
      ...fixture.bindings,
      output:
        stage === "command_error_output" || stage === "early_diagnostic"
          ? fixture.output
          : failingOutput,
      errorOutput:
        stage === "command_error_output" || stage === "early_diagnostic"
          ? failingOutput
          : fixture.errorOutput,
      stdinIsTTY: stage !== "early_diagnostic",
      runCommand: async (args: string[]) => {
        fixture.observations.commandArgs.push(args);
        if (stage === "command_output") failingOutput.write("command-result");
        if (stage === "command_error_output")
          failingOutput.write("command-diagnostic");
      },
    };
    if (stage === "waiting_error_output") {
      failingOutput._write = (chunk: Buffer, _encoding, callback) => {
        callback();
        if (chunk.toString().includes("結果を確認したら"))
          setImmediate(() =>
            bindings.errorOutput.emit(
              "error",
              new Error("terminal_test_waiting_output_failed"),
            ),
          );
      };
      bindings.errorOutput.on("error", existingErrorListener);
    }
    const initialSignalListenerCount = process.listenerCount("SIGINT");
    assert.equal(
      await runReleaseTerminalCommand(
        [...requiredArgs, "--no-expiry"],
        bindings,
      ),
      stage === "early_diagnostic" ? 1 : 0,
    );
    assert.equal(
      fixture.observations.commandArgs.length,
      stage === "early_diagnostic" ? 0 : 1,
    );
    assert.equal(errorNotifications, 1);
    assert.equal(fixture.input.listenerCount("data"), 0);
    assert.equal(fixture.input.listenerCount("end"), 0);
    assert.equal(fixture.input.listenerCount("error"), 0);
    assert.deepEqual(failingOutput.listeners("error"), [existingErrorListener]);
    assert.equal(process.listenerCount("SIGINT"), initialSignalListenerCount);
    if (stage === "waiting_error_output")
      assert.deepEqual(bindings.errorOutput.listeners("error"), [
        existingErrorListener,
      ]);
  });
}
