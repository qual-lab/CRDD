/**
 * 文書検査のRepository観測を既存順で編成する。
 * @responsibility 探索・Scope・参照・文書状態・工程観測・Reality・報告集計を所有する。
 * @trace ARCH-000001
 */
import {
  mapDocumentRuleIssueToFinding,
  mapDocumentIdentityIssueToFinding,
  mapStableReleaseIssueToFinding,
} from "../report/document.ts";

import type { DocumentFinding, DocumentReport } from "../report/types.ts";

import {
  observeRepositoryLayout,
  lstatIfPresent,
  pathContainsSymbolicLink,
  isWithin,
} from "../repository/observe.ts";

import { observeProjectFiles } from "../repository/discover.ts";

import type { LinkRecord } from "../repository/types.ts";
import {
  createDocumentReferenceReader,
  buildDocumentReferenceMap,
  inspectDocumentLinks,
} from "../repository/references.ts";
import { selectDocumentScope } from "../repository/scope.ts";
import { inspectProjectContextRepository } from "../repository/project-context.ts";
import { inspectWorkLifecycleRepository } from "../repository/work-lifecycle.ts";
import { inspectDiscoveryUxRepository } from "../repository/discovery-ux.ts";
import { inspectIaRepository } from "../repository/ia.ts";
import { inspectUiRepository } from "../repository/ui.ts";
import { inspectSpecRepository } from "../repository/spec.ts";
import { inspectArchitectureRepository } from "../repository/architecture.ts";
import { inspectQualityRepository } from "../repository/quality.ts";
import fs from "node:fs";
import path from "node:path";

import { resolveRevisionIdentity } from "../../../version-control/src/index.ts";
import {
  parseCanonicalReleaseHeader,
  parseChangeTraceHeader,
  parseStableIdentityOccurrences,
  inspectStableIdentityOwnership,
  inspectBranchCoverageTable,
  inspectRemediationTable,
  inspectRelatedOrder,
  inspectChangelogRelease,
  parseCandidateVersionHeader,
  parseReadmeVersion,
  inspectCanonicalDocumentVersions,
  inspectDiscoveryIdentityLinks,
  inspectStableIdentityDefinitions,
  inspectStableCanonicalDocuments,
  inspectStableReadme,
  inspectStableChangelog,
  inspectStableReleaseHeader,
  inspectPhaseDiagramTemplates,
  phaseDiagramTemplatePaths,
  parseMarkdownLinkTargets,
} from "../../../domain-model/src/index.ts";
import { inspectRealityRepository } from "../repository/reality.ts";

import { createFindingCollector } from "../report/collect.ts";

/**
 * 確認済みRootに対して文書検査を編成し、表示前の報告を返す。
 * @responsibility 観測・Domain呼出し・診断集約を所有し、CLI引数受付と表示は所有しない。
 * @trace ARCH-000001
 * @input root: CLIが初回確認したRoot。scopeValues／referencesValue: 既存選択値。startedAt／startedAtMs: CLI開始時刻。cliError: 既存の入力拒否先。
 * @returns 既存のfield順・診断順・件数を持つDocumentReport。
 * @precondition Rootのlstat・Directory・Linkの初回確認が完了している。
 * @postcondition 全工程観測後に診断を整列し、参照mapを構築する。
 * @effect Repositoryと固定Git履歴を読取りする。書込み・外部AI依頼なし。
 * @failure 既存の入力拒否・観測例外を伝播し、途中結果を全体成功へ変えない。
 * @invariant 適用範囲、再読取り、短絡、Reality前後と診断sort順を維持する。
 * @boundary CLIの入力・表示とRepository観測の境界。
 * @security Rootと観測不能の扱いを緩めず、新しい状態管理を追加しない。
 * @concurrency 同一呼出し内の同期観測。永続Lockを所有しない。
 */
