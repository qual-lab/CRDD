/**
 * Direct／Isolated共通の固定Path書込み境界を合成物で確認する。
 * @packageDocumentation
 * @responsibility 実ID固定の二構成、Host前後観測、失敗時停止と自己生成物回収を所有する。
 * @trace ERB-IT-001 ERB-IT-002
 * @level IT
 * @scope DirectのFilesystem構成。製品Provider・実Git・未知秘密の包括保護は対象外。
 * @boundary 実Docker→合成Tree。通常回帰では実行しない。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const IMAGE =
  "sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047";
const REPOSITORY = path.resolve(
  fileURLToPath(new URL("../../../..", import.meta.url)),
);
const ROOT = path.join(
  REPOSITORY,
  ".crdd",
  "tests",
  "workspace-write-boundary",
);
const DOCKER = "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
const LABEL = "org.crdd.workspace-write-probe";
const RUN = randomUUID();
const enabled = process.env.CRDD_WORKSPACE_WRITE_BOUNDARY_APPROVED === "1";
const planned = [
  "dirty-input",
  "normal-write",
  "development-env-readable",
  "git-existing-write-denied",
  "git-write-denied",
  "internal-existing-write-denied",
  "internal-write-denied",
  "git-rename-denied",
  "internal-rename-denied",
  "git-unlink-denied",
  "internal-unlink-denied",
];
const unimplemented = [
  "secret-complete-hiding",
  "hardlink-alias-protection",
  "symlink-alias-protection",
  "case-alias-protection",
  "nested-git-protection",
  "junction",
  "parent-directory-replacement",
  "arbitrary-repository-applicability",
];

type Row = {
  name: string;
  status: "Pass" | "Fail" | "Not Run";
  detail?: string;
};
type Mount = { Type: string; Source: string; Destination: string; RW: boolean };
type Container = {
  Id: string;
  Name: string;
  Image: string;
  Config: { User: string; Labels: Record<string, string>; Image: string };
  HostConfig: {
    NetworkMode: string;
    ReadonlyRootfs: boolean;
    CapDrop: string[];
    SecurityOpt: string[];
    Binds: string[] | null;
  };
  Mounts: Mount[];
  State: { Running: boolean; ExitCode: number };
};
type Observation = { bytes: string; ino: string; dev: string; mode: string };

const stimulus = String.raw`
import errno, json, os, pathlib, sys
rows = []
def result(name, ok):
    rows.append({"name": name, "status": "Pass" if ok else "Fail"})
    if not ok:
        print(json.dumps(rows), flush=True)
        sys.exit(3)
def denied(name, action):
    try:
        action()
    except OSError as error:
        result(name, error.errno in (errno.EROFS, errno.EBUSY, errno.EACCES, errno.EPERM))
    else:
        result(name, False)
work = pathlib.Path('/work')
source = work / 'source.txt'
result('dirty-input', source.read_text() == 'synthetic-existing-dirty\n')
source.write_text('synthetic-direct-change\n')
result('normal-write', source.read_text() == 'synthetic-direct-change\n')
git = work / '.git'
result('development-env-readable', (work / '.env').read_text() == 'synthetic-development-value\n')
denied('git-existing-write-denied', lambda: (git / 'config').write_text('probe') if git.is_dir() else git.write_text('probe'))
denied('git-write-denied', lambda: (git / 'new.txt').write_text('probe') if git.is_dir() else git.write_text('probe'))
denied('internal-existing-write-denied', lambda: (work / '.crdd' / 'state.json').write_text('probe'))
denied('internal-write-denied', lambda: (work / '.crdd' / 'new.txt').write_text('probe'))
denied('git-rename-denied', lambda: git.rename(work / 'git-displaced'))
denied('internal-rename-denied', lambda: (work / '.crdd').rename(work / 'state-displaced'))
denied('git-unlink-denied', lambda: git.rmdir() if git.is_dir() else git.unlink())
denied('internal-unlink-denied', lambda: (work / '.crdd').rmdir())
print(json.dumps(rows), flush=True)
`;

/**
 * Dockerの一要求を期限・出力上限付きで実行する。
 * @responsibility shellを介さず、実要求の失敗と観測不能を保持する。
 * @trace ERB-IT-002
 * @precondition 呼出し元が固定argvと自己資源だけを指定する。
 * @stimulus Docker CLI一要求。
 * @observation exit・error・限定stdout。
 * @oracle errorや非zeroを空の成功へ補完しない。
 * @cleanup 同期子の終了後に戻る。Container回収は呼出し元。
 * @boundary ローカルDocker CLI。
 */
