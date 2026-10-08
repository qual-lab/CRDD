/**
 * cros:integration:project-federationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Sessionで許可されたRepositoryだけをFederationし、欠測と競合を保持することを検証する。
 * @trace PPR-IT-002
 * @level IT
 * @scope cros、project-context、portfolio、coverage、non-disclosure
 * @boundary PPR-IT-002=Direct Boundary: Session→Exposure→Repository Project Context→Portfolio Projection
 */
import assert from "node:assert/strict";
import test from "node:test";

import { parseRepositoryProjectContextMarkdown } from "../../../domain-model/src/index.ts";
import {
  createCrosSession,
  createPortfolioProjection,
  resolveAuthorizedRepositories,
  type CrosExposure,
  type CrosRepository,
} from "../../src/index.ts";

/**
 * 試験用の一場面を固定Markdownで生成する。
 *
 * @responsibility Project Context Readerが要求する見出し、要約および表を一場面分だけ構築する。
 * @trace PPR-IT-002
 * @input titleに固定場面見出しを受け取る。
 * @returns 一場面のMarkdown文字列を返す。
 * @precondition titleはProject Contextの五場面のいずれかである。
 * @postcondition 一行の構造化表を含む。
 * @effect N/A: 文字列を構築するだけである。
 * @failure N/A: 入力文字列をそのまま見出しへ利用する。
 * @invariant Sourceまたは状態を追加推測しない。
 * @stimulus sceneMarkdownの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary PPR-IT-002=Direct Boundary: cros Test Source→対象契約
 * @security N/A: 合成した非秘密Fixtureだけを使う。
 * @concurrency N/A: 同期的な純粋変換である。
 */
function sceneMarkdown(title: string): string {
  return `## ${title}\n\n要約。\n\n| 項目 | 状態 | 根拠 |\n|---|---|---|\n| Sample | current | owner.md |`;
}

/**
 * 試験用Project Contextを固定形式から作成する。
 *
 * @responsibility Identityと五場面を持つ最小Project Contextを試験ごとに構築する。
 * @trace PPR-IT-002
 * @input projectId、repositoryIdおよびrepositoryRoleを受け取る。
 * @returns Project Operation Readerで検証済みのProject Contextを返す。
 * @precondition 各Identityは空でない。
 * @postcondition 五場面が同じ固定表を持つ。
 * @effect N/A: 文字列解析だけを行う。
 * @failure 不正IdentityはProject Context Readerが拒否する。
 * @invariant Context外のSourceを追加しない。
 * @stimulus contextの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary PPR-IT-002=Direct Boundary: cros Test Source→対象契約
 * @security N/A: 合成した非秘密Fixtureだけを使う。
 * @concurrency N/A: 同期的な純粋変換である。
 */
function context(
  projectId: string,
  repositoryId: string,
  repositoryRole: string,
) {
  return parseRepositoryProjectContextMarkdown(
    `# Project Context\n\nProject ID: \`${projectId}\`\nRepository ID: \`${repositoryId}\`\nRepository Role: \`${repositoryRole}\`\n\n${sceneMarkdown("1. 今どうなっているか")}\n\n${sceneMarkdown("2. 何が危ない、または止まっているか")}\n\n${sceneMarkdown("3. 今、人間が決めることは何か")}\n\n${sceneMarkdown("4. なぜこの状態・判断になったか")}\n\n${sceneMarkdown("5. 次に何をすべきか")}\n`,
  );
}

const repositories: readonly CrosRepository[] = [
  {
    projectId: "PRJ-001",
    repositoryId: "PRJ-001-DEV",
    bindingId: "BIND-DEV",
    revision: "rev-dev",
    content: {
      projectContext: context("PRJ-001", "PRJ-001-DEV", "development"),
    },
  },
  {
    projectId: "PRJ-001",
    repositoryId: "PRJ-001-MGMT",
    bindingId: "BIND-MGMT",
    revision: "rev-mgmt",
    content: {
      projectContext: context("PRJ-001", "PRJ-001-MGMT", "management"),
    },
  },
  {
    projectId: "PRJ-002",
    repositoryId: "PRJ-002-DEV",
    bindingId: "BIND-OTHER",
    revision: "rev-other",
    content: {},
  },
];

const exposures: readonly CrosExposure[] = [
  {
    workspaceId: "development",
    repositoryId: "PRJ-001-DEV",
    repositoryRevision: "rev-dev",
    registryRevision: "registry-1",
    active: true,
  },
  {
    workspaceId: "management",
    repositoryId: "PRJ-001-MGMT",
    repositoryRevision: "rev-mgmt",
    registryRevision: "registry-1",
    active: true,
  },
  {
    workspaceId: "development",
    repositoryId: "PRJ-002-DEV",
    repositoryRevision: "rev-other",
    registryRevision: "registry-1",
    active: true,
  },
];

/**
 * Developer Grantから非開示Repositoryを除外してPortfolioを作ることを検証する。
 *
 * @responsibility Grant内SourceだけをProjectへ統合し、別Workspaceの存在を結果へ漏らさない。
 * @trace PPR-IT-002
 * @precondition developmentだけを持つSessionと三Repositoryを用意する。
 * @stimulus 許可集合を解決してPortfolio Projectionを作る。
 * @observation Project、Source Identity、状態および正本保持Flagを観測する。
 * @oracle MGMT Sourceは現れず、Context欠落Projectはpartialとして残る。
 * @cleanup N/A: 不変Fixtureだけを使用する。
 * @boundary PPR-IT-002=Direct Boundary: cros Test Source→対象契約
 */
test("許可RepositoryだけをPortfolioへ統合し欠測をpartialで保つ", () => {
  const session = createCrosSession("session-dev", {
    credentialId: "cred-dev",
    workspaceIds: ["development"],
    systemAdmin: false,
    revoked: false,
  });
  assert.ok(session);

  const authorizedRepositories = resolveAuthorizedRepositories(
    session,
    exposures,
    repositories,
  );
  const portfolio = createPortfolioProjection(authorizedRepositories);

  assert.deepEqual(
    authorizedRepositories.map((repository) => repository.repositoryId),
    ["PRJ-001-DEV", "PRJ-002-DEV"],
  );
  assert.deepEqual(
    portfolio.projects.map((project) => ({
      projectId: project.projectId,
      state: project.state,
      sources: project.sources.map((source) => source.repositoryId),
    })),
    [
      {
        projectId: "PRJ-001",
        state: "complete",
        sources: ["PRJ-001-DEV"],
      },
      {
        projectId: "PRJ-002",
        state: "partial",
        sources: ["PRJ-002-DEV"],
      },
    ],
  );
  assert.equal(portfolio.retainedAsSourceOfTruth, false);
});
