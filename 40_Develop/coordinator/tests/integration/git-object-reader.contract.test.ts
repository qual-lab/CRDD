/**
 * coordinator:integration:git-object-reader-contractの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:git-object-reader-contractが所有する検証責務を実行する。
 * @trace RFD-IT-012
 * @level IT
 * @scope git、object、reader
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { deflateSync } from "node:zlib";

import {
  describeGitObjectReaderContract,
  inspectGitCommitTreeCandidate,
  materializeGitCommitTreeCandidate as materializeVersionControlTree,
  readGitCommitFileCandidate,
} from "../../../version-control/src/git/object-reader.ts";
import { containsRecognizedSecretMaterial } from "../../src/security/secret-material-policy.ts";

/**
 * materializeGitCommitTreeCandidateのTest準備責務を実行する。
 *
 * @responsibility materializeGitCommitTreeCandidateがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus materializeGitCommitTreeCandidateを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
function materializeGitCommitTreeCandidate(candidate: unknown) {
  return materializeVersionControlTree(
    candidate,
    containsRecognizedSecretMaterial,
  );
}

/**
 * temporaryFixtureのTest準備責務を実行する。
 *
 * @responsibility temporaryFixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus temporaryFixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
function temporaryFixture(t: test.TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-git-reader-"));
  const commonDirectory = path.join(root, ".git");
  const workspace = path.join(root, "workspace");
  fs.mkdirSync(path.join(commonDirectory, "objects", "pack"), {
    recursive: true,
  });
  fs.mkdirSync(workspace);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return Object.freeze({ commonDirectory, workspace });
}

/**
 * writeObjectのTest準備責務を実行する。
 *
 * @responsibility writeObjectがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus writeObjectを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
function writeObject(commonDirectory: string, type: string, bytes: Buffer) {
  const framed = Buffer.concat([
    Buffer.from(`${type} ${bytes.byteLength}\0`),
    bytes,
  ]);
  const objectId = createHash("sha1").update(framed).digest("hex");
  const target = path.join(
    commonDirectory,
    "objects",
    objectId.slice(0, 2),
    objectId.slice(2),
  );
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, deflateSync(framed));
  return objectId;
}

/**
 * treeEntryのTest準備責務を実行する。
 *
 * @responsibility treeEntryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus treeEntryを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
function treeEntry(mode: string, name: string, objectId: string) {
  return Buffer.concat([
    Buffer.from(`${mode} ${name}\0`),
    Buffer.from(objectId, "hex"),
  ]);
}

/**
 * Commit treeはheader先頭だけを採用し本文、欠落、重複と非Tree参照を拒否するを検証する。
 *
 * @responsibility Commit treeはheader先頭だけを採用し本文、欠落、重複と非Tree参照を拒否するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Commit treeはheader先頭だけを採用し本文、欠落、重複と非Tree参照を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
test("Commit treeはheader先頭だけを採用し本文、欠落、重複と非Tree参照を拒否する", (t) => {
  const fixture = temporaryFixture(t);
  const treeId = writeObject(fixture.commonDirectory, "tree", Buffer.alloc(0));
  const otherTreeId = writeObject(
    fixture.commonDirectory,
    "tree",
    treeEntry(
      "100644",
      "fixture.txt",
      writeObject(fixture.commonDirectory, "blob", Buffer.from("fixture\n")),
    ),
  );
  const blobId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from("not a tree\n"),
  );
  /**
   * inspectのTest準備責務を実行する。
   *
   * @responsibility inspectがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace RFD-IT-012
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus inspectを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
   */
  const inspect = (commitBytes: string) =>
    inspectGitCommitTreeCandidate({
      commonDirectory: fixture.commonDirectory,
      revision: writeObject(
        fixture.commonDirectory,
        "commit",
        Buffer.from(commitBytes),
      ),
    });

  assert.equal(
    inspect(
      `author A <a@example.test> 0 +0000\ncommitter A <a@example.test> 0 +0000\n\nmessage\ntree ${treeId}\n`,
    ),
    null,
  );
  assert.equal(
    inspect(`tree ${treeId}\nauthor A <a@example.test> 0 +0000`),
    null,
  );
  assert.equal(
    inspect(`tree ${treeId}\ntree ${otherTreeId}\n\nmessage\n`),
    null,
  );
  assert.equal(inspect(`tree ${blobId}\n\nmessage\n`), null);

  const valid = inspect(
    `tree ${treeId}\nauthor A <a@example.test> 0 +0000\ncommitter A <a@example.test> 0 +0000\n\nmessage\ntree ${otherTreeId}\n`,
  );
  assert.equal(valid?.status, "candidate");
  assert.equal(valid?.tree, treeId);
});