function docker(args: string[], timeout = 10_000) {
  return spawnSync(DOCKER, args, {
    encoding: "utf8",
    timeout,
    killSignal: "SIGKILL",
    maxBuffer: 256 * 1024,
    windowsHide: true,
    shell: false,
  });
}

/**
 * 一要求の正常完了だけから構造化出力を得る。
 * @responsibility 期限・通信失敗を例外として停止する。
 * @trace ERB-IT-002
 * @precondition argvは固定操作。
 * @stimulus 同期CLI要求。
 * @observation 正常stdoutのみ。
 * @oracle timeout・signal・非zeroは拒否。
 * @cleanup docker関数と同じ。
 * @boundary Docker CLI応答。
 */
function checked(args: string[], timeout = 10_000): string {
  const result = docker(args, timeout);
  assert.equal(
    result.error,
    undefined,
    `docker request unobserved: ${args[0]}`,
  );
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, `docker request failed: ${args[0]}`);
  return result.stdout.trim();
}

/**
 * Host側の保護対象を内容・実体で観測する。
 * @responsibility 合成fileの変更と差替えを区別する。
 * @trace ERB-IT-001
 * @precondition 対象は専用Root内の合成file。
 * @stimulus lstatと読取り。
 * @observation bytes・inode・device・mode。
 * @oracle 観測例外を不存在へ畳まない。
 * @cleanup N/A: handleを残さない同期読取り。
 * @boundary Host Filesystem。
 */
function observe(file: string): Observation {
  const stat = fs.lstatSync(file, { bigint: true });
  assert.equal(stat.isSymbolicLink(), false);
  return {
    bytes: stat.isFile()
      ? fs.readFileSync(file).toString("base64")
      : JSON.stringify(fs.readdirSync(file).sort()),
    ino: String(stat.ino),
    dev: String(stat.dev),
    mode: String(stat.mode),
  };
}

/**
 * 初回と回収直前に同じ試験Container構成を照合する。
 * @responsibility 元ID・名前・隔離条件・Mountを同時に確認する。
 * @trace ERB-IT-002
 * @precondition 期待値は今回の固定生成値。
 * @stimulus inspect結果と元構成。
 * @observation 一致又はassertion失敗。
 * @oracle 不一致時に後続の削除へ進まない。
 * @cleanup N/A: 局所値だけ。
 * @boundary 試験器private照合。汎用回収機能ではない。
 */
function assertProbeContainer(
  value: Container,
  id: string,
  name: string,
  mounts: readonly { source: string; target: string; readonly: boolean }[],
) {
  assert.equal(value.Id, id);
  assert.equal(value.Name, `/${name}`);
  assert.equal(value.Image, IMAGE);
  assert.equal(value.Config.Image, IMAGE);
  assert.equal(value.Config.Labels[LABEL], RUN);
  assert.equal(value.Config.User, "65534:65534");
  assert.equal(value.HostConfig.NetworkMode, "none");
  assert.equal(value.HostConfig.ReadonlyRootfs, true);
  assert.deepEqual(value.HostConfig.CapDrop, ["ALL"]);
  assert.deepEqual(value.HostConfig.SecurityOpt, ["no-new-privileges"]);
  assert.equal(value.Mounts.length, mounts.length);
  for (const mount of mounts) {
    const actual = value.Mounts.find(
      (item) => item.Destination === mount.target,
    );
    assert.ok(actual);
    assert.equal(actual.Type, "bind");
    assert.equal(
      actual.Source.toLowerCase().replaceAll("\\", "/"),
      mount.source.toLowerCase().replaceAll("\\", "/"),
    );
    assert.equal(actual.RW, !mount.readonly);
  }
}

