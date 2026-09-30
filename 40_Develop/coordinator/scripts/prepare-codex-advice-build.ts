/**
 * 助言専用CLIのBuild入力をRepository-local一時領域へ固定する。
 *
 * @responsibility 検証した公開Sourceと起動制限PatchだけからBuild Contextを構成する。
 * @trace ARCH-000004
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureRepositoryRuntimeDataArea,
  requireReadyRepositoryRuntimeDataArea,
} from "../../runtime-data/src/index.ts";
import { verifyRepositoryRoot } from "../../version-control/src/repository-location.ts";

/**
 * 固定SourceとPatchを検証し、秘密値を含まない専用Build Contextを作成する。
 *
 * @responsibility 入力Identity、出力範囲、保持状態と未実施のBuildを区別する。
 * @trace ARCH-000004
 * @input N/A: Script位置から同じRepository Rootと固定入力Pathだけを解決する。
 * @returns 作成したContextのPath、固定IdentityとBuild未実施の結果。
 * @precondition 固定Source ArchiveがRepository-local一時領域に取得済みである。
 * @postcondition Contextには固定Archive、起動Patch、試験Patchと照合表、公式Host、試験linker、Dockerfile、入力Manifestだけが存在する。
 * @effect 検証済みRepository Root直下の.crdd/tmpに新しい一時Directoryを作成する。
 * @failure Root、実体Path、File種別、SizeまたはHashが不正なら停止する。
 * @invariant Runtime配布物、採用済みProfile、既存Contextを変更しない。
 * @boundary Host Filesystemと開発用Build入力の境界。
 * @security Repository本文、Provider Homeおよび認証情報をContextへ含めない。
 * @concurrency 新しいDirectoryを排他的に作成し、既存Buildの入力を上書きしない。
 */
export function prepareCodexAdviceBuild() {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../..",
  );
  const verified = verifyRepositoryRoot(root);
  if (verified.status !== "completed") throw new Error(verified.reason);
  const temporary = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataArea(verified.capability, "tmp"),
    "codex_advice_build_root_invalid",
  );
  const inputs = [
    {
      name: "official-source.tar.gz",
      source: path.join(
        temporary.directory,
        "codex-01592-migration/official-source.tar.gz",
      ),
      expected:
        "b749fadee5cc236dff4cd0fc076cc4e08840937529ea71bca2928e233755712a",
    },
    {
      name: "codex-advice-startup.patch",
      source: path.join(
        root,
        "40_Develop/coordinator/runtime/codex-advice-startup.patch",
      ),
      expected:
        "1fbd4d98e20e2a4a7c106f7f417129e061297fba65b7ef521969e40ef847faeb",
    },
    {
      name: "codex-advice-startup-test.patch",
      source: path.join(
        root,
        "40_Develop/coordinator/runtime/codex-advice-startup-test.patch",
      ),
      expected:
        "03e916f0371b80cf4f7038b54f3b81356218d277acc506dd3f473a4acc15cc31",
    },
    {
      name: "codex-advice-startup-test-inputs.sha256",
      source: path.join(
        root,
        "40_Develop/coordinator/runtime/codex-advice-startup-test-inputs.sha256",
      ),
      expected:
        "f812775b4254a47376adcc99491c7752869daed403df39d7b998ae95cdf51b80",
    },
    {
      name: "codex-code-mode-host",
      source: path.join(
        temporary.directory,
        "codex-01592-attestation/codex-code-mode-host-x86_64-unknown-linux-musl",
      ),
      expected:
        "5b2c075ac2380fa04d76d7313fbc044d29c8d0a0d0b9138415acd4610211ca03",
      exactSize: 74_068_880,
    },
    {
      name: "codex-advice-native-linker.sh",
      source: path.join(
        root,
        "40_Develop/coordinator/runtime/codex-advice-native-linker.sh",
      ),
      expected: null,
    },
    {
      name: "Dockerfile",
      source: path.join(
        root,
        "40_Develop/coordinator/runtime/codex-advice-builder.Dockerfile",
      ),
      expected: null,
    },
  ].map((input) => {
    const metadata = fs.lstatSync(input.source);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      ("exactSize" in input
        ? metadata.size !== input.exactSize
        : metadata.size > 32 * 1024 * 1024)
    )
      throw new Error("codex_advice_build_input_invalid");
    if (fs.realpathSync.native(input.source) !== path.resolve(input.source))
      throw new Error("codex_advice_build_input_redirected");
    const original = fs.readFileSync(input.source);
    const bytes =
      input.name.endsWith(".patch") ||
      input.name.endsWith(".sh") ||
      input.name.endsWith(".sha256") ||
      input.name === "Dockerfile"
        ? Buffer.from(original.toString("utf8").replaceAll("\r\n", "\n"))
        : original;
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (input.expected !== null && sha256 !== input.expected)
      throw new Error("codex_advice_build_input_hash_mismatch");
    return { name: input.name, bytes, sha256 };
  });
  const context = fs.mkdtempSync(
    path.join(temporary.directory, "codex-advice-build-"),
  );
  for (const input of inputs)
    fs.writeFileSync(path.join(context, input.name), input.bytes, {
      flag: "wx",
    });
  const manifest = {
    contract: "crdd-coordinator/codex-advice-build-inputs",
    contractRevision: 1,
    sourceCommit: "ff6aec96948b70d94983af2641a6b67c94faeff5",
    builderImage:
      "rust@sha256:4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb",
    target: "x86_64-unknown-linux-musl",
    rustFinalLinker: {
      upstream: "/usr/bin/x86_64-linux-musl-gcc",
      effective: "/usr/bin/gcc",
      nativeDependencyToolchainChanged: false,
      requiredArtifactProperties: [
        "ELF64-x86_64",
        "static-PIE",
        "no-PT_INTERP",
        "no-DT_NEEDED",
        "non-executable-stack",
        "Rust-musl-CRT-and-libc-link-map",
        "bounded-version-startup",
      ],
    },
    zig: {
      version: "0.14.0",
      archiveSha256:
        "473ec26806133cf4d1918caf1a410f8403a13d979726a9045b421b685031a982",
    },
    inputs: inputs.map(({ name, sha256 }) => ({ name, sha256 })),
    buildExecuted: false,
    providerEffectIssued: false,
    runtimeAdopted: false,
    repositoryMounted: false,
    retainedForBuild: true,
    retentionOwner: "coordinator-maintainer",
    retentionDeadline: new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    cleanupCondition:
      "exact-context; no-active-build; no-unresolved-artifact-reference; absence-observed",
    automaticDeletionAllowed: false,
    sharedDockerCacheCleanupOwned: false,
  };
  fs.writeFileSync(
    path.join(context, "build-inputs.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: "wx" },
  );
  return { ...manifest, context };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  process.stdout.write(`${JSON.stringify(prepareCodexAdviceBuild())}\n`);
