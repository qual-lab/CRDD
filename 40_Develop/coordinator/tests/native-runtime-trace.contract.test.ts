import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createWindowsHostOperationSupervisorEnvironment } from "../src/core/windows-child-environment.ts";
import { inspectNativeRuntimeTrace } from "../src/security/native-runtime-trace.ts";

const OPTIONS = Object.freeze({
  targetProcessName: "crdd-platform-access.exe",
  networkControlProcessName: "curl.exe",
  expectedTargetImage: "C:\\release\\crdd-platform-access.exe",
  windowsSystem32Directory: "C:\\Windows\\System32",
});

function trace(lines: readonly string[]) {
  return [
    'P-Start, 10, crdd-platform-access.exe (101), 1, 1, 0, 0, 0, SID, "C:\\release\\crdd-platform-access.exe"',
    'I-Start, 11, crdd-platform-access.exe (101), 0, 0, 0, 0, 0, "C:\\release\\crdd-platform-access.exe", , "\\Device\\target"',
    'I-Start, 12, crdd-platform-access.exe (101), 0, 0, 0, 0, 0, "C:\\Windows\\System32\\ntdll.dll", , "\\Device\\ntdll"',
    "P-End, 20, crdd-platform-access.exe (101), 1, 1, 0, 0",
    "P-Start, 21, curl.exe (202), 1, 1, 0, 0",
    "Microsoft-Windows-TCPIP/TcpRequestConnect/win:Info, 22, curl.exe (202), 1, 1, 127.0.0.1:50000, 127.0.0.1:9",
    "P-End, 23, curl.exe (202), 1, 1, 0, 0",
    ...lines,
  ].join("\n");
}

function traceStatistics(lostEvents = 0, lostBuffers = 0) {
  return `Total # Lost Buffers : ${lostBuffers}\nTotal # Lost Events  : ${lostEvents}\n`;
}

test("lost event 0、System32 module集合、target通信0とpositive controlを受理する", () => {
  assert.deepEqual(
    inspectNativeRuntimeTrace(trace([]), traceStatistics(), OPTIONS),
    {
      status: "accepted",
      trace: { lostEvents: 0, lostBuffers: 0 },
      target: {
        processName: "crdd-platform-access.exe",
        processId: 101,
        completed: true,
        modules: [
          "C:\\release\\crdd-platform-access.exe",
          "C:\\Windows\\System32\\ntdll.dll",
        ],
        moduleCount: 2,
        networkEventCount: 0,
      },
      networkControl: {
        processName: "curl.exe",
        processId: 202,
        networkEventCount: 1,
      },
    },
  );
});

test("対象Network event、外部Moduleおよびlost eventを個別に拒否する", () => {
  const targetNetwork = trace([
    "Microsoft-Windows-TCPIP/TcpRequestConnect/win:Info, 13, crdd-platform-access.exe (101), 1, 1",
  ]);
  assert.deepEqual(
    inspectNativeRuntimeTrace(targetNetwork, traceStatistics(), OPTIONS),
    {
      status: "blocked",
      reason: "target_network_effect_observed",
    },
  );

  const externalModule = trace([
    'I-Start, 13, crdd-platform-access.exe (101), 0, 0, 0, 0, 0, "C:\\other\\injected.dll", , "\\Device\\injected"',
  ]);
  assert.deepEqual(
    inspectNativeRuntimeTrace(externalModule, traceStatistics(), OPTIONS),
    {
      status: "blocked",
      reason: "target_module_origin_invalid",
    },
  );

  assert.deepEqual(
    inspectNativeRuntimeTrace(trace([]), traceStatistics(1), OPTIONS),
    { status: "blocked", reason: "trace_events_lost" },
  );
});

test("対象・control・summaryの欠落または重複を情報不足として拒否する", () => {
  const cases = [
    [
      trace([]).replace(
        "P-Start, 10, crdd-platform-access.exe (101)",
        "T-Start, 10, crdd-platform-access.exe (101)",
      ),
      "target_process_population_invalid",
    ],
    [
      trace([]).replace("P-End, 20", "T-End, 20"),
      "target_process_completion_invalid",
    ],
    [
      trace([])
        .split("\n")
        .filter((line) => !line.startsWith("I-Start"))
        .join("\n"),
      "target_module_population_invalid",
    ],
    [
      trace([]).replace(
        '"C:\\release\\crdd-platform-access.exe", , "\\Device\\target"',
        '"C:\\Windows\\System32\\other.exe", , "\\Device\\target"',
      ),
      "target_image_invalid",
    ],
    [
      trace([]).replace(
        "P-Start, 21, curl.exe (202)",
        "T-Start, 21, curl.exe (202)",
      ),
      "network_control_population_invalid",
    ],
    [
      trace([]).replace(
        "P-End, 23, curl.exe (202)",
        "T-End, 23, curl.exe (202)",
      ),
      "network_control_population_invalid",
    ],
    [
      trace([]).replace("Microsoft-Windows-TCPIP/", "Microsoft-Windows-RPC/"),
      "network_control_effect_unobserved",
    ],
  ] as const;
  for (const [candidate, reason] of cases) {
    assert.deepEqual(
      inspectNativeRuntimeTrace(candidate, traceStatistics(), OPTIONS),
      {
        status: "blocked",
        reason,
      },
    );
  }
  assert.deepEqual(
    inspectNativeRuntimeTrace(
      trace([]),
      `${traceStatistics()}${traceStatistics()}`,
      OPTIONS,
    ),
    { status: "blocked", reason: "trace_summary_invalid" },
  );
});