/**
 * 合成物の削除境界を確認してlinkを辿らず回収する。
 * @responsibility 既存Rootを再利用せず、自己生成物だけを削除する。
 * @trace ERB-IT-001
 * @precondition Container不存在確認済み、同じ実行がRootを作成済み。
 * @stimulus 再帰lstatとunlink／rmdir。
 * @observation 専用Rootの不存在。
 * @oracle linkはunlinkだけ、Directory実体が専用Root外なら拒否。
 * @cleanup Root自体を含めて回収。
 * @boundary 専用試験Rootのみ。
 */
function removeFixture(directory: string): void {
  const stat = fs.lstatSync(directory);
  assert.equal(stat.isSymbolicLink(), false);
  const real = fs.realpathSync.native(directory);
  assert.ok(real === ROOT || real.startsWith(`${ROOT}${path.sep}`));
  for (const name of fs.readdirSync(directory)) {
    const entry = path.join(directory, name);
    const info = fs.lstatSync(entry);
    if (info.isSymbolicLink() || !info.isDirectory()) fs.unlinkSync(entry);
    else removeFixture(entry);
  }
  fs.rmdirSync(directory);
}

/**
 * 試験一件の一次失敗・最終Host観測・清掃を分離する。
 * @responsibility finallyの失敗で一次理由を置換せず、Host不変を成功条件へ接続する。
 * @trace ERB-IT-002
 * @precondition callbackは同期で、清掃対象は呼出し元が限定する。
 * @stimulus 実行、Host比較、清掃をそれぞれ一度だけ呼ぶ。
 * @observation 一次理由・Host三値・清掃理由。
 * @oracle 二重失敗は両方保持し、Host不明・不一致は成功にしない。
 * @cleanup 清掃の例外も捕捉して呼出し元へ返す。
 * @boundary 試験private関数。本番Recoveryには追加しない。
 */
function settleDirectCase(
  execute: () => void,
  host: () => boolean,
  cleanup: () => void,
  failureStage: () => string,
) {
  let primaryFailure: string | null = null;
  let cleanupFailure: string | null = null;
  let hostPreserved: boolean | null = null;
  try {
    execute();
  } catch {
    primaryFailure = failureStage();
  } finally {
    try {
      hostPreserved = host();
    } catch {
      hostPreserved = null;
    }
    if (hostPreserved !== true)
      primaryFailure ??=
        hostPreserved === false ? "host_final_changed" : "host_final_unknown";
    try {
      cleanup();
    } catch {
      cleanupFailure = "container_cleanup_unconfirmed";
    }
  }
  return { primaryFailure, cleanupFailure, hostPreserved };
}

/**
 * 試験器自身の二重失敗とHost単独失敗をDockerなしで反証する。
 * @responsibility 清掃成功を元試験成功へ読み替えないOracleを固定する。
 * @trace ERB-IT-002
 * @precondition 実Docker・Filesystemを操作しない。
 * @stimulus 一次のみ、清掃のみ、両方、Hostのみの失敗。
 * @observation 個別失敗理由とcallback呼出し回数。
 * @oracle 四形すべて失敗を保持し清掃は一回。
 * @cleanup N/A: Memory内の同期callbackだけ。
 * @boundary 試験器の局所反証。隔離成立の試験ではない。
 */
test("Direct試験器は一次・清掃・最終Host失敗を分離する", () => {
  for (const variant of ["primary", "cleanup", "both", "host"]) {
    let cleanups = 0;
    const result = settleDirectCase(
      () => {
        if (variant === "primary" || variant === "both")
          throw new Error("synthetic");
      },
      () => variant !== "host",
      () => {
        cleanups++;
        if (variant === "cleanup" || variant === "both")
          throw new Error("synthetic");
      },
      () => "stimulus",
    );
    assert.equal(cleanups, 1);
    assert.equal(
      result.primaryFailure,
      variant === "host"
        ? "host_final_changed"
        : variant === "cleanup"
          ? null
          : "stimulus",
    );
    assert.equal(
      result.cleanupFailure,
      variant === "cleanup" || variant === "both"
        ? "container_cleanup_unconfirmed"
        : null,
    );
  }
});

