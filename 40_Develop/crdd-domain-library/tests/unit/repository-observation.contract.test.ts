/**
 * crdd-domain-library:unit:repository-observationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility crdd-domain-library:unit:repository-observationが所有する検証責務を実行する。
 * @trace RFD-UT-006
 * @level UT
 * @scope repository、filesystem、boundary、negative-control
 * @boundary N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createFilesystemRepositoryObservationPortWithOperations } from "../../src/repository-observation/filesystem-repository-observer.ts";

const openedPaths = new Map<number, string>();
const actualOperations = {
  lstat: (targetPath: string) => fs.lstatSync(targetPath),
  stat: (targetPath: string) => fs.statSync(targetPath),
  realpath: (targetPath: string) => fs.realpathSync.native(targetPath),
  readdir: (targetPath: string) =>
    fs.readdirSync(targetPath, { withFileTypes: true }),
  open: (targetPath: string) => {
    const descriptor = fs.openSync(targetPath, "r");
    openedPaths.set(descriptor, fs.realpathSync.native(targetPath));
    return descriptor;
  },
  openedPath: (descriptor: number, _requestedPath: string) =>
    openedPaths.get(descriptor) ?? null,
  fstat: (descriptor: number) => fs.fstatSync(descriptor),
  read: (descriptor: number) => fs.readFileSync(descriptor, "utf8"),
  close: (descriptor: number) => {
    openedPaths.delete(descriptor);
    fs.closeSync(descriptor);
  },
};

/**
 * rootBindingのTest準備責務を実行する。
 *
 * @responsibility rootBindingがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus rootBindingを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
function rootBinding(root: string) {
  return {
    absolutePath: root,
    canonicalPath: root,
    pathFlavor: path.sep === "\\" ? ("win32" as const) : ("posix" as const),
  };
}

/**
 * Repository外PathをFilesystem観測前に拒否するを検証する。
 *
 * @responsibility Repository外PathをFilesystem観測前に拒否するの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository外PathをFilesystem観測前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("Repository外PathをFilesystem観測前に拒否する", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-repository-root-"));
  const observedPaths: string[] = [];
  try {
    const port = createFilesystemRepositoryObservationPortWithOperations(
      rootBinding(root),
      {
        ...actualOperations,
        lstat: (targetPath) => {
          observedPaths.push(targetPath);
          return fs.lstatSync(targetPath);
        },
      },
    );
    for (const unsafePath of [
      "",
      ".",
      "..",
      "../outside.txt",
      "folder//file.txt",
      "folder\\file.txt",
      "C:\\outside.txt",
      "/outside.txt",
      "\\\\server\\share\\outside.txt",
    ]) {
      const result = port.observeFile(unsafePath);
      assert.equal(result.status, "invalid", unsafePath);
    }
    assert.deepEqual(observedPaths, [root]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 中間linkと観測途中の変化をinvalidとunobservableへ分けるを検証する。
 *
 * @responsibility 中間linkと観測途中の変化をinvalidとunobservableへ分けるの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 中間linkと観測途中の変化をinvalidとunobservableへ分けるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("中間linkと観測途中の変化をinvalidとunobservableへ分ける", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-repository-root-"));
  try {
    const linkedPort = createFilesystemRepositoryObservationPortWithOperations(
      rootBinding(root),
      {
        ...actualOperations,
        lstat: (targetPath) => {
          if (targetPath === root) return fs.lstatSync(root);
          return {
            isSymbolicLink: () => true,
            isDirectory: () => false,
            isFile: () => false,
          } as fs.Stats;
        },
        realpath: (targetPath) => fs.realpathSync.native(targetPath),
        read: () => {
          throw new Error("linked target must not be read");
        },
      },
    );
    assert.equal(linkedPort.observeFile("linked/file.txt").status, "invalid");

    const changedPort = createFilesystemRepositoryObservationPortWithOperations(
      rootBinding(root),
      {
        ...actualOperations,
        lstat: (targetPath) =>
          targetPath === root
            ? fs.lstatSync(root)
            : ({
                isSymbolicLink: () => false,
                isDirectory: () => false,
                isFile: () => true,
              } as fs.Stats),
        realpath: (targetPath) => {
          if (targetPath === root) return fs.realpathSync.native(root);
          throw new Error("target changed before canonical observation");
        },
        read: () => {
          throw new Error("changed target must not be read");
        },
      },
    );
    assert.equal(changedPort.observeFile("changed.txt").status, "unobservable");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 観測不能なRepository Rootを不存在へ畳まないを検証する。
 *
 * @responsibility 観測不能なRepository Rootを不存在へ畳まないの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 観測不能なRepository Rootを不存在へ畳まないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("観測不能なRepository Rootを不存在へ畳まない", () => {
  const root = "C:\\fixture\\unobservable-root";
  const port = createFilesystemRepositoryObservationPortWithOperations(
    rootBinding(root),
    {
      ...actualOperations,
      lstat: () => {
        throw new Error("root observation failed");
      },
      realpath: () => {
        throw new Error("realpath must not run");
      },
      read: () => {
        throw new Error("readFile must not run");
      },
    },
  );
  assert.equal(port.observeDirectory("40_Develop").status, "unobservable");
});

/**
 * OS別に相対Rootと異なるFlavorのRoot BindingをFilesystem観測前に拒否するを検証する。
 *
 * @responsibility OS別に相対Rootと異なるFlavorのRoot BindingをFilesystem観測前に拒否するの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus OS別に相対Rootと異なるFlavorのRoot BindingをFilesystem観測前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("OS別に相対Rootと異なるFlavorのRoot BindingをFilesystem観測前に拒否する", () => {
  for (const [candidate, pathFlavor] of [
    ["relative-root", "win32"],
    ["\\root-relative", "win32"],
    ["/root-relative", "win32"],
    ["C:\\repository", "posix"],
    ["\\\\server\\share\\repository", "posix"],
  ] as const) {
    let observationCount = 0;
    const port = createFilesystemRepositoryObservationPortWithOperations(
      { absolutePath: candidate, canonicalPath: candidate, pathFlavor },
      {
        ...actualOperations,
        lstat: () => {
          observationCount += 1;
          throw new Error("invalid binding must not be observed");
        },
      },
    );
    assert.equal(port.observeDirectory("40_Develop").status, "invalid");
    assert.equal(observationCount, 0);
  }
});

/**
 * Repository Root自身のlinkまたはjunctionを拒否するを検証する。
 *
 * @responsibility Repository Root自身のlinkまたはjunctionを拒否するの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository Root自身のlinkまたはjunctionを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("Repository Root自身のlinkまたはjunctionを拒否する", () => {
  const root = "C:\\fixture\\repository-link";
  const observedPaths: string[] = [];
  const port = createFilesystemRepositoryObservationPortWithOperations(
    rootBinding(root),
    {
      ...actualOperations,
      lstat: (targetPath) => {
        observedPaths.push(targetPath);
        return {
          isSymbolicLink: () => true,
          isDirectory: () => false,
        } as fs.Stats;
      },
      realpath: () => {
        throw new Error("realpath must not run for a linked root");
      },
      read: () => {
        throw new Error("readFile must not run for a linked root");
      },
    },
  );
  const result = port.observeDirectory("40_Develop");
  assert.equal(result.status, "invalid");
  assert.deepEqual(observedPaths, [root]);
});

/**
 * Directory列挙は名前順とEntry種別を固定しlinkを通常Directoryへ畳まないを検証する。
 *
 * @responsibility Directory列挙は名前順とEntry種別を固定しlinkを通常Directoryへ畳まないの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Directory列挙は名前順とEntry種別を固定しlinkを通常Directoryへ畳まないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("Directory列挙は名前順とEntry種別を固定しlinkを通常Directoryへ畳まない", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-repository-root-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-outside-root-"));
  try {
    fs.mkdirSync(path.join(root, "entries"));
    fs.mkdirSync(path.join(root, "entries", "b-directory"));
    fs.writeFileSync(path.join(root, "entries", "a-file.txt"), "a", "utf8");
    fs.symlinkSync(
      outside,
      path.join(root, "entries", "c-link"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const observed = createFilesystemRepositoryObservationPortWithOperations(
      rootBinding(root),
      actualOperations,
    ).observeDirectory("entries");
    assert.equal(observed.status, "resolved");
    if (observed.status !== "resolved") return;
    assert.deepEqual(observed.entries, [
      { name: "a-file.txt", kind: "file" },
      { name: "b-directory", kind: "directory" },
      { name: "c-link", kind: "symbolic-link" },
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

/**
 * 差替えで別File Handleを取得しても読まずにcloseするを検証する。
 *
 * @responsibility 差替えで別File Handleを取得しても読まずにcloseするの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 差替えで別File Handleを取得しても読まずにcloseするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("差替えで別File Handleを取得しても読まずにcloseする", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-repository-root-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-outside-root-"));
  const insidePath = path.join(root, "inside.txt");
  const outsidePath = path.join(outside, "outside.txt");
  fs.writeFileSync(insidePath, "inside", "utf8");
  fs.writeFileSync(outsidePath, "outside", "utf8");
  let readCount = 0;
  let closeCount = 0;
  try {
    const port = createFilesystemRepositoryObservationPortWithOperations(
      rootBinding(root),
      {
        ...actualOperations,
        open: () => {
          const descriptor = fs.openSync(outsidePath, "r");
          openedPaths.set(descriptor, outsidePath);
          return descriptor;
        },
        openedPath: (descriptor) => openedPaths.get(descriptor) ?? null,
        read: (descriptor) => {
          readCount += 1;
          return fs.readFileSync(descriptor, "utf8");
        },
        close: (descriptor) => {
          closeCount += 1;
          openedPaths.delete(descriptor);
          fs.closeSync(descriptor);
        },
      },
    );
    assert.equal(port.observeFile("inside.txt").status, "invalid");
    assert.equal(readCount, 0);
    assert.equal(closeCount, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

/**
 * PlatformがOpened Handleの所在を証明できなければ読まずにcloseするを検証する。
 *
 * @responsibility PlatformがOpened Handleの所在を証明できなければ読まずにcloseするの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PlatformがOpened Handleの所在を証明できなければ読まずにcloseするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("PlatformがOpened Handleの所在を証明できなければ読まずにcloseする", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-repository-root-"));
  const target = path.join(root, "target.txt");
  fs.writeFileSync(target, "target", "utf8");
  let readCount = 0;
  let closeCount = 0;
  try {
    const port = createFilesystemRepositoryObservationPortWithOperations(
      rootBinding(root),
      {
        ...actualOperations,
        openedPath: () => null,
        read: () => {
          readCount += 1;
          return "unexpected";
        },
        close: (descriptor) => {
          closeCount += 1;
          openedPaths.delete(descriptor);
          fs.closeSync(descriptor);
        },
      },
    );
    assert.equal(port.observeFile("target.txt").status, "unobservable");
    assert.equal(readCount, 0);
    assert.equal(closeCount, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