/**
 * loose Commit／Tree／BlobをGit CLIなしで隔離workspaceへ再構成するを検証する。
 *
 * @responsibility loose Commit／Tree／BlobをGit CLIなしで隔離workspaceへ再構成するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus loose Commit／Tree／BlobをGit CLIなしで隔離workspaceへ再構成するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
test("loose Commit／Tree／BlobをGit CLIなしで隔離workspaceへ再構成する", (t) => {
  const fixture = temporaryFixture(t);
  const readmeId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from("hello\n"),
  );
  const sourceId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from("export const value = 1;\n"),
  );
  const sourceTreeId = writeObject(
    fixture.commonDirectory,
    "tree",
    treeEntry("100644", "index.ts", sourceId),
  );
  const rootTreeId = writeObject(
    fixture.commonDirectory,
    "tree",
    Buffer.concat([
      treeEntry("100644", "README.md", readmeId),
      treeEntry("40000", "src", sourceTreeId),
    ]),
  );
  const commitId = writeObject(
    fixture.commonDirectory,
    "commit",
    Buffer.from(
      `tree ${rootTreeId}\nauthor A <a@example.test> 0 +0000\ncommitter A <a@example.test> 0 +0000\n\nfixture\n`,
    ),
  );

  const result = materializeGitCommitTreeCandidate({
    commonDirectory: fixture.commonDirectory,
    revision: commitId,
    workspace: fixture.workspace,
  });
  assert.equal(result?.status, "materialized");
  assert.equal(result?.baseCommit, commitId);
  assert.equal(result?.baseTree, rootTreeId);
  assert.equal(result?.fileCount, 2);
  assert.equal(result?.byteLength, 30);
  assert.equal(
    fs.readFileSync(path.join(fixture.workspace, "README.md"), "utf8"),
    "hello\n",
  );
  assert.equal(
    fs.readFileSync(path.join(fixture.workspace, "src", "index.ts"), "utf8"),
    "export const value = 1;\n",
  );
  assert.equal(result?.repositoryPathReported, false);
  assert.equal(result?.workspacePathReported, false);
  const fixedFile = readGitCommitFileCandidate({
    commonDirectory: fixture.commonDirectory,
    revision: commitId,
    relativePath: "README.md",
  });
  assert.equal(fixedFile?.status, "read");
  assert.equal(fixedFile?.bytes.toString("utf8"), "hello\n");
  assert.equal(
    readGitCommitFileCandidate({
      commonDirectory: fixture.commonDirectory,
      revision: commitId,
      relativePath: "missing.md",
    }),
    null,
  );
});

/**
 * 明示Read Projectionだけを隔離workspaceへ再構成するを検証する。
 *
 * @responsibility 明示Read Projectionだけを隔離workspaceへ再構成するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 明示Read Projectionだけを隔離workspaceへ再構成するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
test("明示Read Projectionだけを隔離workspaceへ再構成する", (t) => {
  const fixture = temporaryFixture(t);
  const visibleId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from("visible\n"),
  );
  const hiddenId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from("hidden\n"),
  );
  const sourceTreeId = writeObject(
    fixture.commonDirectory,
    "tree",
    Buffer.concat([
      treeEntry("100644", "visible.ts", visibleId),
      treeEntry("100644", "hidden.ts", hiddenId),
    ]),
  );
  const rootTreeId = writeObject(
    fixture.commonDirectory,
    "tree",
    treeEntry("40000", "src", sourceTreeId),
  );
  const commitId = writeObject(
    fixture.commonDirectory,
    "commit",
    Buffer.from(`tree ${rootTreeId}\n\nfixture\n`),
  );

  const result = materializeGitCommitTreeCandidate({
    commonDirectory: fixture.commonDirectory,
    revision: commitId,
    workspace: fixture.workspace,
    readPaths: ["src/visible.ts"],
  });
  assert.equal(result?.status, "materialized");
  assert.equal(result?.fileCount, 1);
  assert.equal(
    fs.readFileSync(path.join(fixture.workspace, "src", "visible.ts"), "utf8"),
    "visible\n",
  );
  assert.equal(
    fs.existsSync(path.join(fixture.workspace, "src", "hidden.ts")),
    false,
  );

  const exactDirectoryWorkspace = path.join(
    path.dirname(fixture.workspace),
    "exact-directory",
  );
  fs.mkdirSync(exactDirectoryWorkspace);
  const exactDirectory = materializeGitCommitTreeCandidate({
    commonDirectory: fixture.commonDirectory,
    revision: commitId,
    workspace: exactDirectoryWorkspace,
    readPaths: ["src"],
  });
  assert.equal(exactDirectory?.status, "materialized");
  assert.equal(exactDirectory?.fileCount, 0);
  assert.deepEqual(fs.readdirSync(exactDirectoryWorkspace), []);
});

/**
 * 未選択の未対応modeだけを除外し、exact・祖先選択と全体展開は拒否するを検証する。
 *
 * @responsibility 未選択の未対応modeだけを除外し、exact・祖先選択と全体展開は拒否するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 未選択の未対応modeだけを除外し、exact・祖先選択と全体展開は拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
test("未選択の未対応modeだけを除外し、exact・祖先選択と全体展開は拒否する", (t) => {
  for (const mode of ["120000", "160000", "100664"] as const) {
    const fixture = temporaryFixture(t);
    const policyBytes = Buffer.from('{"policyId":"fixture"}\n');
    const policyId = writeObject(fixture.commonDirectory, "blob", policyBytes);
    const configTreeId = writeObject(
      fixture.commonDirectory,
      "tree",
      treeEntry("100644", "external-send-policy.json", policyId),
    );
    const policyTreeId = writeObject(
      fixture.commonDirectory,
      "tree",
      treeEntry("40000", "config", configTreeId),
    );
    const unsupportedObjectId =
      mode === "160000"
        ? writeObject(
            fixture.commonDirectory,
            "commit",
            Buffer.from(
              "tree 0000000000000000000000000000000000000000\n\nsubmodule\n",
            ),
          )
        : writeObject(
            fixture.commonDirectory,
            "blob",
            Buffer.from("unsupported\n"),
          );
    const rootTreeId = writeObject(
      fixture.commonDirectory,
      "tree",
      Buffer.concat([
        treeEntry("40000", ".crdd", policyTreeId),
        treeEntry(mode, "unsupported", unsupportedObjectId),
      ]),
    );
    const commitId = writeObject(
      fixture.commonDirectory,
      "commit",
      Buffer.from(`tree ${rootTreeId}\n\nfixture\n`),
    );

    const fixedFile = readGitCommitFileCandidate({
      commonDirectory: fixture.commonDirectory,
      revision: commitId,
      relativePath: ".crdd/config/external-send-policy.json",
    });
    assert.equal(fixedFile?.status, "read");
    assert.deepEqual(fixedFile?.bytes, policyBytes);

    for (const relativePath of ["unsupported", "unsupported/child.txt"]) {
      assert.equal(
        readGitCommitFileCandidate({
          commonDirectory: fixture.commonDirectory,
          revision: commitId,
          relativePath,
        }),
        null,
      );
      const selectedWorkspace = path.join(
        path.dirname(fixture.workspace),
        `${mode}-${relativePath.includes("/") ? "descendant" : "exact"}`,
      );
      fs.mkdirSync(selectedWorkspace);
      assert.equal(
        materializeGitCommitTreeCandidate({
          commonDirectory: fixture.commonDirectory,
          revision: commitId,
          workspace: selectedWorkspace,
          readPaths: [relativePath],
        }),
        null,
      );
      assert.deepEqual(fs.readdirSync(selectedWorkspace), []);
    }

    const fullWorkspace = path.join(
      path.dirname(fixture.workspace),
      `${mode}-full`,
    );
    fs.mkdirSync(fullWorkspace);
    assert.equal(
      materializeGitCommitTreeCandidate({
        commonDirectory: fixture.commonDirectory,
        revision: commitId,
        workspace: fullWorkspace,
      }),
      null,
    );
  }
});

/**
 * 認識済みSecretを含むPathまたは内容はworkspaceへ書く前に拒否するを検証する。
 *
 * @responsibility 認識済みSecretを含むPathまたは内容はworkspaceへ書く前に拒否するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 認識済みSecretを含むPathまたは内容はworkspaceへ書く前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
test("認識済みSecretを含むPathまたは内容はworkspaceへ書く前に拒否する", (t) => {
  for (const scenario of ["path", "content"] as const) {
    const fixture = temporaryFixture(t);
    const blobId = writeObject(
      fixture.commonDirectory,
      "blob",
      Buffer.from(
        scenario === "content"
          ? `OPENAI_API_KEY=sk-${"A".repeat(24)}\n`
          : "ordinary value\n",
      ),
    );
    const fileName = scenario === "path" ? ".env" : "source.ts";
    const treeId = writeObject(
      fixture.commonDirectory,
      "tree",
      treeEntry("100644", fileName, blobId),
    );
    const commitId = writeObject(
      fixture.commonDirectory,
      "commit",
      Buffer.from(`tree ${treeId}\n\nfixture\n`),
    );
    const materialized = materializeGitCommitTreeCandidate({
      commonDirectory: fixture.commonDirectory,
      revision: commitId,
      workspace: fixture.workspace,
      readPaths: [fileName],
    });
    assert.equal(materialized?.status, "blocked");
    assert.equal(
      materialized?.status === "blocked" ? materialized.reason : null,
      "git_read_projection_recognized_secret_rejected",
    );
    assert.deepEqual(fs.readdirSync(fixture.workspace), []);
    const localRead = readGitCommitFileCandidate({
      commonDirectory: fixture.commonDirectory,
      revision: commitId,
      relativePath: fileName,
    });
    assert.equal(localRead?.status, "read");
  }
});

/**
 * Secret名を使う通常のSource参照はRead Projectionを誤停止しないを検証する。
 *
 * @responsibility Secret名を使う通常のSource参照はRead Projectionを誤停止しないの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Secret名を使う通常のSource参照はRead Projectionを誤停止しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
test("Secret名を使う通常のSource参照はRead Projectionを誤停止しない", (t) => {
  const fixture = temporaryFixture(t);
  const source = [
    "const password = options.password;",
    'const apiKey = process.env["API_KEY"];',
    'const sessionToken = os.environ["SESSION_TOKEN"];',
    "this.password = request.password;",
    "password=resolvedDatabasePassword;",
    "apiKey=applicationConfigurationKey;",
    "password = options!.password;",
    'password = options!.config?.["password"]!;',
    "const accessToken = oauth2Token;",
    "accessToken=resolvedOAuth2Token;",
    "password=resolvedPassword2;",
  ].join("\n");
  const blobId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from(`${source}\n`),
  );
  const commonJsSource =
    "const accessToken = oauth2Token;\naccessToken=resolvedOAuth2Token;\n";
  const commonJsBlobId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from(commonJsSource),
  );
  const treeId = writeObject(
    fixture.commonDirectory,
    "tree",
    Buffer.concat([
      treeEntry("100644", "oauth.cjs", commonJsBlobId),
      treeEntry("100644", "source.ts", blobId),
    ]),
  );
  const commitId = writeObject(
    fixture.commonDirectory,
    "commit",
    Buffer.from(`tree ${treeId}\n\nfixture\n`),
  );
  const materialized = materializeGitCommitTreeCandidate({
    commonDirectory: fixture.commonDirectory,
    revision: commitId,
    workspace: fixture.workspace,
    readPaths: ["oauth.cjs", "source.ts"],
  });
  assert.equal(materialized?.status, "materialized");
  assert.equal(
    fs.readFileSync(path.join(fixture.workspace, "source.ts"), "utf8"),
    `${source}\n`,
  );
  assert.equal(
    fs.readFileSync(path.join(fixture.workspace, "oauth.cjs"), "utf8"),
    commonJsSource,
  );
});

/**
 * 公開env例のplaceholderはRead Projectionを誤停止しないを検証する。
 *
 * @responsibility 公開env例のplaceholderはRead Projectionを誤停止しないの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開env例のplaceholderはRead Projectionを誤停止しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
test("公開env例のplaceholderはRead Projectionを誤停止しない", (t) => {
  const fixture = temporaryFixture(t);
  const source = `SESSION_TOKEN=placeholder_long_value\nSESSION_TOKEN=${"x".repeat(20)}\n`;
  const blobId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from(source),
  );
  const treeId = writeObject(
    fixture.commonDirectory,
    "tree",
    treeEntry("100644", ".env.example", blobId),
  );
  const commitId = writeObject(
    fixture.commonDirectory,
    "commit",
    Buffer.from(`tree ${treeId}\n\nfixture\n`),
  );
  const materialized = materializeGitCommitTreeCandidate({
    commonDirectory: fixture.commonDirectory,
    revision: commitId,
    workspace: fixture.workspace,
    readPaths: [".env.example"],
  });
  assert.equal(materialized?.status, "materialized");
  assert.equal(
    fs.readFileSync(path.join(fixture.workspace, ".env.example"), "utf8"),
    source,
  );
});

/**
 * Source内CommentとStringの認識済みSecretはRead Projection前に拒否するを検証する。
 *
 * @responsibility Source内CommentとStringの認識済みSecretはRead Projection前に拒否するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Source内CommentとStringの認識済みSecretはRead Projection前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
test("Source内CommentとStringの認識済みSecretはRead Projection前に拒否する", (t) => {
  for (const source of [
    "// password=Password123!\n",
    "//password=Password123!\n",
    "/* password=Password123! */\n",
    "/*password=Password123!*/\n",
    "/**password=Password123!*/\n",
    "/*!password=Password123!*/\n",
    "/*password=Password123!",
    "/**\n * docs\n *password=Password123!\n */\n",
    "/*docs\n*password=Password123!\n*/\n",
    "/*docs\r\n!password=Password123!\r\n*/\n",
    'const note = " password=Password123!";\n',
    'const note = "password=Password123!";\n',
    "const note = ` password=Password123!`;\n",
    "const re = /password=Password123!/;\n",
  ]) {
    const fixture = temporaryFixture(t);
    const blobId = writeObject(
      fixture.commonDirectory,
      "blob",
      Buffer.from(source),
    );
    const treeId = writeObject(
      fixture.commonDirectory,
      "tree",
      treeEntry("100644", "auth.ts", blobId),
    );
    const commitId = writeObject(
      fixture.commonDirectory,
      "commit",
      Buffer.from(`tree ${treeId}\n\nfixture\n`),
    );
    const materialized = materializeGitCommitTreeCandidate({
      commonDirectory: fixture.commonDirectory,
      revision: commitId,
      workspace: fixture.workspace,
      readPaths: ["auth.ts"],
    });
    assert.equal(materialized?.status, "blocked");
    assert.deepEqual(fs.readdirSync(fixture.workspace), []);
  }
});