/**
 * 回収前の構成不一致を有限代役で反証する。
 * @responsibility 照合失敗から削除へ進まないことを確認する。
 * @trace ERB-IT-001 ERB-IT-002
 * @precondition 局所のinspect代役だけを使う。
 * @stimulus Mount・NetworkMode・名前を一軸ずつ変更する。
 * @observation 削除要求回数と清掃失敗。
 * @oracle 削除0、清掃失敗を保持。
 * @cleanup N/A: Docker要求なし。
 * @boundary 試験器だけの反証であり実資源回収の根拠ではない。
 */
test("試験Container構成差は回収を発行せず清掃失敗として保持する", () => {
  const mounts = [
    { source: path.join(ROOT, "tree"), target: "/work", readonly: false },
  ];
  const original: Container = {
    Id: "a".repeat(64),
    Name: "/synthetic",
    Image: IMAGE,
    Config: { User: "65534:65534", Image: IMAGE, Labels: { [LABEL]: RUN } },
    HostConfig: {
      NetworkMode: "none",
      ReadonlyRootfs: true,
      CapDrop: ["ALL"],
      SecurityOpt: ["no-new-privileges"],
      Binds: null,
    },
    Mounts: [
      {
        Type: "bind",
        Source: path.join(ROOT, "tree"),
        Destination: "/work",
        RW: true,
      },
    ],
    State: { Running: false, ExitCode: 0 },
  };
  assertProbeContainer(original, original.Id, "synthetic", mounts);
  for (const axis of ["mount", "network", "name"] as const) {
    const changed = structuredClone(original);
    if (axis === "mount") {
      const mount = changed.Mounts[0];
      assert.ok(mount);
      mount.RW = false;
    }
    if (axis === "network") changed.HostConfig.NetworkMode = "bridge";
    if (axis === "name") changed.Name = "/different";
    let removals = 0;
    const result = settleDirectCase(
      () => {},
      () => true,
      () => {
        assertProbeContainer(changed, original.Id, "synthetic", mounts);
        removals++;
      },
      () => "unused",
    );
    assert.equal(removals, 0);
    assert.equal(result.primaryFailure, null);
    assert.equal(result.cleanupFailure, "container_cleanup_unconfirmed");
  }
});

/**
 * 承認済みの固定Path書込み境界を二構成だけで確認する。
 * @responsibility 実ID・構成照合・Host不変・失敗停止と清掃を分離する。
 * @trace ERB-IT-001 ERB-IT-002
 * @precondition 明示許可、Engine応答、既存固定Image、稼働Container0、専用Root不存在。
 * @stimulus 通常Source編集とGit／内部状態への書込み・rename・unlink。
 * @observation Container判定、Host実体、同IDと回収後不存在。
 * @oracle 固定Pathの拒否だけを判定し、対象外をPassへ算入しない。
 * @cleanup 今回の実ID・元構成が一致する資源と専用Rootだけを回収。
 * @boundary 合成Filesystem。任意Repository・全別名経路・Providerの保証ではない。
 */
