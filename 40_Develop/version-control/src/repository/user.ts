/**
 * 対象Repositoryで有効なGitユーザー設定を読み取る。
 * @responsibility user.name/emailだけを取得し、未設定と取得不能を区別する。
 * @trace ARCH-000002
 * @boundary Git設定と利用側。Principal生成・本人認証は行わない。
 */
import { executeGit } from "../git/execute.ts";
import { observeVerifiedRepositoryLayout } from "./location.ts";
import type { GitUserResult, Repository } from "./types.ts";

/** 既存Root検査が許すGit実効設定を取得する。global側includeは読み、Author環境値や履歴へfallbackしない。 */
export function readGitUser(repository: Repository): GitUserResult {
  const initial = observeVerifiedRepositoryLayout(repository);
  if (!initial) return { status: "blocked", reason: "repository_root_invalid" };
  try {
    const result = executeGit(
      initial.root,
      [
        "config",
        "--includes",
        "--null",
        "--get-regexp",
        "^user\\.(name|email)$",
      ],
      {
        configuration: "repository",
        gitDirectory: initial.layout.gitDirectory.realPath,
        maxBuffer: 8192,
      },
    );
    if (
      result.error ||
      result.signal ||
      (result.status !== 0 && result.status !== 1)
    )
      return {
        status: "unknown",
        reason: "git_user_configuration_unavailable",
      };
    if (result.status === 1 && result.stdout.length !== 0)
      return {
        status: "unknown",
        reason: "git_user_configuration_unavailable",
      };
    const source = new TextDecoder("utf-8", { fatal: true }).decode(
      result.stdout,
    );
    let name: string | null = null,
      email: string | null = null;
    if (source) {
      if (!source.endsWith("\0")) throw Error("configuration_incomplete");
      for (const entry of source.slice(0, -1).split("\0")) {
        const separator = entry.indexOf("\n");
        const key = entry.slice(0, separator).toLowerCase();
        const value = entry.slice(separator + 1);
        if (separator < 0 || /[\u0000-\u001f\u007f]/u.test(value))
          throw Error("configuration_invalid");
        if (key === "user.name") name = value || null;
        else if (key === "user.email") email = value || null;
        else throw Error("configuration_key_invalid");
      }
    }
    const final = observeVerifiedRepositoryLayout(repository);
    if (
      !final ||
      final.root !== initial.root ||
      final.layout.gitDirectory.realPath !==
        initial.layout.gitDirectory.realPath
    )
      return { status: "blocked", reason: "repository_root_invalid" };
    return { status: "completed", name, email };
  } catch {
    return { status: "unknown", reason: "git_user_configuration_unavailable" };
  }
}
