import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  describeInteractiveConsoleContract,
  INTERACTIVE_CONSOLE_CONTRACT,
  withInteractiveConsoleUsingAdapter,
} from "../src/core/interactive-console.ts";
import {
  describeCoordinatorNodeRuntimeVersionContract,
  MINIMUM_COORDINATOR_NODE_VERSION,
} from "../src/core/node-runtime-version.ts";

const coordinatorRoot = path.resolve(import.meta.dirname, "..");

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".ts") ? [absolute] : [];
  });
}

test("対話Consoleは一つのRuntime契約だけがOS deviceを所有する", () => {
  assert.deepEqual(describeInteractiveConsoleContract(), {
    contract: INTERACTIVE_CONSOLE_CONTRACT,
    contractRevision: 2,
    windowsDevices: ["\\\\.\\CONIN$", "\\\\.\\CONOUT$"],
    posixDevice: "/dev/tty",
    standardInputFallbackAllowed: false,
    shellTransportAllowed: false,
    unavailableResult: "fail_closed",
  });

  const executableSources = ["bin", "scripts", "src"]
    .flatMap((directory) => sourceFiles(path.join(coordinatorRoot, directory)))
    .filter((file) => !file.endsWith("interactive-console.ts"));
  for (const file of executableSources) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(/CONIN\$|CONOUT\$|\/dev\/tty/u.test(source), false, file);
  }
});

test("対話ConsoleのOS device openと全失敗位置を一つのprimitiveで閉じる", () => {
  function scenario(
    options: { failOpenAt?: number; failClose?: ReadonlySet<number> } = {},
  ) {
    const deviceOpenRecords: Array<Readonly<[string, "r" | "w"]>> = [];
    const closedDescriptors: number[] = [];
    return {
      deviceOpenRecords,
      closedDescriptors,
      adapter: Object.freeze({
        open: (device: string, flags: "r" | "w") => {
          deviceOpenRecords.push(Object.freeze([device, flags]));
          if (deviceOpenRecords.length === options.failOpenAt) {
            throw new Error("open failed");
          }
          return 10 + deviceOpenRecords.length;
        },
        close: (descriptor: number) => {
          closedDescriptors.push(descriptor);
          if (options.failClose?.has(descriptor)) {
            throw new Error("close failed");
          }
        },
      }),
    };
  }

  const windows = scenario();
  assert.deepEqual(
    withInteractiveConsoleUsingAdapter(
      "win32",
      windows.adapter,
      (handles) => handles,
    ),
    { input: 11, output: 12 },
  );
  assert.deepEqual(windows.deviceOpenRecords, [
    ["\\\\.\\CONIN$", "r"],
    ["\\\\.\\CONOUT$", "w"],
  ]);
  assert.deepEqual(windows.closedDescriptors, [11, 12]);

  const posix = scenario();
  assert.equal(
    withInteractiveConsoleUsingAdapter("linux", posix.adapter, () => true),
    true,
  );
  assert.deepEqual(posix.deviceOpenRecords, [
    ["/dev/tty", "r"],
    ["/dev/tty", "w"],
  ]);
  assert.deepEqual(posix.closedDescriptors, [11, 12]);

  const inputOpenFailure = scenario({ failOpenAt: 1 });
  assert.equal(
    withInteractiveConsoleUsingAdapter(
      "win32",
      inputOpenFailure.adapter,
      () => true,
    ),
    null,
  );
  assert.deepEqual(inputOpenFailure.closedDescriptors, []);

  const outputOpenFailure = scenario({ failOpenAt: 2 });
  assert.equal(
    withInteractiveConsoleUsingAdapter(
      "win32",
      outputOpenFailure.adapter,
      () => true,
    ),
    null,
  );
  assert.deepEqual(outputOpenFailure.closedDescriptors, [11]);

  const operationFailure = scenario();
  assert.equal(
    withInteractiveConsoleUsingAdapter(
      "win32",
      operationFailure.adapter,
      () => {
        throw new Error("operation failed");
      },
    ),
    null,
  );
  assert.deepEqual(operationFailure.closedDescriptors, [11, 12]);

  for (const failedDescriptor of [11, 12]) {
    const closeFailure = scenario({
      failClose: new Set([failedDescriptor]),
    });
    assert.equal(
      withInteractiveConsoleUsingAdapter(
        "win32",
        closeFailure.adapter,
        () => true,
      ),
      null,
    );
    assert.deepEqual(closeFailure.closedDescriptors, [11, 12]);
  }
});

