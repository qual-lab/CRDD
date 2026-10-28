/**
 * 単独実試験前のProvider Home観測・共有排他だけを明示確認する。
 * @packageDocumentation
 * @responsibility 既存Native観測とNamed Pipeを接続し、認証内容・AI・Dockerを使わず終了を確認する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @boundary 試験専用。通常importと非AI単段検証からは実行しない。
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  observeWindowsProviderHome,
  acquireNamedPipeKernelLockOutcome,
} from "../../platform-access/src/index.ts";
import {
  writeCommittedJson,
  readCommittedJson,
  removeCommittedJson,
} from "../../domain-model/src/index.ts";

/**
 * 既存共有Home排他と同じPipe名を試験側で導出する。
 * @responsibility 製品の既存排他と衝突する同一Identityを使用する。
 * @trace ERB-IT-004
 * @input 検証済み64hexの安定Home Hash。
 * @returns 固定ProviderHome用途のPipe名。
 * @precondition Nativeで検証済みの安定Home Hashを渡す。
 * @postcondition 既存ProviderHome排他と同じ名前だけを返す。
 * @effect N/A: 純粋なHash計算のみ。
 * @failure 不正Hashを取得前に拒否する。
 * @invariant 名前から認証・実行Authorityを生成しない。
 * @boundary 既存の排他名契約。Source Oracleで製品側との一致を検査する。
 * @security 名前をcheckpoint又は公開結果へ保存しない。
 * @concurrency N/A: 同期の局所計算だけ。
 */
function homePipeName(hash: string) {
  if (!/^[0-9a-f]{64}$/u.test(hash)) throw new Error("home_hash_invalid");
  const identity = createHash("sha256")
    .update("crdd-logical-provider-home-kernel-lock-v1\0")
    .update(hash)
    .digest("hex")
    .slice(0, 32);
  return `\\\\.\\pipe\\CRDD.Coordinator.ProviderHome.${identity}`;
}

/**
 * 一Providerの固定Homeを観測し、既存排他内で再観測して解放する。
 * @responsibility 試験checkpointと元Lockの終了を確認し、不明はRootを保持する。
 * @trace ERB-IT-002
 * @trace ERB-IT-004
 * @input provider: exact二値の一つ。runId: 承認範囲を識別する非秘密試験ID。
 * @returns 観測一致、終了・清掃とexact試験Root。認証成立・実行許可は返さない。
 * @precondition 実Home観測・共有排他の一回取得が別途許可されている。
 * @postcondition 正常時は元Lock解放と自己生成Root不存在を確認する。
 * @effect Native metadata観測二回以下、Named Pipe取得一回以下、試験checkpoint保存。
 * @failure 観測不能・差替え・保存拒否・解放不明で停止し、再試行しない。
 * @invariant Credential本文、SID、ACL、Home Path、四Hashを保存・表示しない。
 * @boundary 既存Platform Accessと試験専用Filesystem。実AI・Dockerには接続しない。
 * @security Home作成・修復・ACL変更を行わない。認証成功を推定しない。
 * @concurrency 取得後は例外時も同じLockを一回だけ解放し、未確認を成功にしない。
 */
