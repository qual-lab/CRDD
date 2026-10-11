/**
 * 認可済み中立SourceからPortfolioを生成する契約試験。
 * @responsibility 欠測・Identity競合・順序・不変性を純粋集約境界で観測する。
 * @trace PPR-IT-002
 * @level IT
 * @scope domain-model、project-context、portfolio
 * @boundary PPR-IT-002=Direct Boundary: 認可済み中立Source→Domain公開集約
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createPortfolioProjection,
  parseRepositoryProjectContextMarkdown,
  type ProjectContextSource,
} from "../../src/index.ts";

const context = parseRepositoryProjectContextMarkdown(
  [
    "# Project Context",
    "Project ID: p-a",
    "Repository ID: r-a",
    "Repository Role: development",
    ...[
      "1. 今どうなっているか",
      "2. 何が危ない、または止まっているか",
      "3. 今、人間が決めることは何か",
      "4. なぜこの状態・判断になったか",
      "5. 次に何をすべきか",
    ].map(
      (title) =>
        `## ${title}\n\n### 結論\n\n要約。\n\n| 項目 | 状態 |\n|---|---|\n| 固定 | 観測済み |`,
    ),
  ].join("\n\n"),
);

/**
 * 複数Projectの完全・欠測・競合を出所別に維持する。
 * @responsibility 集約結果の順序と状態優先、入力非変更を検証する。
 * @trace PPR-IT-002
 * @precondition 解析済みContextとSnapshotでContext未提供の中立Sourceがある。実File不存在の証明ではない。
 * @stimulus Domain公開集約へ逆順Sourceを入力する。
 * @observation 全ProjectとSourceの状態・改訂・Context・freezeを観測する。
 * @oracle 競合優先、全completeだけcomplete、欠測はpartial、結果は昇順で不変。
 * @cleanup N/A: 同Process内の非秘密Fixtureだけ。
 * @boundary PPR-IT-002=Direct Boundary: 中立Source→Domain公開API
 */
test("Portfolioの順序・欠測・競合・完全性と入力不変を保つ", () => {
  const sources: readonly ProjectContextSource[] = Object.freeze([
    Object.freeze({
      projectId: "p-c",
      repositoryId: "r-c",
      revision: "3",
      context: null,
    }),
    Object.freeze({
      projectId: "p-b",
      repositoryId: "r-b",
      revision: "2",
      context: Object.freeze({
        ...context,
        projectId: "p-b",
        repositoryId: "r-b",
      }),
    }),
    Object.freeze({
      projectId: "p-a",
      repositoryId: "r-z",
      revision: "z",
      context: null,
    }),
    Object.freeze({
      projectId: "p-a",
      repositoryId: "r-x",
      revision: "x",
      context: Object.freeze({
        ...context,
        repositoryId: "r-x",
        projectId: "wrong",
      }),
    }),
    Object.freeze({
      projectId: "p-a",
      repositoryId: "r-y",
      revision: "y",
      context,
    }),
    Object.freeze({
      projectId: "p-a",
      repositoryId: "r-a",
      revision: "1",
      context,
    }),
  ]);
  const before = JSON.stringify(sources);
  const result = createPortfolioProjection(sources);
  assert.deepEqual(
    result.projects.map((project) => [project.projectId, project.state]),
    [
      ["p-a", "conflicting"],
      ["p-b", "complete"],
      ["p-c", "partial"],
    ],
  );
  assert.deepEqual(
    result.projects[0]?.sources.map((source) => [
      source.repositoryId,
      source.state,
      source.revision,
      source.repositoryRole,
    ]),
    [
      ["r-a", "complete", "1", "development"],
      ["r-x", "conflicting", "x", null],
      ["r-y", "conflicting", "y", null],
      ["r-z", "missing", "z", null],
    ],
  );
  assert.equal(result.projects[0]?.sources[0]?.context, context);
  assert.equal(result.projects[0]?.sources[1]?.context, null);
  assert.equal(result.projects[0]?.sources[2]?.context, null);
  assert.equal(result.retainedAsSourceOfTruth, false);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.projects));
  for (const project of result.projects) {
    assert.ok(Object.isFrozen(project));
    assert.ok(Object.isFrozen(project.sources));
    for (const source of project.sources) assert.ok(Object.isFrozen(source));
  }
  assert.equal(JSON.stringify(sources), before);
});

/**
 * 入力集合欠落と認可済み明示空集合を区別する。
 * @responsibility DomainがRegistry探索や空値fallbackを行わないことを検証する。
 * @trace PPR-IT-002
 * @precondition 呼出し側は現在認可を担当する。
 * @stimulus 明示空集合と欠落集合を別々に入力する。
 * @observation 投影と例外を観測する。
 * @oracle 空集合は空投影、欠落集合は拒否し代替情報を生成しない。
 * @cleanup N/A: 外部資源なし。
 * @boundary PPR-IT-002=Direct Boundary: 中立入力→Domain公開API
 */
test("明示空集合だけを空Portfolioとし集合欠落は補完しない", () => {
  assert.deepEqual(createPortfolioProjection([]), {
    projects: [],
    retainedAsSourceOfTruth: false,
  });
  assert.throws(() =>
    createPortfolioProjection(
      undefined as unknown as readonly ProjectContextSource[],
    ),
  );
});
