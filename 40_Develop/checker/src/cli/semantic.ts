/**
 * Semanticの入力編成・診断表示・明示保存を既存CLIへ接続する。
 * @responsibility 固定二領域の意味検査をDomainへ委譲し、結果と終了Codeを返す。
 * @trace ARCH-000008
 * @boundary 検証済みRepositoryの読取りと明示保存の境界。
 * @effect --write指定時だけ既存RegistryのSnapshotを置換し得る。
 * @security Root検証と保存部品の拒否条件を迂回しない。
 */
import path from "node:path";
import {
  verifyRepositoryRoot,
  verifyRepositoryRootFromWorkingDirectory,
} from "../../../version-control/src/index.ts";
import {
  observeRealitySymbolRepository,
  createFilesystemSemanticBundlePublisher,
  createSemanticBundle,
  publishSemanticCoverage,
} from "../../../domain-model/src/index.ts";
import {
  compileQualitySemanticRelationsFromRepository,
  compileSemanticIrFromRepository,
  createSemanticCoverageGraphResult,
} from "../repository/semantic.ts";
import type { CheckerRunRequest, CheckerResult } from "./types.ts";

/**
 * 固定二領域のSemantic検査を実行して表示または保存する。
 * @responsibility 引数・Root・入力編成・結果表示を一回の操作へ閉じる。
 * @trace ARCH-000008
 * @input request: CLI引数、cwd、出力先。
 * @returns 検査0、不成立1、実行不能2、引数不正64の終了Code。
 * @precondition 指定Rootを既存Version Controlで検証できる。
 * @postcondition 検査不能や部分結果を成功として返さない。
 * @effect Repositoryを読み取り、--write指定時だけSnapshotを保存する。
 * @failure Root未検証・入力不正・保存失敗を区別して停止する。
 * @invariant 意味計算・保存保証はDomainの実装へ委譲する。
 * @boundary CLIとRepositoryの読取り・明示保存の境界。
 * @security 新しいAuthorityやRoot外書込みを許可しない。
 * @concurrency 同期実行と既存保存部品の短命File回収を維持する。
 */
export function runSemanticCoverage(request: CheckerRunRequest): CheckerResult {
  let repositoryRoot = request.cwd;
  let hasExplicitRoot = false;
  for (let i = 0; i < request.arguments.length; i += 1) {
    const arg = request.arguments[i];
    if (arg === "--write") continue;
    if (
      arg === "--root" &&
      request.arguments[i + 1] &&
      !request.arguments[i + 1]?.startsWith("--")
    ) {
      repositoryRoot = path.resolve(
        request.cwd,
        request.arguments[++i] as string,
      );
      hasExplicitRoot = true;
      continue;
    }
    request.writeError("semantic_arguments_invalid\n");
    return { exitCode: 64 };
  }
  const verifiedRepository = hasExplicitRoot
    ? verifyRepositoryRoot(repositoryRoot)
    : verifyRepositoryRootFromWorkingDirectory(request.cwd);
  if (verifiedRepository.status !== "completed") {
    request.writeError("semantic_coverage_repository_root_unverified\n");
    return { exitCode: 2 };
  }
  let failureStage: "inspection" | "publication" | "output" = "inspection";
  try {
    const pilots = [
      {
        subsystem: "coordinator",
        sourceDocument:
          "06_Architecture/Details/coordinator/01_Architecture.md",
      },
      {
        subsystem: "orchestrator",
        sourceDocument:
          "06_Architecture/Details/orchestrator/02_Detailed_Design.md",
      },
    ] as const;
    const qualitySources = [
      "07_Quality/Definitions/QA-000003/quality_definition.md",
      "07_Quality/Definitions/QA-000004/quality_definition.md",
      "07_Quality/Definitions/QA-000005/quality_definition.md",
      "07_Quality/Definitions/QA-000006/quality_definition.md",
      "07_Quality/Definitions/QA-000010/quality_definition.md",
    ] as const;

    const outputRelativePath =
      "07_Quality/Registry/semantic-coverage-pilot.json";
    const symbolDiscovery = observeRealitySymbolRepository(
      verifiedRepository.capability,
    );
    const results = pilots.map((pilot) => ({
      ...pilot,
      result: compileSemanticIrFromRepository(
        verifiedRepository.capability,
        pilot.sourceDocument,
        pilot.subsystem,
        symbolDiscovery.knownArchIds,
      ),
    }));
    const findings = results.flatMap(({ result }) => result.findings);
    const semanticIrs = results
      .map(({ result }) => result.ir)
      .filter((ir) => ir !== null);
    const qualityRelations = compileQualitySemanticRelationsFromRepository(
      verifiedRepository.capability,
      qualitySources,
      semanticIrs,
    );
    const coverage = createSemanticCoverageGraphResult(
      semanticIrs,
      symbolDiscovery.manifests,
      qualityRelations.relations ?? [],
      [
        ...symbolDiscovery.repositoryIssues.map(({ code, path, reason }) => ({
          code,
          path,
          message: reason,
        })),
        ...symbolDiscovery.domainIssues.map((issue) => ({
          code: issue.kind,
          path: issue.location.path,
          message: issue.reason,
        })),
        ...qualityRelations.findings,
      ],
    );
    const allFindings = [...findings, ...coverage.findings];
    if (allFindings.length > 0) {
      failureStage = "output";
      request.writeError(
        `${JSON.stringify({ findings: allFindings }, null, 2)}\n`,
      );
      return { exitCode: 1 };
    } else if (request.arguments.includes("--write")) {
      if (!coverage.graph)
        throw new Error("Semantic coverage graph is unavailable");
      failureStage = "publication";
      publishSemanticCoverage(
        {
          outputRelativePath: outputRelativePath,
          semanticIrs,
          coverage: coverage.graph,
        },
        createFilesystemSemanticBundlePublisher(verifiedRepository.capability),
      );
      failureStage = "output";
      request.writeOutput(
        `${JSON.stringify({ status: "created", count: results.length }, null, 2)}\n`,
      );
    } else {
      failureStage = "output";
      request.writeOutput(
        `${JSON.stringify(
          {
            semanticIrs: results.map(({ result }) => result.ir),
            coverage: coverage.graph
              ? createSemanticBundle(semanticIrs, coverage.graph).coverage
              : null,
          },
          null,
          2,
        )}\n`,
      );
    }

    return { exitCode: 0 };
  } catch {
    request.writeError(`semantic_coverage_${failureStage}_failed\n`);
    return { exitCode: 2 };
  }
}