export async function verifyProviderHomeBoundary(
  provider: unknown,
  runId: unknown,
) {
  if (
    (provider !== "codex" && provider !== "claude") ||
    typeof runId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9-]{7,63}$/u.test(runId)
  )
    throw new Error("home_boundary_input_invalid");
  const local = process.env.LOCALAPPDATA;
  if (
    !local ||
    !path.win32.isAbsolute(local) ||
    path.win32.normalize(local) !== local
  )
    throw new Error("home_boundary_environment_invalid");
  const home = path.win32.join(
    local,
    "Qual-Lab",
    "CRDD",
    "ProviderHomes",
    provider,
  );
  const repository = fs.realpathSync(
    fileURLToPath(new URL("../../../", import.meta.url)),
  );
  const git = spawnSync(
    "git",
    [
      "-C",
      fileURLToPath(new URL("./", import.meta.url)),
      "rev-parse",
      "--show-toplevel",
    ],
    { encoding: "utf8", timeout: 15_000, windowsHide: true },
  );
  if (
    git.error ||
    git.signal !== null ||
    git.status !== 0 ||
    fs.realpathSync(git.stdout.trim()).toLowerCase() !==
      repository.toLowerCase()
  )
    throw new Error("home_boundary_repository_invalid");
  const parent = path.join(repository, ".crdd", "tests");
  for (const directory of [path.dirname(parent), parent]) {
    if (!fs.existsSync(directory)) fs.mkdirSync(directory);
    if (
      fs.lstatSync(directory).isSymbolicLink() ||
      fs.realpathSync(directory).toLowerCase() !== directory.toLowerCase()
    )
      throw new Error("home_boundary_parent_invalid");
  }
  const root = path.join(parent, `executor-home-${provider}-${runId}`);
  fs.mkdirSync(root); // Existing Roots are never reused or removed.
  const identity = fs.statSync(root, { bigint: true });
  const names: string[] = [];
  let primaryReason: string | null = null;
  let observationMatched = false;
  let nativeCleanupConfirmed = true;
  let leaseCleanupConfirmed = true;
  let fixtureCleanupConfirmed = false;
  let lock: Awaited<
    ReturnType<typeof acquireNamedPipeKernelLockOutcome>
  >["lock"] = null;
  /**
   * 非秘密の試験段階だけを既存確定JSONで保存・読戻しする。
   * @responsibility 本番Runtime stateやHome metadataを複製しない。
   * @trace ERB-IT-002
   * @input name: 固定段階。matched: 観測一致の結果。
   * @returns N/A。
   * @effect 今回Rootの試験JSONだけを書いて同一性を読み戻す。
   * @failure 拒否は外側へ伝播し、成功値を補完しない。
   * @boundary 試験記録だけ。本番Host保存の成立ではない。
   */
  function checkpoint(name: string, matched: boolean) {
    const value = {
      contract: "crdd/executor/home-boundary-test/v1",
      provider,
      runId,
      phase: name,
      observationMatched: matched,
      reviewAfter: new Date(Date.now() + 7 * 86400_000).toISOString(),
    };
    names.push(name);
    const written = writeCommittedJson(root, `${name}.json`, name, value);
    const read = readCommittedJson(written.target, name);
    if (
      read.hash !== written.hash ||
      read.identityText !== written.identityText ||
      JSON.stringify(read.value) !== JSON.stringify(value)
    )
      throw new Error("home_boundary_checkpoint_mismatch");
  }
  /**
   * Nativeの検証済み候補と明示的な終了・非書込みだけを受理する。
   * @responsibility 観測不能や補助子終了不明を候補へ昇格しない。
   * @trace ERB-IT-002
   * @input 元Platform Access観測。
   * @returns 現Provider・補助子終了・Artifact確認・Filesystem Effect零の共同判定。
   * @effect N/A: 元値の照合だけ。
   * @failure 不足・別Provider・未確認はfalse。
   * @boundary Native metadataと試験の前提確認。
   */
  const valid = (value: ReturnType<typeof observeWindowsProviderHome>) =>
    value.status === "candidate" &&
    value.provider === provider &&
    value.processEffectIssued === true &&
    value.helperExitConfirmed === true &&
    value.artifactVerifiedBeforeAndAfter === true &&
    value.filesystemEffectIssued === false;
  try {
    checkpoint("started", false);
    nativeCleanupConfirmed = false;
    const first = observeWindowsProviderHome(provider, home);
    nativeCleanupConfirmed =
      (!first.processEffectIssued || first.helperExitConfirmed) &&
      first.filesystemEffectIssued === false;
    if (!valid(first) || first.status !== "candidate") {
      primaryReason = "home_observation_unconfirmed";
    } else {
      leaseCleanupConfirmed = false;
      const acquired = await acquireNamedPipeKernelLockOutcome(
        homePipeName(first.stableLogicalHomeBindingHash),
      );
      if (acquired.status !== "acquired" || !acquired.lock) {
        leaseCleanupConfirmed =
          acquired.status === "unavailable" && acquired.lock === null;
        primaryReason = leaseCleanupConfirmed
          ? "home_lock_unavailable"
          : "home_lock_cleanup_unknown";
      } else {
        lock = acquired.lock;
        try {
          nativeCleanupConfirmed = false;
          const second = observeWindowsProviderHome(provider, home);
          nativeCleanupConfirmed =
            (!second.processEffectIssued || second.helperExitConfirmed) &&
            second.filesystemEffectIssued === false;
          observationMatched =
            valid(second) &&
            second.status === "candidate" &&
            first.providerHomeIdentityHash ===
              second.providerHomeIdentityHash &&
            first.providerHomeProtectionHash ===
              second.providerHomeProtectionHash &&
            first.localUserBindingHash === second.localUserBindingHash &&
            first.stableLogicalHomeBindingHash ===
              second.stableLogicalHomeBindingHash;
          if (!observationMatched)
            primaryReason = "home_changed_or_unconfirmed";
          checkpoint("observed", observationMatched);
        } finally {
          const current = lock;
          lock = null;
          try {
            leaseCleanupConfirmed = (await current.release()) === "released";
          } catch {
            leaseCleanupConfirmed = false;
          }
        }
      }
    }
  } catch {
    primaryReason ??= "home_boundary_operation_failed";
  }
  const resourceCleanupConfirmed =
    nativeCleanupConfirmed && leaseCleanupConfirmed;
  if (resourceCleanupConfirmed) {
    try {
      const current = fs.statSync(root, { bigint: true });
      if (
        fs.lstatSync(root).isSymbolicLink() ||
        current.dev !== identity.dev ||
        current.ino !== identity.ino ||
        current.birthtimeNs !== identity.birthtimeNs
      )
        throw new Error("home_boundary_root_changed");
      const allowed = new Set(
        names.flatMap((name) => [
          `${name}.json`,
          `${name}.json.crdd-commit.json`,
        ]),
      );
      for (const name of fs.readdirSync(root)) {
        const file = path.join(root, name),
          stat = fs.lstatSync(file);
        if (
          !allowed.has(name) ||
          !stat.isFile() ||
          stat.isSymbolicLink() ||
          stat.nlink !== 1
        )
          throw new Error("home_boundary_contents_changed");
      }
      for (const name of names)
        removeCommittedJson(path.join(root, `${name}.json`), name);
      fs.rmdirSync(root);
      fixtureCleanupConfirmed = !fs.existsSync(root);
    } catch {
      fixtureCleanupConfirmed = false;
    }
  }
  return Object.freeze({
    status:
      primaryReason === null &&
      observationMatched &&
      resourceCleanupConfirmed &&
      fixtureCleanupConfirmed
        ? ("observed" as const)
        : ("blocked" as const),
    reason:
      primaryReason ??
      (!resourceCleanupConfirmed
        ? "home_resource_cleanup_unknown"
        : !fixtureCleanupConfirmed
          ? "home_fixture_cleanup_unknown"
          : null),
    provider,
    runId,
    observationMatched,
    resourceCleanupConfirmed,
    fixtureCleanupConfirmed,
    fixtureRoot: fixtureCleanupConfirmed ? null : root,
    authenticationChecked: false,
    aiIssued: false,
    dockerIssued: false,
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.length !== 4)
    throw new Error("usage: verify-provider-home.ts <codex|claude> <run-id>");
  const result = await verifyProviderHomeBoundary(
    process.argv[2],
    process.argv[3],
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === "observed" ? 0 : 2;
}