test("入力契約外はtrace判定前に拒否する", () => {
  assert.deepEqual(
    inspectNativeRuntimeTrace(null, traceStatistics(), OPTIONS),
    {
      status: "blocked",
      reason: "input_invalid",
    },
  );
  assert.deepEqual(
    inspectNativeRuntimeTrace(trace([]), traceStatistics(), {
      ...OPTIONS,
      targetProcessName: "invalid path.exe",
    }),
    { status: "blocked", reason: "input_invalid" },
  );
});

test("Network positive controlはloopbackだけを受理する", () => {
  const externalControl = trace([]).replace("127.0.0.1:9", "203.0.113.1:443");
  assert.deepEqual(
    inspectNativeRuntimeTrace(externalControl, traceStatistics(), OPTIONS),
    { status: "blocked", reason: "network_control_scope_invalid" },
  );

  const paddedLoopback = trace([]).replaceAll("127.0.0.1", "127.000.000.001");
  assert.equal(
    inspectNativeRuntimeTrace(paddedLoopback, traceStatistics(), OPTIONS)
      .status,
    "accepted",
  );
});

test("重複Image Loadを同一Pathへ畳み、大小文字差を同じSystem32として扱う", () => {
  const candidate = trace([
    'I-Start, 13, crdd-platform-access.exe (101), 0, 0, 0, 0, 0, "c:\\windows\\system32\\NTDLL.DLL", , "\\Device\\ntdll"',
  ]);
  const result = inspectNativeRuntimeTrace(
    candidate,
    traceStatistics(),
    OPTIONS,
  );
  assert.equal(result.status, "accepted");
  if (result.status === "accepted") assert.equal(result.target.moduleCount, 2);
});

test("trace確認CLIは実ファイル搬送・引数・読取り拒否を終了コードへ接続する", {
  skip: process.platform !== "win32",
}, () => {
  const environment = createWindowsHostOperationSupervisorEnvironment();
  assert.ok(environment);
  const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
  const parent = path.join(repositoryRoot, ".crdd", "test-tmp");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.realpathSync.native(parent), parent);
  assert.equal(fs.lstatSync(parent).isSymbolicLink(), false);
  const root = fs.mkdtempSync(path.join(parent, "native-trace-cli-"));
  const identity = fs.lstatSync(root, { bigint: true });
  const events = path.join(root, "events.txt");
  const statistics = path.join(root, "statistics.txt");
  const script = path.join(
    repositoryRoot,
    "40_Develop/coordinator/scripts/check-native-runtime-trace.ts",
  );
  const argumentsValues = [
    "--events",
    events,
    "--trace-stats",
    statistics,
    "--target-process",
    OPTIONS.targetProcessName,
    "--control-process",
    OPTIONS.networkControlProcessName,
    "--expected-image",
    OPTIONS.expectedTargetImage,
    "--system32",
    OPTIONS.windowsSystem32Directory,
  ];
  const invokeCli = (args: string[]) => {
    const result = spawnSync(process.execPath, [script, ...args], {
      cwd: root,
      env: { ...environment, TEMP: root, TMP: root },
      shell: false,
      windowsHide: true,
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    return result;
  };
  try {
    fs.writeFileSync(events, trace([]));
    fs.writeFileSync(statistics, traceStatistics());
    const accepted = invokeCli(argumentsValues);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.deepEqual(
      JSON.parse(accepted.stdout),
      inspectNativeRuntimeTrace(trace([]), traceStatistics(), OPTIONS),
    );
    fs.writeFileSync(statistics, traceStatistics(1));
    const blocked = invokeCli(argumentsValues);
    assert.equal(blocked.status, 2);
    assert.deepEqual(JSON.parse(blocked.stdout), {
      status: "blocked",
      reason: "trace_events_lost",
    });
    fs.writeFileSync(statistics, traceStatistics());
    for (const args of [
      [],
      [...argumentsValues.slice(0, -2), "--events", events],
      ["--unknown", events, ...argumentsValues.slice(2)],
      ["--events", "events.txt", ...argumentsValues.slice(2)],
      ["--events", "", ...argumentsValues.slice(2)],
    ]) {
      const result = invokeCli(args);
      assert.equal(result.status, 1, result.stderr);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr, "native_runtime_trace_arguments_invalid\n");
    }
    for (const eventPath of [path.join(root, "missing.txt"), root]) {
      const result = invokeCli([
        "--events",
        eventPath,
        ...argumentsValues.slice(2),
      ]);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.match(
        result.stderr,
        /^(?:native_runtime_trace_file_unavailable|native_runtime_trace_events_not_regular_file)\n$/u,
      );
    }
    for (const content of ["", "x".repeat(1024 * 1024 + 1)]) {
      fs.writeFileSync(statistics, content);
      const result = invokeCli(argumentsValues);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr, "native_runtime_trace_events_size_invalid\n");
    }
  } finally {
    assert.equal(path.dirname(root), parent);
    assert.equal(fs.realpathSync.native(root), root);
    const current = fs.lstatSync(root, { bigint: true });
    assert.equal(current.isSymbolicLink(), false);
    assert.equal(current.dev, identity.dev);
    assert.equal(current.ino, identity.ino);
    assert.equal(current.birthtimeNs, identity.birthtimeNs);
    fs.rmSync(root, { recursive: true });
    assert.equal(fs.existsSync(root), false);
  }
});