export function inspectDocumentRepository(
  root: string,
  scopeValues: readonly string[],
  referencesValue: string | null,
  startedAt: Date,
  startedAtMs: number,
  cliError: (message: string) => never,
): DocumentReport {
  const layout = observeRepositoryLayout(root);
  const {
    declaredSubmodules,
    baselineCandidateRoot,
    isBaselineDeclared,
    isBaselineDeclarationCandidate,
    isBaselineEntryDirectory,
  } = layout;
  let { repositoryMode, adoptedBaselineRoot } = layout;
  const findings: DocumentFinding[] = [];
  const add = (severity: string, code: string, file: string, message: string) =>
    findings.push({ severity, code, path: file, message });
  const relative = (file: string) =>
    path.relative(root, file).replaceAll("\\", "/") || ".";
  const read = (file: string) => fs.readFileSync(file, "utf8");

  let workLifecycleRoots = [
    path.join(root, "99_Roadmap"),
    ...(repositoryMode === "official"
      ? [path.join(root, "template", "99_Roadmap")]
      : []),
  ];
  let recognizedChangeTracePatterns = [
    "99_Roadmap/Changes/CHG-*/change.md",
    ...(repositoryMode === "official"
      ? ["template/99_Roadmap/Changes/CHG-*/change.md"]
      : []),
  ];

  /**
   * change Trace Root Forを決定する。
   *
   * @responsibility change Trace Root Forの導出に必要な入力、判定規則、返却結果の境界を所有する。
   * @trace ARCH-000001
   * @input file: string
   * @returns string | nullを返す。
   * @precondition 「file: string」がchangeTraceRootForの入力契約を満たす。
   * @postcondition changeTraceRootForの責務を完了した結果だけを返す。
   * @effect N/A: changeTraceRootForは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: changeTraceRootForは独自の失敗分岐を所有しない。
   * @invariant changeTraceRootForは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: changeTraceRootForはProcess内の同一Subsystemで完結する。
   * @security N/A: changeTraceRootForはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: changeTraceRootForは共有非同期状態を持たない同期処理である。
   */
  function changeTraceRootFor(file: string): string | null {
    for (const workLifecycleRoot of workLifecycleRoots) {
      if (!isWithin(workLifecycleRoot, file)) continue;
      const relativeParts = path
        .relative(workLifecycleRoot, file)
        .split(path.sep);
      if (
        relativeParts.length !== 3 ||
        relativeParts[0] !== "Changes" ||
        !/^(?:CHG-[0-9]{6}|CHG-XXXXXX)$/u.test(relativeParts[1]) ||
        relativeParts[2] !== "change.md"
      )
        continue;
      return path.join(workLifecycleRoot, "Changes", relativeParts[1]);
    }
    return null;
  }
  /**
   * Evidence Fileかを判定する。
   *
   * @responsibility Evidence Fileの判定条件とtrue／false境界を所有する。
   * @trace ARCH-000001
   * @input file: string
   * @returns booleanを返す。
   * @precondition 「file: string」がisEvidenceFileの入力契約を満たす。
   * @postcondition isEvidenceFileの責務を完了した結果だけを返す。
   * @effect N/A: isEvidenceFileは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: isEvidenceFileは独自の失敗分岐を所有しない。
   * @invariant isEvidenceFileは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: isEvidenceFileはProcess内の同一Subsystemで完結する。
   * @security N/A: isEvidenceFileはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: isEvidenceFileは共有非同期状態を持たない同期処理である。
   */
  function isEvidenceFile(file: string): boolean {
    return path
      .relative(root, file)
      .split(path.sep)
      .slice(0, -1)
      .some((part) => part.toLocaleLowerCase("en-US") === "evidence");
  }

  /**
   * declared Change Trace Idを決定する。
   *
   * @responsibility declared Change Trace Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
   * @trace ARCH-000001
   * @input file: string
   * @returns string | nullを返す。
   * @precondition 「file: string」がdeclaredChangeTraceIdの入力契約を満たす。
   * @postcondition declaredChangeTraceIdの責務を完了した結果だけを返す。
   * @effect Fileの先頭40行を同期readしてDomain Header解析へ渡す。
   * @failure 観測・解析例外を伝播し、後続の処理を実行しない。
   * @invariant declaredChangeTraceIdは入力から導いた結果以外の共有状態を変更しない。
   * @boundary Repository Filesystemの同期読取りとDomain本文解析の境界。
   * @security N/A: declaredChangeTraceIdはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: declaredChangeTraceIdは共有非同期状態を持たない同期処理である。
   */
  function declaredChangeTraceId(file: string): string | null {
    const header = read(file).split(/\r?\n/u).slice(0, 40).join("\n");
    return parseChangeTraceHeader(header).changeId;
  }

  /**
   * Change Trace Definition Signatureが存在するかを判定する。
   *
   * @responsibility Change Trace Definition Signatureの存在条件とtrue／false境界を所有する。
   * @trace ARCH-000001
   * @input file: string
   * @returns booleanを返す。
   * @precondition 「file: string」がhasChangeTraceDefinitionSignatureの入力契約を満たす。
   * @postcondition hasChangeTraceDefinitionSignatureの責務を完了した結果だけを返す。
   * @effect 同じFileを元位置で二回readし、見出しとIDを確認する。
   * @failure 観測・解析例外を伝播し、後続の処理を実行しない。
   * @invariant hasChangeTraceDefinitionSignatureは入力から導いた結果以外の共有状態を変更しない。
   * @boundary Repository Filesystemの同期読取りとDomain本文解析の境界。
   * @security N/A: hasChangeTraceDefinitionSignatureはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: hasChangeTraceDefinitionSignatureは共有非同期状態を持たない同期処理である。
   */
  function hasChangeTraceDefinitionSignature(file: string): boolean {
    const header = read(file).split(/\r?\n/u).slice(0, 40).join("\n");
    const hasStandardHeading =
      parseChangeTraceHeader(header).hasStandardHeading;
    return Boolean(declaredChangeTraceId(file) && hasStandardHeading);
  }

  const { resolveLocalTarget, resolveLinkWithFixedHistory } =
    createDocumentReferenceReader(root, repositoryMode, add);

  const discovery = observeProjectFiles(
    {
      root,
      declaredSubmodules,
      baselineCandidateRoot,
      isBaselineDeclared,
      isBaselineDeclarationCandidate,
      isBaselineEntryDirectory,
    },
    add,
  );
  if (discovery.baseline_submodule && repositoryMode !== "adopter") {
    repositoryMode = "adopter";
    adoptedBaselineRoot = baselineCandidateRoot;
    workLifecycleRoots = [path.join(root, "99_Roadmap")];
    recognizedChangeTracePatterns = ["99_Roadmap/Changes/CHG-*/change.md"];
  }
  const gitlinkRoots = discovery.gitlinks;
  /**
   * gitlink Root Forを決定する。
   *
   * @responsibility gitlink Root Forの導出に必要な入力、判定規則、返却結果の境界を所有する。
   * @trace ARCH-000001
   * @input target: string
   * @returns string | nullを返す。
   * @precondition 「target: string」がgitlinkRootForの入力契約を満たす。
   * @postcondition gitlinkRootForの責務を完了した結果だけを返す。
   * @effect N/A: gitlinkRootForは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: gitlinkRootForは独自の失敗分岐を所有しない。
   * @invariant gitlinkRootForは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: gitlinkRootForはProcess内の同一Subsystemで完結する。
   * @security N/A: gitlinkRootForはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: gitlinkRootForは共有非同期状態を持たない同期処理である。
   */
  function gitlinkRootFor(target: string): string | null {
    return gitlinkRoots.find((item) => isWithin(item, target)) ?? null;
  }
  const baselineState = discovery.baseline_submodule_state;
  if (discovery.baseline_submodule) {
    if (baselineState.declared === null) {
      add(
        "error",
        "baseline-submodule-unverified",
        "00_CRDD",
        "The checker could not verify the .gitmodules declaration for the adopted baseline.",
      );
    } else if (baselineState.gitlink_indexed === false) {
      add(
        "error",
        "baseline-gitlink-missing",
        "00_CRDD",
        "The adopted baseline is declared in .gitmodules, but the parent Git index does not contain a mode 160000 gitlink at 00_CRDD.",
      );
    } else if (baselineState.gitlink_indexed === null) {
      add(
        "error",
        "baseline-submodule-unverified",
        "00_CRDD",
        "The checker could not verify a normal mode 160000 parent-index gitlink for the adopted baseline. Resolve index conflicts or metadata access failures and run the check again.",
      );
    } else {
      if (baselineState.declared === false) {
        add(
          "error",
          "baseline-submodule-declaration-missing",
          "00_CRDD",
          "The parent Git index contains a mode 160000 gitlink at 00_CRDD, but .gitmodules does not declare that path.",
        );
      }
      if (baselineState.worktree_present === false) {
        add(
          "error",
          "baseline-submodule-not-initialized",
          "00_CRDD",
          "Initialize the adopted CRDD baseline submodule before checking the project.",
        );
      } else if (
        baselineState.gitdir_accessible !== true ||
        baselineState.head_readable !== true
      ) {
        add(
          "error",
          "baseline-submodule-unverified",
          "00_CRDD",
          "The baseline worktree exists, but the checker could not verify that it is the 00_CRDD Git worktree or read its Git directory and HEAD. Fix access to the repository metadata and run the check again.",
        );
      } else if (baselineState.head_matches_gitlink === false) {
        add(
          "error",
          "baseline-submodule-revision-mismatch",
          "00_CRDD",
          `The baseline worktree HEAD ${baselineState.head_oid} does not match the parent-index gitlink ${baselineState.gitlink_oid}.`,
        );
      }
    }
  }
  const allFiles = discovery.files;
  const allFileSet = new Set(allFiles);
  const allMarkdownFiles = allFiles.filter((file) =>
    file.toLowerCase().endsWith(".md"),
  );

  /**
   * officialひな型の基本図処置検査をDomainへ接続する。
   *
   * @responsibility 対象探索・既存fallback・本文読取りと従来Findingへの変換を行う。
   * @trace ARCH-000001
   * @input N/A: 現在の検査Rootと観測済みFile集合を使用する。
   * @returns void。
   * @precondition Root・Profile判定・File観測は既存Checker経路で行う。
   * @postcondition 従来の七Path順・診断code・文言を維持する。
   * @effect 対象Fileを同期readし、Domainの基本図処置条件へ渡して診断を追記する。
   * @failure 観測・解析例外を伝播し、後続の処理を実行しない。
   * @invariant 存在しないFileは従来どおりskipし、新しい必須条件を追加しない。
   * @boundary FilesystemとDomainの同期検査の境界。
   * @security 診断なしを図の実在・品質の保証としない。
   * @concurrency N/A: 既存の同期検査順に従う。
   */
  function checkPhaseDiagramDispositionContracts(): void {
    if (repositoryMode !== "official") return;
    for (const relativePath of phaseDiagramTemplatePaths) {
      const file =
        allFiles.find((candidate) => relative(candidate) === relativePath) ??
        path.join(root, ...relativePath.split("/"));
      if (!fs.existsSync(file)) continue;
      for (const issue of inspectPhaseDiagramTemplates([
        { path: relativePath, content: read(file) },
      ])) {
        if (
          issue.kind !== "artifact.phase-diagram.contract-invalid" ||
          typeof issue.details.missingItems !== "string"
        )
          throw new Error("invalid_phase_diagram_domain_issue");
        add(
          "error",
          "phase_diagram_disposition_contract_invalid",
          relativePath,
          `工程の基本図処置契約が不完全です: ${issue.details.missingItems}`,
        );
      }
    }
  }

  const linkRecords: LinkRecord[] = [];
  for (const source of allMarkdownFiles) {
    for (const raw of parseMarkdownLinkTargets(read(source))) {
      linkRecords.push(resolveLinkWithFixedHistory(source, raw));
    }
  }

  const { requestedScopes, uncheckedItems, checkedFiles, markdownFiles } =
    selectDocumentScope(
      {
        root,
        scopeValues,
        allMarkdownFiles,
        allFileSet,
        linkRecords,
        gitlinkRoots,
        isBaselineSubmodule: discovery.baseline_submodule,
        adoptedBaselineRoot,
        uncheckedDescriptions: discovery.unchecked,
      },
      cliError,
    );
  const { checkedLocalLinks, checkedAnchors } = inspectDocumentLinks(
    {
      root,
      linkRecords,
      checkedFiles,
      allFileSet,
      gitlinkRoots,
      isBaselineSubmodule: discovery.baseline_submodule,
      adoptedBaselineRoot,
      uncheckedItems,
    },
    add,
  );

  const requestedDocsRoot =
    repositoryMode === "adopter" ? path.join(root, "00_CRDD") : root;
  const requestedDocsRootStat = lstatIfPresent(requestedDocsRoot);
  let docsRoot: string | null = null;
  if (pathContainsSymbolicLink(root, requestedDocsRoot)) {
    add(
      "error",
      "symbolic-document-root",
      relative(requestedDocsRoot),
      "The canonical document root must not be a symbolic link or junction.",
    );
  } else if (!requestedDocsRootStat) {
    add(
      "error",
      "missing-document-root",
      relative(requestedDocsRoot),
      "The canonical document root does not exist.",
    );
  } else if (!requestedDocsRootStat.isDirectory()) {
    add(
      "error",
      "invalid-document-root",
      relative(requestedDocsRoot),
      "The canonical document root must be a directory.",
    );
  } else {
    docsRoot = requestedDocsRoot;
  }
  const versionedDocuments = [];
  const canonicalDocumentStates = [];
  if (docsRoot) {
    for (const name of fs.readdirSync(docsRoot)) {
      if (!/^\d{2}_.+\.md$/u.test(name)) continue;
      const file = path.join(docsRoot, name);
      if (pathContainsSymbolicLink(root, file)) {
        add(
          "error",
          "symbolic-canonical-document",
          relative(file),
          "Canonical documents must not be symbolic links.",
        );
        continue;
      }
      if (!lstatIfPresent(file)?.isFile()) continue;
      const model = parseCanonicalReleaseHeader(read(file));
      if (model.version !== null)
        versionedDocuments.push([file, model.version]);
      canonicalDocumentStates.push({ file, ...model });
    }
  }
  if (repositoryMode === "official") {
    const canonicalTitleContracts = new Map([
      ["99_Roadmap/01_Roadmap.md", "# CRDD Roadmap"],
    ]);
    for (const [relativePath, expectedTitle] of canonicalTitleContracts) {
      const file = path.join(root, relativePath);
      if (
        !lstatIfPresent(file)?.isFile() ||
        pathContainsSymbolicLink(root, file)
      ) {
        continue;
      }
      const actualTitle = read(file)
        .replace(/^\uFEFF/u, "")
        .split(/\r?\n/u)
        .find((line) => /^#\s+\S/u.test(line));
      if (actualTitle !== expectedTitle) {
        add(
          "error",
          "canonical-document-title-mismatch",
          relativePath,
          `Expected canonical title ${JSON.stringify(expectedTitle)}; found ${JSON.stringify(actualTitle ?? "missing")}.`,
        );
      }
    }
  }
  const versionResult = inspectCanonicalDocumentVersions(
    versionedDocuments.map(
      ([file, version]) => [relative(file), version] as const,
    ),
    canonicalDocumentStates.map((document) => ({
      ...document,
      file: relative(document.file),
    })),
  );
  const { versions, candidateReleasedBaseline } = versionResult;
  for (const issue of versionResult.issues) {
    const finding = mapDocumentIdentityIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }

  const stableDocuments = canonicalDocumentStates.filter(
    ({ status }) => status === "Stable",
  );
  if (
    repositoryMode === "official" &&
    scopeValues.length === 0 &&
    canonicalDocumentStates.length > 1 &&
    stableDocuments.length > 0 &&
    new Set(stableDocuments.map(({ version }) => version)).size === 1 &&
    stableDocuments.every(({ version }) => version !== null) &&
    versions.size === 1
  ) {
    const stableVersion = [...versions][0];
    if (stableVersion === undefined) {
      throw new Error("stable_release_version_missing");
    }
    const inspectStableCanonicalDocumentsResult =
      inspectStableCanonicalDocuments(
        canonicalDocumentStates.map((document) => ({
          ...document,
          file: relative(document.file),
        })),
        stableVersion,
      );
    for (const issue of inspectStableCanonicalDocumentsResult.issues) {
      const finding = mapStableReleaseIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
    const stableTagCommit = resolveRevisionIdentity(
      root,
      `refs/tags/${stableVersion}^{commit}`,
    );
    const currentHeadCommit = resolveRevisionIdentity(root, "HEAD");
    const hasDifferentCandidateVersion = allMarkdownFiles.some((file) => {
      const header = read(file).split(/\r?\n/u).slice(0, 16).join("\n");
      const candidateVersion = parseCandidateVersionHeader(header);
      return candidateVersion !== null && candidateVersion !== stableVersion;
    });
    if (
      !hasDifferentCandidateVersion &&
      stableTagCommit !== null &&
      currentHeadCommit !== null &&
      stableTagCommit !== currentHeadCommit
    ) {
      add(
        "error",
        "stable-release-tag-identity-mismatch",
        relative(path.join(root, ".git")),
        `Official ${stableVersion} tag must resolve to the checked HEAD commit.`,
      );
    }
    const readmePath = path.join(root, "README.md");
    const readme = lstatIfPresent(readmePath)?.isFile() ? read(readmePath) : "";
    const inspectStableReadmeResult = inspectStableReadme(
      { path: relative(readmePath), content: readme },
      stableVersion,
    );
    for (const issue of inspectStableReadmeResult.issues) {
      const finding = mapStableReleaseIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
    const changelogPath = path.join(root, "CHANGELOG.md");
    const changelog = lstatIfPresent(changelogPath)?.isFile()
      ? read(changelogPath)
      : "";
    const inspectStableChangelogResult = inspectStableChangelog(
      { path: relative(changelogPath), content: changelog },
      stableVersion,
    );
    for (const issue of inspectStableChangelogResult.issues) {
      const finding = mapStableReleaseIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
    for (const file of allMarkdownFiles) {
      const header = read(file).split(/\r?\n/u).slice(0, 16).join("\n");
      const result = inspectStableReleaseHeader(
        header,
        relative(file),
        stableVersion,
        stableTagCommit,
      );
      for (const issue of result.issues) {
        const finding = mapStableReleaseIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }
  }

  /**
   * Discovery Identity Link Ownershipを検査する。
   *
   * @responsibility Discovery Identity Link Ownershipの検査条件、違反分類、検査結果境界を所有する。
   * @trace ARCH-000001
   * @input N/A: 実行時引数を受け取らない。
   * @returns N/A: checkDiscoveryIdentityLinkOwnershipは戻り値を返さない。
   * @precondition 「N/A: 実行時引数を受け取らない。」がcheckDiscoveryIdentityLinkOwnershipの入力契約を満たす。
   * @postcondition checkDiscoveryIdentityLinkOwnershipの責務を完了して呼出し元へ制御を戻す。
   * @effect 除外条件の外にあるMarkdownを順番にreadし、Domainの所有リンク検査へ渡す。
   * @failure 観測・解析例外を伝播し、後続の処理を実行しない。
   * @invariant checkDiscoveryIdentityLinkOwnershipは入力から導いた結果以外の共有状態を変更しない。
   * @boundary Repository Filesystemの同期読取りとDomain本文検査の境界。
   * @security N/A: checkDiscoveryIdentityLinkOwnershipはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: checkDiscoveryIdentityLinkOwnershipは共有非同期状態を持たない同期処理である。
   */
  function checkDiscoveryIdentityLinkOwnership(): void {
    for (const file of allMarkdownFiles) {
      const relativePath = relative(file);
      if (
        relativePath.startsWith("99_Roadmap/Changes/") ||
        relativePath.includes("/Evidence/")
      )
        continue;
      const result = inspectDiscoveryIdentityLinks({
        path: relativePath,
        content: read(file),
      });
      for (const issue of result.issues) {
        const finding = mapDocumentIdentityIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
    }
  }

  const readme = path.join(root, "README.md");
  if (
    lstatIfPresent(readme)?.isFile() &&
    !pathContainsSymbolicLink(root, readme) &&
    versions.size === 1 &&
    repositoryMode === "official"
  ) {
    const readmeVersion = parseReadmeVersion(read(readme));
    const expectedVersion = versions.values().next().value;
    if (readmeVersion && readmeVersion !== expectedVersion) {
      add(
        "error",
        "readme-version-mismatch",
        "README.md",
        `README=${readmeVersion}, canonical=${expectedVersion}`,
      );
    }
  }

  const changelog = path.join(root, "CHANGELOG.md");
  if (
    lstatIfPresent(changelog)?.isFile() &&
    !pathContainsSymbolicLink(root, changelog) &&
    versions.size === 1 &&
    repositoryMode === "official"
  ) {
    const currentVersion = candidateReleasedBaseline ?? [...versions][0];
    const result = inspectChangelogRelease(
      { path: "CHANGELOG.md", content: read(changelog) },
      currentVersion as string,
    );
    for (const issue of result.issues) {
      const finding = mapDocumentRuleIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }

  let relatedBlocks = 0;
  for (const file of markdownFiles) {
    const result = inspectRelatedOrder({
      path: relative(file),
      content: read(file),
    });
    if (result.hasRelated) relatedBlocks += 1;
    for (const issue of result.issues) {
      const finding = mapDocumentRuleIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }

  const stableIdPattern = /\b(?:REQ|UX|IA|UI|SPEC)-\d{6}\b/gu;
  const stableIdOccurrences = new Map();
  const stableIdDefinitions = new Map();
  for (const file of allMarkdownFiles) {
    const text = read(file);
    for (const id of parseStableIdentityOccurrences(text)) {
      const items = stableIdOccurrences.get(id) ?? [];
      items.push(relative(file));
      stableIdOccurrences.set(id, items);
    }
    if (
      repositoryMode === "adopter" &&
      isWithin(path.join(root, "00_CRDD"), file)
    ) {
      continue;
    }
    const model = inspectStableIdentityDefinitions(
      { path: relative(file), content: text },
      relative(file) === "02_UX/01_User_Experience.md",
    );
    for (const issue of model.issues) {
      const finding = mapDocumentIdentityIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
    for (const [id, definitions] of model.stableIdDefinitions) {
      const items = stableIdDefinitions.get(id) ?? [];
      for (const definition of definitions) items.push(definition);
      stableIdDefinitions.set(id, items);
    }
  }
  for (const issue of inspectStableIdentityOwnership(stableIdDefinitions)) {
    const finding = mapDocumentIdentityIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }

  let numericRowsChecked = 0;
  for (const file of allMarkdownFiles) {
    const result = inspectBranchCoverageTable({
      path: relative(file),
      content: read(file),
    });
    numericRowsChecked += result.numericRowsChecked;
    for (const issue of result.issues) {
      const finding = mapDocumentRuleIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }

  let remediationRowsChecked = 0;
  for (const file of allMarkdownFiles) {
    const result = inspectRemediationTable({
      path: relative(file),
      content: read(file),
    });
    remediationRowsChecked += result.remediationRowsChecked;
    for (const issue of result.issues) {
      const finding = mapDocumentRuleIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }

  for (const file of allFiles) {
    const stableId = path.basename(file).match(stableIdPattern)?.[0];
    if (stableId) {
      add(
        "error",
        "stable-id-in-filename",
        relative(file),
        `${stableId}: use the ID inside the owning artifact, not as a filename.`,
      );
    }
    if (/^CHG-[^.]+\.md$/u.test(path.basename(file))) {
      add(
        "error",
        "legacy-change-trace-layout",
        relative(file),
        "Flat CHG Markdown files are not canonical. Use 99_Roadmap/Changes/<CHG-ID>/change.md.",
      );
    }
    if (path.basename(file) === "change.md") {
      if (isEvidenceFile(file)) {
        if (hasChangeTraceDefinitionSignature(file)) {
          add(
            "error",
            "change-trace-placement",
            relative(file),
            "A file under Evidence contains a Change Trace header. " +
              "Move the Change Trace definition into its owning Changes tree, " +
              "or remove the Change Trace header from supporting evidence.",
          );
        }
        continue;
      }
      const aggregateRoot = changeTraceRootFor(file);
      if (!aggregateRoot) {
        add(
          "error",
          "change-trace-placement",
          relative(file),
          `The checker cannot recognize this Change Trace path in repository mode ${repositoryMode}. ` +
            `Recognized inspection paths: ${recognizedChangeTracePatterns.join(", ")}.`,
        );
        continue;
      }
      const aggregateId = path
        .basename(aggregateRoot)
        .match(/^CHG-(?:[0-9]{6}|XXXXXX)/u)?.[0];
      const declaredId = declaredChangeTraceId(file);
      if (!aggregateId || !declaredId || aggregateId !== declaredId) {
        add(
          "error",
          "change-trace-aggregate-identity-mismatch",
          relative(file),
          "The aggregate directory ID and the Change ID declared by change.md must match exactly.",
        );
      }
    }
    if (isEvidenceFile(file) && isWithin(path.join(root, "99_Roadmap"), file)) {
      const evidenceName = path.basename(file);
      if (
        !/^\d{6}(?:-\d{4})?_[a-z0-9]+(?:-[a-z0-9]+)*(?:-\d{2})?\.(?:md|json|tap|txt|log)$/u.test(
          evidenceName,
        )
      ) {
        add(
          "error",
          "noncanonical-evidence-filename",
          relative(file),
          "Evidence filenames must use YYMMDD[-HHmm]_<type> with a collision suffix only when needed.",
        );
      }
    }
  }

  const requestedStructureRoot =
    repositoryMode === "adopter"
      ? root
      : repositoryMode === "official"
        ? path.join(root, "template")
        : null;
  let structureRoot = null;
  if (requestedStructureRoot) {
    const requestedStructureRootStat = lstatIfPresent(requestedStructureRoot);
    if (pathContainsSymbolicLink(root, requestedStructureRoot)) {
      add(
        "error",
        "symbolic-structure-root",
        relative(requestedStructureRoot),
        "The CRDD structure root must not be a symbolic link or junction.",
      );
    } else if (!requestedStructureRootStat) {
      add(
        "error",
        "missing-structure-root",
        relative(requestedStructureRoot),
        "The CRDD structure root does not exist.",
      );
    } else if (!requestedStructureRootStat.isDirectory()) {
      add(
        "error",
        "invalid-structure-root",
        relative(requestedStructureRoot),
        "The CRDD structure root must be a directory.",
      );
    } else {
      structureRoot = requestedStructureRoot;
    }
  }
  if (structureRoot) {
    const requiredFolders = [
      "00_CRDD",
      "01_Discovery",
      "02_UX",
      "03_IA",
      "04_UI",
      "05_SPEC",
      "06_Architecture",
      "07_Quality",
      "19_Workflows",
      "40_Develop",
      "99_Roadmap",
    ];
    for (const name of requiredFolders) {
      const requiredPath = path.join(structureRoot, name);
      const requiredStat = lstatIfPresent(requiredPath);
      if (pathContainsSymbolicLink(root, requiredPath)) {
        add(
          "error",
          "symbolic-structure-entry",
          relative(requiredPath),
          "CRDD structure entries must not be symbolic links or junctions.",
        );
      } else if (!requiredStat) {
        if (gitlinkRootFor(requiredPath) === requiredPath) {
          uncheckedItems.add(
            `Required structure entry is an uninitialized Gitlink submodule: ${relative(requiredPath)}`,
          );
          continue;
        }
        add("error", "missing-crdd-folder", relative(structureRoot), name);
      } else if (!requiredStat.isDirectory()) {
        add(
          "error",
          "invalid-structure-entry",
          relative(requiredPath),
          "CRDD structure entries must be directories.",
        );
      }
    }
    for (const name of [
      "07_Workflows",
      "08_Workflows",
      "08_Quality",
      "90_Release",
    ]) {
      if (lstatIfPresent(path.join(structureRoot, name))) {
        add("error", "legacy-crdd-folder", relative(structureRoot), name);
      }
    }
    for (const entry of fs.readdirSync(structureRoot)) {
      const match = entry.match(/^(\d{2})_/u);
      const number = match ? Number(match[1]) : -1;
      if (number >= 8 && number <= 18) {
        add(
          repositoryMode === "official" ? "error" : "warning",
          "reserved-crdd-folder",
          relative(path.join(structureRoot, entry)),
          repositoryMode === "official"
            ? "08-18 are reserved by the CRDD standard template."
            : "08-18 are reserved for future CRDD use. Confirm that this is an explicit project-specific extension with documented responsibility and migration handling.",
        );
      }
    }
    const develop = path.join(structureRoot, "40_Develop");
    for (const file of allFiles.filter(
      (item) => isWithin(develop, item) && item.toLowerCase().endsWith(".md"),
    )) {
      add(
        "warning",
        "develop-markdown",
        relative(file),
        "Confirm this is implementation-local documentation, not CRDD management Markdown.",
      );
    }
  }

  const shouldInspectReality = Boolean(
    repositoryMode === "official" &&
      discovery.source === "git" &&
      lstatIfPresent(path.join(root, "06_Architecture", "Definitions")) &&
      lstatIfPresent(path.join(root, "07_Quality", "Definitions")) &&
      lstatIfPresent(path.join(root, "40_Develop")),
  );
  inspectProjectContextRepository(root, repositoryMode, findings);
  inspectWorkLifecycleRepository(root, repositoryMode, findings);
  checkDiscoveryIdentityLinkOwnership();
  inspectDiscoveryUxRepository(
    root,
    repositoryMode,
    findings,
    resolveLocalTarget,
  );
  inspectIaRepository(root, repositoryMode, findings);
  inspectUiRepository(root, repositoryMode, findings);
  inspectSpecRepository(root, repositoryMode, findings);
  inspectArchitectureRepository(root, repositoryMode, findings);
  inspectQualityRepository(root, repositoryMode, findings);
  checkPhaseDiagramDispositionContracts();
  if (shouldInspectReality) {
    const collected = createFindingCollector();
    inspectRealityRepository(root, collected.add);
    for (const finding of collected.findings)
      add(finding.severity, finding.code, finding.path, finding.message);
  }

  for (const name of ["Evidence", "Decision", "Decisions"]) {
    if (lstatIfPresent(path.join(root, name))) {
      add("error", "central-root-folder", name, "Use the nearest owner.");
    }
  }

  findings.sort(
    (a, b) =>
      a.severity.localeCompare(b.severity) ||
      a.code.localeCompare(b.code) ||
      a.path.localeCompare(b.path) ||
      a.message.localeCompare(b.message),
  );

  const referenceMap = buildDocumentReferenceMap(
    {
      root,
      referencesValue,
      linkRecords,
      gitlinkRoots,
      isBaselineSubmodule: discovery.baseline_submodule,
      adoptedBaselineRoot,
      allFileSet,
      uncheckedItems,
    },
    cliError,
  );

  const errors = findings.filter((item) => item.severity === "error").length;
  const warnings = findings.filter(
    (item) => item.severity === "warning",
  ).length;
  const report: DocumentReport = {
    check_mode: requestedScopes.length === 0 ? "full" : "scoped",
    repository_mode: repositoryMode,
    gitlink_detection: discovery.gitlink_detection,
    gitlink_boundaries: gitlinkRoots.map(relative),
    change_trace_layout: "hierarchy-tolerant",
    recognized_change_trace_paths: recognizedChangeTracePatterns,
    discovery_source: discovery.source,
    discovery_git_failure: discovery.git_failure,
    baseline_submodule: discovery.baseline_submodule,
    baseline_submodule_initialized: discovery.baseline_submodule_initialized,
    baseline_submodule_state: discovery.baseline_submodule_state,
    discovery_exclusions: discovery.exclusions,
    root,
    requested_scope: requestedScopes.map(relative),
    expanded_scope:
      requestedScopes.length === 0
        ? ["."]
        : markdownFiles.slice(0, 100).map(relative),
    expanded_scope_file_count: markdownFiles.length,
    expanded_scope_truncated:
      requestedScopes.length > 0 && markdownFiles.length > 100,
    global_checks: [
      "canonical document versions",
      "current bilingual release and migration-note completeness",
      "repository structure",
      "legacy and reserved folders",
      "central root folders",
      "stable ID filename prohibition",
      "manual stable ID revision prohibition",
      "explicit stable ID definition uniqueness",
      "Change Trace inspection-path recognition (not canonical placement validation)",
      "branch coverage arithmetic where numeric values are present",
      "remediation state and early-resolution fields in recognizable tables",
      "Gitlink submodule boundary recognition",
      "symbolic link and junction boundary",
    ],
    unchecked: [
      ...uncheckedItems,
      ...(requestedScopes.length === 0
        ? []
        : ["Markdown link, anchor, and Related checks outside expanded_scope"]),
    ],
    executed_at: startedAt.toISOString(),
    duration_ms: Date.now() - startedAtMs,
    metrics: {
      files_discovered: allFiles.length,
      markdown_files_discovered: allMarkdownFiles.length,
      markdown_files_checked: markdownFiles.length,
      local_links_checked: checkedLocalLinks,
      anchors_checked: checkedAnchors,
      related_blocks_checked: relatedBlocks,
      versioned_documents_checked: versionedDocuments.length,
      stable_ids_observed: stableIdOccurrences.size,
      gitlinks_observed: gitlinkRoots.length,
      explicit_stable_id_definitions: stableIdDefinitions.size,
      numeric_rows_checked: numericRowsChecked,
      remediation_rows_checked: remediationRowsChecked,
      errors,
      warnings,
    },
    findings,
    references: referenceMap,
  };

  return report;
}
