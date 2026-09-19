import fs from "node:fs";
import path from "node:path";

import type {
  LoadedRealitySymbolManifest,
  RealitySymbolFinding,
} from "./symbol-manifest-model.ts";
import { validateRealitySymbolAnnotations } from "./symbol-annotation.ts";
import { validateRealitySymbolManifest } from "./symbol-manifest-validator.ts";
import {
  observeRepositoryDirectory,
  observeRepositoryRegularFile,
} from "./repository-regular-file-observer.ts";

function isContained(root: string, target: string): boolean {
  const relativePath = path.relative(root, target);
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

export function inspectRegularSymbolTarget(
  subsystemRoot: string,
  symbolPath: string,
): Readonly<
  | { status: "resolved"; targetPath: string }
  | { status: "invalid"; reason: string }
  | { status: "unobservable"; reason: string }
> {
  try {
    const canonicalSubsystemRoot = fs.realpathSync.native(subsystemRoot);
    let currentPath = subsystemRoot;
    const segments = symbolPath.split("/");
    for (const [index, segment] of segments.entries()) {
      currentPath = path.join(currentPath, segment);
      const metadata = fs.lstatSync(currentPath);
      if (metadata.isSymbolicLink())
        return {
          status: "invalid",
          reason: "a symbolic link or junction is present in the path",
        };
      const isLastSegment = index === segments.length - 1;
      if (!isLastSegment && !metadata.isDirectory())
        return {
          status: "invalid",
          reason: "an intermediate segment is not a directory",
        };
      if (isLastSegment && !metadata.isFile())
        return {
          status: "invalid",
          reason: "the target is not a regular file",
        };
    }
    const canonicalTargetPath = fs.realpathSync.native(currentPath);
    if (!isContained(canonicalSubsystemRoot, canonicalTargetPath))
      return {
        status: "invalid",
        reason: "the canonical target is outside the subsystem",
      };
    return { status: "resolved", targetPath: canonicalTargetPath };
  } catch {
    return {
      status: "unobservable",
      reason: "the path could not be observed as one stable regular file",
    };
  }
}

function discoverCanonicalIds(
  repositoryRoot: string,
  definitionsRelativePath: string,
  identityPattern: RegExp,
): Readonly<{
  identities: ReadonlySet<string>;
  findings: readonly RealitySymbolFinding[];
}> {
  const definitionsRoot = path.join(
    repositoryRoot,
    ...definitionsRelativePath.split("/"),
  );
  if (!fs.existsSync(definitionsRoot))
    return { identities: new Set(), findings: [] };
  const observation = observeRepositoryDirectory(
    repositoryRoot,
    definitionsRelativePath,
  );
  if (observation.status !== "resolved")
    return {
      identities: new Set(),
      findings: [
        {
          code:
            observation.status === "invalid"
              ? "reality-symbol-canonical-definitions-boundary-invalid"
              : "reality-symbol-canonical-definitions-unobservable",
          path: definitionsRelativePath,
          message: `Canonical Definitions is not a repository-local regular directory: ${observation.reason}.`,
        },
      ],
    };
  try {
    return {
      identities: new Set(
        fs
          .readdirSync(observation.targetPath, { withFileTypes: true })
          .filter(
            (entry) => entry.isDirectory() && identityPattern.test(entry.name),
          )
          .map((entry) => entry.name),
      ),
      findings: [],
    };
  } catch {
    return {
      identities: new Set(),
      findings: [
        {
          code: "reality-symbol-canonical-definitions-unobservable",
          path: definitionsRelativePath,
          message: "Canonical Definitions changed before it could be listed.",
        },
      ],
    };
  }
}

function discoverQualityLocalTestIds(
  repositoryRoot: string,
  definitionsRoot: string,
): Readonly<{
  localTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>;
  findings: readonly RealitySymbolFinding[];
}> {
  const result = new Map<string, ReadonlySet<string>>();
  const findings: RealitySymbolFinding[] = [];
  if (!fs.existsSync(definitionsRoot))
    return { localTestIdsByQaId: result, findings };
  const definitionsObservation = observeRepositoryDirectory(
    repositoryRoot,
    "07_Quality/Definitions",
  );
  if (definitionsObservation.status !== "resolved")
    return {
      localTestIdsByQaId: result,
      findings: [
        {
          code:
            definitionsObservation.status === "invalid"
              ? "reality-symbol-quality-definitions-boundary-invalid"
              : "reality-symbol-quality-definitions-unobservable",
          path: "07_Quality/Definitions",
          message: `Quality Definitions is not a repository-local regular directory: ${definitionsObservation.reason}.`,
        },
      ],
    };
  let definitionEntries: fs.Dirent[];
  try {
    definitionEntries = fs.readdirSync(definitionsObservation.targetPath, {
      withFileTypes: true,
    });
  } catch {
    return {
      localTestIdsByQaId: result,
      findings: [
        {
          code: "reality-symbol-quality-definitions-unobservable",
          path: "07_Quality/Definitions",
          message: "Quality Definitions changed before it could be listed.",
        },
      ],
    };
  }
  for (const entry of definitionEntries) {
    if (!entry.isDirectory() || !/^QA-[0-9]{6}$/u.test(entry.name)) continue;
    const definitionRelativePath = `07_Quality/Definitions/${entry.name}/quality_definition.md`;
    const definitionPath = path.join(
      repositoryRoot,
      ...definitionRelativePath.split("/"),
    );
    if (!fs.existsSync(definitionPath)) {
      result.set(entry.name, new Set());
      continue;
    }
    const observation = observeRepositoryRegularFile(
      repositoryRoot,
      definitionRelativePath,
    );
    if (observation.status !== "resolved") {
      findings.push({
        code:
          observation.status === "invalid"
            ? "reality-symbol-quality-definition-boundary-invalid"
            : "reality-symbol-quality-definition-unobservable",
        path: definitionRelativePath,
        message: `${entry.name} Quality Definition is not a repository-local regular file: ${observation.reason}.`,
      });
      continue;
    }
    const source = observation.source;
    const sectionHeading = /^## [0-9]+\. 検証項目\s*$/mu.exec(source);
    const sectionRemainder = sectionHeading
      ? source.slice(sectionHeading.index + sectionHeading[0].length)
      : "";
    const nextHeadingIndex = sectionRemainder.search(/^##\s/mu);
    const itemSection =
      nextHeadingIndex >= 0
        ? sectionRemainder.slice(0, nextHeadingIndex)
        : sectionRemainder;
    const localTestIds = new Set<string>();
    if (itemSection)
      for (const line of itemSection.split(/\r?\n/u)) {
        const match = line.match(/^\|\s*`([^`]+)`\s*\|/u);
        if (match?.[1]) localTestIds.add(match[1]);
      }
    result.set(entry.name, localTestIds);
  }
  return { localTestIdsByQaId: result, findings };
}

export function discoverRealitySymbolManifests(
  repositoryRoot: string,
): Readonly<{
  manifests: readonly LoadedRealitySymbolManifest[];
  knownArchIds: ReadonlySet<string>;
  knownQaIds: ReadonlySet<string>;
  knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>;
  findings: readonly RealitySymbolFinding[];
}> {
  const findings: RealitySymbolFinding[] = [];
  const canonicalRepositoryRoot = fs.realpathSync.native(repositoryRoot);
  const developRoot = path.join(canonicalRepositoryRoot, "40_Develop");
  const qualityDefinitionsRoot = path.join(
    canonicalRepositoryRoot,
    "07_Quality",
    "Definitions",
  );
  const manifests: LoadedRealitySymbolManifest[] = [];
  const architectureIds = discoverCanonicalIds(
    canonicalRepositoryRoot,
    "06_Architecture/Definitions",
    /^ARCH-[0-9]{6}$/u,
  );
  const qualityIds = discoverCanonicalIds(
    canonicalRepositoryRoot,
    "07_Quality/Definitions",
    /^QA-[0-9]{6}$/u,
  );
  const localTestDiscovery = discoverQualityLocalTestIds(
    canonicalRepositoryRoot,
    qualityDefinitionsRoot,
  );
  findings.push(
    ...architectureIds.findings,
    ...qualityIds.findings,
    ...localTestDiscovery.findings,
  );
  if (!fs.existsSync(developRoot))
    return {
      manifests,
      knownArchIds: architectureIds.identities,
      knownQaIds: qualityIds.identities,
      knownLocalTestIdsByQaId: localTestDiscovery.localTestIdsByQaId,
      findings,
    };
  const developObservation = observeRepositoryDirectory(
    canonicalRepositoryRoot,
    "40_Develop",
  );
  if (developObservation.status !== "resolved")
    return {
      manifests,
      knownArchIds: architectureIds.identities,
      knownQaIds: qualityIds.identities,
      knownLocalTestIdsByQaId: localTestDiscovery.localTestIdsByQaId,
      findings: [
        ...findings,
        {
          code:
            developObservation.status === "invalid"
              ? "reality-symbol-develop-boundary-invalid"
              : "reality-symbol-develop-unobservable",
          path: "40_Develop",
          message: `40_Develop is not a repository-local regular directory: ${developObservation.reason}.`,
        },
      ],
    };
  let subsystemEntries: fs.Dirent[];
  try {
    subsystemEntries = fs
      .readdirSync(developObservation.targetPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .sort((left, right) => left.name.localeCompare(right.name, "en"));
  } catch {
    findings.push({
      code: "reality-symbol-develop-unobservable",
      path: "40_Develop",
      message: "40_Develop changed before its subsystems could be listed.",
    });
    subsystemEntries = [];
  }
  for (const entry of subsystemEntries) {
    const subsystemRelativePath = `40_Develop/${entry.name}`;
    const subsystemObservation = observeRepositoryDirectory(
      canonicalRepositoryRoot,
      subsystemRelativePath,
    );
    if (subsystemObservation.status !== "resolved") {
      findings.push({
        code:
          subsystemObservation.status === "invalid"
            ? "reality-symbol-subsystem-boundary-invalid"
            : "reality-symbol-subsystem-observation-failed",
        path: subsystemRelativePath,
        message: `Subsystem ${entry.name} is not a repository-local regular directory: ${subsystemObservation.reason}.`,
      });
      continue;
    }
    const subsystemRoot = subsystemObservation.targetPath;
    const manifestRelativePath = `${subsystemRelativePath}/symbol.json`;
    const manifestPath = path.join(subsystemRoot, "symbol.json");
    if (!fs.existsSync(manifestPath)) {
      findings.push({
        code: "reality-symbol-manifest-missing",
        path: manifestRelativePath,
        message: `Subsystem ${entry.name} does not provide symbol.json.`,
      });
      continue;
    }
    const manifestObservation = observeRepositoryRegularFile(
      canonicalRepositoryRoot,
      manifestRelativePath,
    );
    if (manifestObservation.status !== "resolved") {
      findings.push({
        code:
          manifestObservation.status === "invalid"
            ? "reality-symbol-manifest-boundary-invalid"
            : "reality-symbol-manifest-observation-failed",
        path: manifestRelativePath,
        message: `symbol.json is not a repository-local regular file: ${manifestObservation.reason}.`,
      });
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(manifestObservation.source);
    } catch {
      findings.push({
        code: "reality-symbol-manifest-json-invalid",
        path: manifestRelativePath,
        message: "symbol.json must contain valid JSON.",
      });
      continue;
    }
    const validation = validateRealitySymbolManifest(
      parsed,
      manifestRelativePath,
    );
    findings.push(...validation.findings);
    if (!validation.manifest) continue;
    let isManifestBoundaryValid = true;
    if (validation.manifest.subsystem !== entry.name) {
      findings.push({
        code: "reality-symbol-subsystem-mismatch",
        path: manifestRelativePath,
        message: `Manifest subsystem ${validation.manifest.subsystem} does not match ${entry.name}.`,
      });
      isManifestBoundaryValid = false;
    }
    for (const symbol of validation.manifest.symbols) {
      const targetInspection = inspectRegularSymbolTarget(
        subsystemRoot,
        symbol.path,
      );
      if (targetInspection.status === "invalid") {
        findings.push({
          code: "reality-symbol-path-boundary-invalid",
          path: manifestRelativePath,
          message: `${symbol.symbolId} has an invalid path ${symbol.path}: ${targetInspection.reason}.`,
        });
        isManifestBoundaryValid = false;
        continue;
      }
      if (targetInspection.status === "unobservable") {
        findings.push({
          code: "reality-symbol-path-observation-failed",
          path: manifestRelativePath,
          message: `${symbol.symbolId} path ${symbol.path} is unobservable: ${targetInspection.reason}.`,
        });
        isManifestBoundaryValid = false;
        continue;
      }
      try {
        const annotationFindings = validateRealitySymbolAnnotations(
          symbol,
          fs.readFileSync(targetInspection.targetPath, "utf8"),
          manifestRelativePath,
        );
        findings.push(...annotationFindings);
        if (annotationFindings.length > 0) isManifestBoundaryValid = false;
      } catch {
        findings.push({
          code: "reality-symbol-path-observation-failed",
          path: manifestRelativePath,
          message: `${symbol.symbolId} path ${symbol.path} changed before its content could be observed.`,
        });
        isManifestBoundaryValid = false;
      }
    }
    if (isManifestBoundaryValid)
      manifests.push({
        manifestPath: manifestRelativePath,
        subsystemRoot,
        manifest: validation.manifest,
      });
  }
  return {
    manifests,
    knownArchIds: architectureIds.identities,
    knownQaIds: qualityIds.identities,
    knownLocalTestIdsByQaId: localTestDiscovery.localTestIdsByQaId,
    findings,
  };
}
