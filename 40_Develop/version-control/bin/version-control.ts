#!/usr/bin/env node
/**
 * フロントAI向けにGitユーザー設定の読取りだけを提供する。
 * @responsibility cwdの検証済みRepositoryから有限JSONを一回出力する。
 * @trace ARCH-000002
 * @boundary CLIとVC。Git変更・Principal生成・OS主体推測は行わない。
 */
import {
  getRepositoryFromWorkingDirectory,
  readGitUser,
  type GitUserResult,
} from "../src/index.ts";

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "read-git-user" || args[1] !== "--json") {
  process.stdout.write(
    `${JSON.stringify({ status: "blocked", reason: "version_control_arguments_invalid" })}\n`,
  );
  process.exitCode = 64;
} else {
  let result: GitUserResult;
  try {
    const repository = getRepositoryFromWorkingDirectory(process.cwd());
    result =
      repository.status === "completed"
        ? readGitUser(repository.capability)
        : { status: "blocked", reason: "repository_root_invalid" };
  } catch {
    result = { status: "blocked", reason: "repository_root_invalid" };
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === "completed" ? 0 : 2;
}