/**
 * symlink、submodule、Windows case衝突と非empty workspaceを拒否するを検証する。
 *
 * @responsibility symlink、submodule、Windows case衝突と非empty workspaceを拒否するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus symlink、submodule、Windows case衝突と非empty workspaceを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
test("symlink、submodule、Windows case衝突と非empty workspaceを拒否する", (t) => {
  for (const scenario of [
    "symlink",
    "submodule",
    "case",
    "nonempty",
  ] as const) {
    const fixture = temporaryFixture(t);
    const blobId = writeObject(
      fixture.commonDirectory,
      "blob",
      Buffer.from("value"),
    );
    const treeBytes =
      scenario === "case"
        ? Buffer.concat([
            treeEntry("100644", "File.txt", blobId),
            treeEntry("100644", "file.txt", blobId),
          ])
        : treeEntry(
            scenario === "symlink"
              ? "120000"
              : scenario === "submodule"
                ? "160000"
                : "100644",
            "file.txt",
            blobId,
          );
    const treeId = writeObject(fixture.commonDirectory, "tree", treeBytes);
    const commitId = writeObject(
      fixture.commonDirectory,
      "commit",
      Buffer.from(`tree ${treeId}\n\nfixture\n`),
    );
    if (scenario === "nonempty") {
      fs.writeFileSync(path.join(fixture.workspace, "existing.txt"), "keep");
    }
    assert.equal(
      materializeGitCommitTreeCandidate({
        commonDirectory: fixture.commonDirectory,
        revision: commitId,
        workspace: fixture.workspace,
      }),
      null,
    );
  }
});

/**
 * object改変、余分field、SHA-256 Repository IDと動的入力をfail closedにするを検証する。
 *
 * @responsibility object改変、余分field、SHA-256 Repository IDと動的入力をfail closedにするの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus object改変、余分field、SHA-256 Repository IDと動的入力をfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
test("object改変、余分field、SHA-256 Repository IDと動的入力をfail closedにする", (t) => {
  const fixture = temporaryFixture(t);
  const blobId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from("value"),
  );
  const blobPath = path.join(
    fixture.commonDirectory,
    "objects",
    blobId.slice(0, 2),
    blobId.slice(2),
  );
  fs.appendFileSync(blobPath, "x");
  for (const candidate of [
    {
      commonDirectory: fixture.commonDirectory,
      revision: "a".repeat(64),
      workspace: fixture.workspace,
    },
    {
      commonDirectory: fixture.commonDirectory,
      revision: "a".repeat(40),
      workspace: fixture.workspace,
      extra: true,
    },
    new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("must not execute");
        },
      },
    ),
  ]) {
    assert.equal(materializeGitCommitTreeCandidate(candidate), null);
  }
});

/**
 * 公開契約は限定Git object readerと非Authority境界を固定するを検証する。
 *
 * @responsibility 公開契約は限定Git object readerと非Authority境界を固定するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約は限定Git object readerと非Authority境界を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
test("公開契約は限定Git object readerと非Authority境界を固定する", () => {
  const contract = describeGitObjectReaderContract();
  assert.equal(contract.contractRevision, 4);
  assert.equal(contract.objectFormat, "sha1_only");
  assert.equal(contract.externalGitCliUsed, false);
  assert.deepEqual(contract.rejectedTreeModes, ["120000", "160000", "unknown"]);
  assert.equal(
    contract.unsupportedModeProjection,
    "unselected_skipped_selected_or_full_rejected",
  );
  assert.equal(contract.windowsNameCollision, "fail_closed");
  assert.match(contract.recognizedSecretMaterial, /rejected/u);
  assert.equal(contract.completeSecretAbsenceVerified, false);
  assert.equal(contract.authorityEstablished, false);
});
