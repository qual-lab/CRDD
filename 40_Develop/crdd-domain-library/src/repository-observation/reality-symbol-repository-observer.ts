import type { DomainIssue } from "../outcome.ts";
import {
  discoverRealitySymbols,
  type LoadedRealitySymbolManifest,
  validateRealitySymbolManifest,
} from "../reality-traceability/index.ts";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/repository-identity/index.ts";
import { createFilesystemRepositoryObservationPort } from "./index.ts";

/**
 * RealityRepositoryObservationIssueが扱う値の構造を表す。
 *
 * @responsibility RealityRepositoryObservationIssueに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape RealityRepositoryObservationIssueが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealityRepositoryObservationIssueで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealityRepositoryObservationIssueの宣言は外部境界を開かない。
 * @security N/A: RealityRepositoryObservationIssueはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealityRepositoryObservationIssueの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealityRepositoryObservationIssue = Readonly<{
  code: string;
  path: string;
  reason: string;
}>;

/**
 * RealitySymbolRepositoryObservationが扱う値の構造を表す。
 *
 * @responsibility RealitySymbolRepositoryObservationに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape RealitySymbolRepositoryObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealitySymbolRepositoryObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealitySymbolRepositoryObservationの宣言は外部境界を開かない。
 * @security N/A: RealitySymbolRepositoryObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealitySymbolRepositoryObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealitySymbolRepositoryObservation = Readonly<{
  manifests: readonly LoadedRealitySymbolManifest[];
  knownArchIds: ReadonlySet<string>;
  knownQaIds: ReadonlySet<string>;
  knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>;
  domainIssues: readonly DomainIssue[];
  repositoryIssues: readonly RealityRepositoryObservationIssue[];
}>;

/**
 * observeRealitySymbolRepositoryの処理を実行する。
 *
 * @responsibility observeRealitySymbolRepositoryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input capability: VerifiedRepositoryRoot
 * @returns RealitySymbolRepositoryObservationを返す。
 * @precondition 「capability: VerifiedRepositoryRoot」がobserveRealitySymbolRepositoryの入力契約を満たす。
 * @postcondition observeRealitySymbolRepositoryの責務を完了した結果だけを返す。
 * @effect N/A: observeRealitySymbolRepositoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure observeRealitySymbolRepositoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeRealitySymbolRepositoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security observeRealitySymbolRepositoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeRealitySymbolRepositoryは共有非同期状態を持たない同期処理である。
 */
export function observeRealitySymbolRepository(
  capability: VerifiedRepositoryRoot,
): RealitySymbolRepositoryObservation {
  const repository = createFilesystemRepositoryObservationPort(capability);
  const repositoryIssues: RealityRepositoryObservationIssue[] = [];
  const recordIssue = (code: string, path: string, reason: string): void => {
    repositoryIssues.push({ code, path, reason });
  };
  const identities = (directoryPath: string, pattern: RegExp) => {
    const observed = repository.observeDirectory(directoryPath);
    if (observed.status !== "resolved") {
      recordIssue(
        "reality-symbol-canonical-definitions-unobservable",
        directoryPath,
        observed.reason,
      );
      return new Set<string>();
    }
    return new Set(
      observed.entries
        .filter(({ kind, name }) => kind === "directory" && pattern.test(name))
        .map(({ name }) => name),
    );
  };
  const knownArchIds = identities(
    "06_Architecture/Definitions",
    /^ARCH-[0-9]{6}$/u,
  );
  const knownQaIds = identities("07_Quality/Definitions", /^QA-[0-9]{6}$/u);
  const knownLocalTestIdsByQaId = new Map<string, ReadonlySet<string>>();
  for (const qaId of [...knownQaIds].sort()) {
    const definitionPath = `07_Quality/Definitions/${qaId}/quality_definition.md`;
    const observed = repository.observeFile(definitionPath);
    if (observed.status !== "resolved") {
      recordIssue(
        "reality-symbol-quality-definition-unobservable",
        definitionPath,
        observed.reason,
      );
      continue;
    }
    const heading = /^## [0-9]+\. 検証項目\s*$/mu.exec(observed.source);
    const remainder = heading
      ? observed.source.slice(heading.index + heading[0].length)
      : "";
    const nextHeading = remainder.search(/^##\s/mu);
    const section =
      nextHeading >= 0 ? remainder.slice(0, nextHeading) : remainder;
    const localIds = new Set<string>();
    for (const line of section.split(/\r?\n/u)) {
      const match = /^\|\s*`([^`]+)`\s*\|/u.exec(line);
      if (match?.[1]) localIds.add(match[1]);
    }
    knownLocalTestIdsByQaId.set(qaId, localIds);
  }

  const develop = repository.observeDirectory("40_Develop");
  if (develop.status !== "resolved")
    return {
      manifests: [],
      knownArchIds,
      knownQaIds,
      knownLocalTestIdsByQaId,
      domainIssues: [],
      repositoryIssues: [
        ...repositoryIssues,
        {
          code: "reality-symbol-develop-unobservable",
          path: "40_Develop",
          reason: develop.reason,
        },
      ],
    };

  const sources = [];
  for (const entry of develop.entries) {
    if (entry.kind === "symbolic-link") {
      recordIssue(
        "reality-symbol-subsystem-boundary-invalid",
        `40_Develop/${entry.name}`,
        "Subsystem is a symbolic link or junction.",
      );
      continue;
    }
    if (entry.kind !== "directory") continue;
    const subsystemPath = `40_Develop/${entry.name}`;
    const subsystem = repository.observeDirectory(subsystemPath);
    if (subsystem.status !== "resolved") {
      recordIssue(
        "reality-symbol-subsystem-observation-failed",
        subsystemPath,
        subsystem.reason,
      );
      continue;
    }
    const manifestPath = `${subsystemPath}/symbol.json`;
    if (!subsystem.entries.some(({ name }) => name === "symbol.json")) {
      recordIssue(
        "reality-symbol-manifest-missing",
        manifestPath,
        `Subsystem ${entry.name} does not provide symbol.json.`,
      );
      continue;
    }
    const manifest = repository.observeFile(manifestPath);
    if (manifest.status !== "resolved") {
      recordIssue(
        "reality-symbol-manifest-observation-failed",
        manifestPath,
        manifest.reason,
      );
      continue;
    }
    const symbolSources = new Map<string, string>();
    try {
      const validated = validateRealitySymbolManifest(
        JSON.parse(manifest.source),
        manifestPath,
      );
      for (const symbol of validated.result?.symbols ?? []) {
        const observed = repository.observeFile(
          `${subsystemPath}/${symbol.path}`,
        );
        if (observed.status === "resolved")
          symbolSources.set(symbol.path, observed.source);
      }
    } catch {
      // Domain discovery reports malformed JSON without inventing symbols.
    }
    sources.push({
      subsystem: entry.name,
      subsystemPath,
      manifestPath,
      manifestSource: manifest.source,
      symbolSources,
    });
  }
  const discovered = discoverRealitySymbols({
    sources,
    prerequisiteIssues: [],
  });
  return {
    manifests: discovered.result?.manifests ?? [],
    knownArchIds,
    knownQaIds,
    knownLocalTestIdsByQaId,
    domainIssues: discovered.issues,
    repositoryIssues,
  };
}
