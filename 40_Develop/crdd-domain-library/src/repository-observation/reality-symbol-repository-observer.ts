import type { DomainIssue } from "../outcome.ts";
import {
  discoverRealitySymbols,
  type LoadedRealitySymbolManifest,
  validateRealitySymbolManifest,
} from "../reality-traceability/index.ts";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/repository-identity/index.ts";
import { createFilesystemRepositoryObservationPort } from "./index.ts";

export type RealityRepositoryObservationIssue = Readonly<{
  code: string;
  path: string;
  reason: string;
}>;

export type RealitySymbolRepositoryObservation = Readonly<{
  manifests: readonly LoadedRealitySymbolManifest[];
  knownArchIds: ReadonlySet<string>;
  knownQaIds: ReadonlySet<string>;
  knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>;
  domainIssues: readonly DomainIssue[];
  repositoryIssues: readonly RealityRepositoryObservationIssue[];
}>;

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