test("Docker explicit: Workspace固定Path書込み境界", { skip: !enabled }, () => {
  assert.equal(process.platform, "win32");
  assert.equal(fs.realpathSync.native(REPOSITORY), "C:\\project\\CRDD");
  for (const ancestor of [path.join(REPOSITORY, ".crdd"), path.dirname(ROOT)]) {
    assert.equal(fs.lstatSync(ancestor).isSymbolicLink(), false);
    assert.equal(fs.realpathSync.native(ancestor), ancestor);
  }
  assert.equal(fs.existsSync(ROOT), false, "never reuse a previous fixture");
  const image = JSON.parse(checked(["image", "inspect", IMAGE]))[0];
  assert.equal(image.Id, IMAGE);
  assert.equal(image.Os, "linux");
  assert.equal(image.Architecture, "amd64");
  assert.ok(image.Config.Volumes == null);
  assert.equal(
    checked(["ps", "--quiet"]),
    "",
    "other running containers: stop",
  );
  fs.mkdirSync(ROOT);
  const report: {
    case: string;
    rows: Row[];
    hostPreserved: boolean | null;
    cleanupConfirmed: boolean;
    primaryFailure: string | null;
    cleanupFailure: string | null;
  }[] = [];
  let allAbsent = true;
  let fixtureFailure: string | null = null;
  let fixtureCleanupFailure: string | null = null;
  try {
    const masks = path.join(ROOT, "masks");
    fs.mkdirSync(masks);
    fs.mkdirSync(path.join(masks, "directory"));
    fs.writeFileSync(path.join(masks, "file"), "");
    const sentinel = path.join(ROOT, "sentinels", "git-management");
    fs.mkdirSync(path.dirname(sentinel));
    fs.writeFileSync(sentinel, "synthetic-outside-tree\n");
    for (const kind of ["directory-case", "pointer-case"]) {
      const tree = path.join(ROOT, kind);
      fs.mkdirSync(tree);
      fs.writeFileSync(
        path.join(tree, "source.txt"),
        "synthetic-existing-dirty\n",
      );
      fs.mkdirSync(path.join(tree, ".crdd"));
      fs.writeFileSync(
        path.join(tree, ".crdd", "state.json"),
        "synthetic-state\n",
      );
      fs.writeFileSync(
        path.join(tree, ".env"),
        "synthetic-development-value\n",
      );
      const git = path.join(tree, ".git");
      if (kind === "directory-case") {
        fs.mkdirSync(git);
        fs.writeFileSync(path.join(git, "config"), "synthetic-git-private\n");
      } else fs.writeFileSync(git, "gitdir: ../sentinels/git-management\n");
      const privateFile =
        kind === "directory-case" ? path.join(git, "config") : git;
      const protectedPaths = [
        tree,
        git,
        privateFile,
        path.join(tree, ".crdd"),
        path.join(tree, ".crdd", "state.json"),
        path.join(tree, ".env"),
        masks,
        path.join(masks, "file"),
        path.join(masks, "directory"),
        sentinel,
      ];
      const before = protectedPaths.map(observe);
      const source = path.join(tree, "source.txt");
      const name = `crdd-direct-mount-${RUN}-${kind}`;
      const mounts = [
        { source: tree, target: "/work", readonly: false },
        {
          source: path.join(
            masks,
            kind === "directory-case" ? "directory" : "file",
          ),
          target: "/work/.git",
          readonly: true,
        },
        {
          source: path.join(masks, "directory"),
          target: "/work/.crdd",
          readonly: true,
        },
      ];
      const entry = {
        case: kind,
        rows: [] as Row[],
        hostPreserved: null as boolean | null,
        cleanupConfirmed: false,
        primaryFailure: null as string | null,
        cleanupFailure: null as string | null,
      };
      report.push(entry);
      let id: string | null = null;
      let accepted = false;
      const deadline = Date.now() + 60_000;
      let stage = "pre-create";
      const settlement = settleDirectCase(
        () => {
          assert.equal(checked(["ps", "--quiet"]), "");
          stage = "container-create";
          const created = docker([
            "create",
            "--pull=never",
            "--name",
            name,
            "--label",
            `${LABEL}=${RUN}`,
            "--network=none",
            "--user=65534:65534",
            "--read-only",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges",
            ...mounts.flatMap((mount) => [
              "--mount",
              `type=bind,src=${mount.source},dst=${mount.target}${mount.readonly ? ",readonly" : ""}`,
            ]),
            IMAGE,
            "python3",
            "-B",
            "-c",
            stimulus,
          ]);
          if (
            !created.error &&
            created.status === 0 &&
            /^[0-9a-f]{64}\s*$/u.test(created.stdout)
          ) {
            id = created.stdout.trim();
          } else {
            allAbsent = false;
            throw new Error(`create outcome unknown; retained name=${name}`);
          }
          stage = "container-configuration";
          const inspect = JSON.parse(checked(["inspect", id]))[0] as Container;
          assertProbeContainer(inspect, id, name, mounts);
          accepted = true;
          const remaining = deadline - Date.now();
          assert.ok(remaining > 0, "case deadline exceeded before start");
          stage = "stimulus-execution";
          const started = docker(["start", "--attach", id], remaining);
          assert.equal(started.error, undefined, "execution unknown");
          assert.ok(Date.now() <= deadline + 500);
          assert.equal(started.signal, null);
          entry.rows = JSON.parse(started.stdout.trim()) as Row[];
          assert.ok(Array.isArray(entry.rows));
          assert.deepEqual(
            entry.rows.map((row) => row.name),
            planned,
          );
          stage = "host-observation";
          assert.deepEqual(protectedPaths.map(observe), before);
          assert.equal(
            fs.readFileSync(source, "utf8"),
            "synthetic-direct-change\n",
          );
          const ended = JSON.parse(checked(["inspect", id]))[0] as Container;
          stage = "protection-result";
          assert.equal(ended.State.Running, false);
          assert.equal(started.status, ended.State.ExitCode);
          assert.equal(
            ended.State.ExitCode,
            0,
            "protection counterexample observed",
          );
          assert.equal(
            entry.rows.some((row) => row.status !== "Pass"),
            false,
            "incomplete stimuli are not an overall Pass",
          );
        },
        () => isDeepStrictEqual(protectedPaths.map(observe), before),
        () => {
          if (id && accepted) {
            const current = JSON.parse(
              checked(["inspect", id]),
            )[0] as Container;
            assertProbeContainer(current, id, name, mounts);
            checked(["rm", "--force", id], 15_000);
            assert.equal(
              checked([
                "ps",
                "--all",
                "--quiet",
                "--no-trunc",
                "--filter",
                `id=${id}`,
              ]),
              "",
            );
            assert.equal(
              checked([
                "ps",
                "--all",
                "--quiet",
                "--filter",
                `name=^/${name}$`,
              ]),
              "",
            );
            assert.equal(
              checked([
                "ps",
                "--all",
                "--quiet",
                "--filter",
                `label=${LABEL}=${RUN}`,
              ]),
              "",
            );
            entry.cleanupConfirmed = true;
          } else {
            allAbsent = false;
            throw new Error("container_identity_unconfirmed");
          }
        },
        () => stage,
      );
      Object.assign(entry, settlement);
      for (const name of planned)
        if (!entry.rows.some((row) => row.name === name))
          entry.rows.push({
            name,
            status: "Not Run",
            detail: "stopped_before_stimulus",
          });
      for (const name of unimplemented)
        entry.rows.push({
          name,
          status: "Not Run",
          detail: "not_implemented_in_this_bounded_probe",
        });
      if (
        entry.primaryFailure ||
        entry.cleanupFailure ||
        entry.hostPreserved !== true
      )
        break;
    }
  } catch {
    fixtureFailure = "fixture_or_preparation_failed";
  } finally {
    const cleanupConfirmed =
      allAbsent && report.every((entry) => entry.cleanupConfirmed);
    if (cleanupConfirmed) {
      try {
        removeFixture(ROOT);
      } catch {
        fixtureCleanupFailure = "fixture_cleanup_unconfirmed";
      }
    }
    console.log(
      JSON.stringify({
        contract: "crdd/workspace-write-boundary-probe",
        image: IMAGE,
        report,
        fixtureFailure,
        fixtureCleanupFailure,
        remainingCases: ["directory-case", "pointer-case"]
          .filter((kind) => !report.some((entry) => entry.case === kind))
          .map((kind) => ({
            case: kind,
            status: "Not Run",
            detail: "stopped_before_case",
          })),
        fixtureRemoved: !fs.existsSync(ROOT),
        fullDirectProtectionVerified: false,
      }),
    );
  }
  assert.equal(fixtureFailure, null);
  assert.equal(fixtureCleanupFailure, null);
  assert.equal(report.length, 2, "second case not reached");
  for (const entry of report) {
    assert.equal(entry.primaryFailure, null);
    assert.equal(entry.cleanupFailure, null);
    assert.equal(entry.hostPreserved, true);
    assert.equal(entry.cleanupConfirmed, true);
  }
});