test("Executable sourceとpackage commandへShell依存のJSON搬送を再導入しない", () => {
  const forbiddenPatterns = [
    /StandardInputEncoding/u,
    /Start-Process/u,
    /ConvertTo-Json/u,
    /shell\s*:\s*true/u,
  ];
  for (const directory of ["bin", "scripts", "src"]) {
    for (const file of sourceFiles(path.join(coordinatorRoot, directory))) {
      const source = fs.readFileSync(file, "utf8");
      for (const pattern of forbiddenPatterns) {
        assert.equal(pattern.test(source), false, `${file}: ${pattern.source}`);
      }
    }
  }

  const packageDocument = JSON.parse(
    fs.readFileSync(path.join(coordinatorRoot, "package.json"), "utf8"),
  ) as { engines?: { node?: string }; scripts?: Record<string, string> };
  assert.equal(
    packageDocument.engines?.node,
    `>=${MINIMUM_COORDINATOR_NODE_VERSION}`,
  );
  const lockDocument = JSON.parse(
    fs.readFileSync(path.join(coordinatorRoot, "package-lock.json"), "utf8"),
  ) as { packages?: { ""?: { engines?: { node?: string } } } };
  assert.equal(
    lockDocument.packages?.[""]?.engines?.node,
    packageDocument.engines?.node,
  );
  for (const [name, command] of Object.entries(packageDocument.scripts ?? {})) {
    assert.equal(
      /powershell|pwsh|cmd(?:\.exe)?\s+\/c/iu.test(command),
      false,
      name,
    );
  }
  assert.equal(packageDocument.scripts?.["release-key:generate"], undefined);
  assert.equal(packageDocument.scripts?.["release-manifest:sign"], undefined);
  assert.equal(packageDocument.scripts?.doctor, undefined);

  for (const relative of [
    "scripts/sign-release-manifest.ts",
    "src/core/doctor.ts",
  ]) {
    const source = fs.readFileSync(
      path.join(coordinatorRoot, relative),
      "utf8",
    );
    assert.equal(
      /(?:execFile|spawn)Sync\(\s*["']git["']/u.test(source),
      false,
      relative,
    );
  }

  const productionChildProcessOwners = sourceFiles(
    path.join(coordinatorRoot, "src"),
  )
    .filter((file) =>
      fs.readFileSync(file, "utf8").includes('from "node:child_process"'),
    )
    .map((file) => path.relative(coordinatorRoot, file).replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(productionChildProcessOwners, [
    "src/security/candidate-store-windows-adapter.ts",
    "src/security/docker-effect-runtime.ts",
    "src/security/docker-isolation.ts",
    "src/security/docker-recovery-runtime-internal.ts",
    "src/security/provider-home-windows-adapter.ts",
  ]);

  for (const directory of ["bin", "scripts", "src"]) {
    for (const file of sourceFiles(path.join(coordinatorRoot, directory))) {
      const source = fs.readFileSync(file, "utf8");
      assert.equal(
        /(?:execFile|spawn)(?:Sync)?\(\s*["']git["']/u.test(source),
        false,
        file,
      );
    }
  }
});

test("Node版GateはPATHをAuthorityにせずEffect前に停止する", () => {
  assert.deepEqual(describeCoordinatorNodeRuntimeVersionContract(), {
    contract: "crdd-coordinator/node-runtime-version",
    contractRevision: 1,
    minimumVersion: "24.12.0",
    checkTiming: "before_interactive_input_release_verification_or_effect",
    pathLookupAuthority: false,
    unsupportedRuntimeFallbackAllowed: false,
  });

  const guardedEntrypoints = [
    "bin/coordinator.ts",
    "scripts/generate-release-key.ts",
    "scripts/sign-release-manifest.ts",
    "scripts/verify-signed-general-task.ts",
  ];
  for (const relative of guardedEntrypoints) {
    const source = fs.readFileSync(
      path.join(coordinatorRoot, relative),
      "utf8",
    );
    assert.match(source, /CoordinatorNodeRuntime/u, relative);
  }

  const readme = fs.readFileSync(
    path.join(coordinatorRoot, "README.md"),
    "utf8",
  );
  assert.match(
    readme,
    /"<absolute-preverified-node-24\.12\+-executable>" "<absolute-crdd-source-root>\\tools\\coordinator\\scripts\\generate-release-key\.ts"/u,
  );
  assert.match(
    readme,
    /"<absolute-preverified-node-24\.12\+-executable>" "<absolute-crdd-source-root>\\tools\\coordinator\\scripts\\sign-release-manifest\.ts"/u,
  );
  assert.match(
    readme,
    /"<absolute-preverified-node-24\.12\+-executable>" "<absolute-crdd-source-root>\\tools\\coordinator\\bin\\coordinator\.ts" doctor/u,
  );
  assert.equal(readme.includes("$CRDD_NODE"), false);
  assert.equal(readme.includes("$CRDD_COORDINATOR"), false);
  assert.equal(
    /<absolute-preverified-node-24\.12\+-executable> tools\/coordinator\/scripts\/(?:generate-release-key|sign-release-manifest)\.ts/u.test(
      readme,
    ),
    false,
  );
  assert.match(readme, /--runtime-root "<absolute-path>"/u);
  assert.match(
    readme,
    /"<signed-distribution-root>\\tools\\coordinator\\scripts\\verify-signed-general-task\.ts"/u,
  );
  assert.match(readme, /--distribution-root "<absolute-staging-root>"/u);
  assert.match(
    readme,
    /--private-key "C:\\project\\key\\CRDD\\crdd-release-v1-private\.pem"/u,
  );
  assert.equal(
    /```powershell\r?\n& <absolute-preverified-node/u.test(readme),
    false,
  );

  const keyGeneratorSource = fs.readFileSync(
    path.join(coordinatorRoot, "scripts", "generate-release-key.ts"),
    "utf8",
  );
  assert.match(
    keyGeneratorSource,
    /usage: & "<absolute-preverified-node-24\.12\+-executable>"/u,
  );
});
