/**
 * @packageDocumentation
 * @responsibility 台帳の宣言範囲をGitの追跡済み母集団と登録済み実装・試験に照合する。
 * @trace ARCH-000001
 * @boundary 観測済みの台帳・Manifest・Git一覧だけを使い、追加のI/Oを行わない。
 */
import type {
  LoadedRealitySymbolManifest,
  TestCatalog,
} from "@qual-lab/crdd-document-model";
import type { CheckerFinding } from "../report/types.ts";

function matchesSegment(pattern: string, name: string): boolean {
  const tokens = [...pattern];
  const characters = [...name];
  let token = 0;
  let character = 0;
  let wildcard = -1;
  let consumed = 0;
  while (character < characters.length) {
    if (tokens[token] === "*") {
      wildcard = token++;
      consumed = character;
    } else if (
      tokens[token] === "?" ||
      tokens[token] === characters[character]
    ) {
      token++;
      character++;
    } else if (wildcard !== -1) {
      token = wildcard + 1;
      character = ++consumed;
    } else return false;
  }
  while (tokens[token] === "*") token++;
  return token === tokens.length;
}

function matchesPath(
  pattern: readonly string[],
  segments: readonly string[],
): boolean {
  let reachable = new Set([0]);
  for (const token of pattern) {
    if (reachable.size === 0) return false;
    if (token === "**") {
      const first = Math.min(...reachable);
      reachable = new Set(
        Array.from(
          { length: segments.length - first + 1 },
          (_, next) => first + next,
        ),
      );
    } else {
      const next = new Set<number>();
      for (const index of reachable) {
        const segment = segments[index];
        if (segment !== undefined && matchesSegment(token, segment))
          next.add(index + 1);
      }
      reachable = next;
    }
  }
  return reachable.has(segments.length);
}

export function inspectRealityCoverage(
  catalog: Pick<TestCatalog, "owners" | "tests">,
  manifests: readonly LoadedRealitySymbolManifest[],
  trackedFilePaths: readonly string[] | null,
  add: (finding: CheckerFinding) => void,
): void {
  const optedIn = catalog.owners.filter(
    (owner) => owner.coverage !== undefined,
  );
  if (!optedIn.length) return;
  const warn = (code: string, path: string, message: string) =>
    add({
      severity: "warning",
      code,
      path,
      message,
      rule: "current-profile.reality-coverage",
    });
  if (trackedFilePaths === null) {
    warn(
      "reality-coverage-unobservable",
      ".",
      "Git index paths could not be observed; declared coverage was not checked.",
    );
    return;
  }
  const registeredTests = new Set(catalog.tests.map(({ path }) => path));
  const byOwner = new Map(
    manifests.map((manifest) => [manifest.manifest.subsystem, manifest]),
  );
  const compile = (patterns: readonly string[]) =>
    patterns.map((pattern) => pattern.split("/"));
  for (const { id, root, coverage } of optedIn) {
    if (!coverage) continue;
    const input = byOwner.get(id);
    const symbols = new Set(input?.manifest.symbols.map(({ path }) => path));
    const directories = new Set(input?.directoryPaths);
    const implementation = compile(coverage.implementation);
    const tests = compile(coverage.tests);
    const exclude = compile(coverage.exclude);
    const prefix = `${root}/`;
    if (implementation.length > 0 && input === undefined)
      warn(
        "reality-implementation-coverage-unobservable",
        `${prefix}symbol.json`,
        "A valid manifest could not be observed; implementation coverage was not checked.",
      );
    for (const file of trackedFilePaths) {
      if (!file.startsWith(prefix)) continue;
      const local = file.slice(prefix.length);
      const parts = local.split("/");
      if (exclude.some((pattern) => matchesPath(pattern, parts))) continue;
      if (
        input !== undefined &&
        implementation.some((pattern) => matchesPath(pattern, parts)) &&
        !symbols.has(local) &&
        !parts
          .slice(0, -1)
          .some((_, index) =>
            directories.has(parts.slice(0, index + 1).join("/")),
          )
      )
        warn(
          "reality-implementation-unregistered",
          file,
          "Tracked implementation file is not covered by a symbol declaration.",
        );
      if (
        tests.some((pattern) => matchesPath(pattern, parts)) &&
        !registeredTests.has(file)
      )
        warn(
          "reality-test-unregistered",
          file,
          "Tracked test file is not registered in the test catalog.",
        );
    }
  }
}
