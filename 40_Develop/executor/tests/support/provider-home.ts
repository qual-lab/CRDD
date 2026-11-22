/**
 * 単独検証入口の上位確定HomeをNode.jsで観測する。
 * @responsibility 本番と同じ資源キー・物理実体だけを観測し、ACL保証やNative成功を捏造しない。
 * @trace ERB-IT-004
 * @boundary 検証専用。Credential本文、子Process、Docker、Filesystem変更を扱わない。
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** 同一Homeの本番認証・Attemptと同じ共有Lockへ接続するための読取り。 */
export function observeProviderHome(provider: string, home: string) {
  const blocked = () => ({
    status: "blocked" as const,
    filesystemEffectIssued: false,
    processEffectIssued: false,
  });
  try {
    if (
      process.platform !== "win32" ||
      !["codex", "claude"].includes(provider) ||
      !path.win32.isAbsolute(home) ||
      path.win32.normalize(home) !== home
    )
      return blocked();
    const read = () => {
      const stat = fs.lstatSync(home, { bigint: true });
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        stat.dev <= 0n ||
        stat.ino <= 0n ||
        stat.birthtimeNs <= 0n ||
        fs.realpathSync.native(home).toLowerCase() !== home.toLowerCase()
      )
        throw Error("home_identity_unknown");
      return stat;
    };
    const first = read();
    const parent = path.win32.dirname(home);
    const binding = (kind: string) =>
      createHash("sha256")
        .update("crdd-provider-home-resource-v2\0")
        .update(kind)
        .update("\0")
        .update(path.win32.join(parent, kind).toLowerCase())
        .digest("hex");
    const known = new Set(
      ["codex", "claude"].map(
        (kind) => `executor.provider-home.${binding(kind)}.lock`,
      ),
    );
    if (
      fs
        .readdirSync(parent)
        .some(
          (name) =>
            name.toLowerCase().startsWith("executor.provider-home.") &&
            !known.has(name.toLowerCase()),
        )
    )
      return blocked();
    const second = read();
    if (
      first.dev !== second.dev ||
      first.ino !== second.ino ||
      first.birthtimeNs !== second.birthtimeNs
    )
      return blocked();
    return {
      status: "candidate" as const,
      provider: provider as "codex" | "claude",
      providerHomeIdentityHash: createHash("sha256")
        .update("crdd-provider-home-node-identity-v1\0")
        .update(provider)
        .update("\0")
        .update(String(first.dev))
        .update("\0")
        .update(String(first.ino))
        .update("\0")
        .update(String(first.birthtimeNs))
        .digest("hex"),
      stableLogicalHomeBindingHash: binding(provider),
      filesystemEffectIssued: false,
      processEffectIssued: false,
    };
  } catch {
    return blocked();
  }
}
