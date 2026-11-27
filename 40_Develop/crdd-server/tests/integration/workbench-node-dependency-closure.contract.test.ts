/**
 * Workbench Node RuntimeのBrowser依存閉包試験。
 *
 * @packageDocumentation
 * @responsibility Node入口から到達するTypeScript依存を列挙し、Browser React実装がServer Runtimeへ混入しないことを検証する。
 * @trace ERB-IT-021
 * @level IT
 * @scope workbench、node-runtime、browser-client、dependency-closure
 * @boundary ERB-IT-021=Direct Boundary: Workbench Node Entrypoint→Local TypeScript Dependency Graph
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(import.meta.dirname, "../..");
const repositoryRoot = path.resolve(packageRoot, "../..");

/**
 * Workbench助言の本番入口を署名資格発行から分離する。
 * @responsibility 単体Repositoryの検証済みRootだけを助言Factoryへ渡すことを確認する。
 * @trace ERB-IT-021
 * @precondition 現在のLauncherと助言Sourceを直接読む。
 * @stimulus 発行import、Factory引数、旧消費依存の残存を検査する。
 * @observation 一引数の本番接続と旧署名Gate名の不存在。
 * @oracle 互換用の資格引数や常時成功Gateを残さない。
 * @cleanup N/A: Source読取りだけでServer・Providerを起動しない。
 * @boundary ERB-IT-021=Direct Boundary: Workbench Launcher→助言Factory。
 */
test("Workbench助言の本番入口は署名発行を注入しない", () => {
  const launcher = readFileSync(
    path.join(packageRoot, "src/cli/command.ts"),
    "utf8",
  );
  const runtime = readFileSync(
    path.join(
      repositoryRoot,
      "40_Develop/coordinator/src/lifecycle/execution.ts",
    ),
    "utf8",
  );
  assert.doesNotMatch(launcher, /issueVerifiedCoordinatorPackageCapability/);
  assert.match(launcher, /session:\s*openTaskSession\(context\)/u);
  assert.match(
    launcher,
    /function resolveLocalAiContext[\s\S]*?rootCapability:\s*verified\.capability,/u,
  );
  assert.match(
    launcher,
    /createAiRequests\(\s*\(\)\s*=>\s*resolveLocalAiContext\(repositoryRoot\)\s*,?\s*\)/u,
  );
  assert.doesNotMatch(
    runtime,
    /consumeVerifiedPackage|verifiedPackageCapability|issueVerifiedPackageCapability|workbench_ai_advice_release_verification_required/,
  );
  assert.match(runtime, /function runRepositoryAdvice\(\s*root: Repository,/);
});

/**
 * Import／Export宣言がRuntime valueを搬送するか判定する。
 *
 * @responsibility type-only宣言を実行時依存へ数えず、default・namespace・value named importを識別する。
 * @trace ERB-IT-021
 * @input Import／Export宣言のmodule clause文字列を受け取る。
 * @returns Runtime value依存ならtrueを返す。
 * @precondition clauseは閉じた宣言Patternから抽出済みである。
 * @stimulus module clauseのRuntime value有無を判定する。
 * @observation value宣言かtype-only宣言かのbooleanを取得する。
 * @oracle Node依存Graphへ型参照だけの辺を追加しない。
 * @cleanup N/A: 文字列だけを同期判定する。
 * @postcondition type-only named集合はfalse、star exportとvalue宣言はtrueになる。
 * @effect N/A: Syntax Treeだけを読む。
 * @failure N/A: 閉じたSyntax種別だけを処理する。
 * @invariant 型参照をNode Runtime依存へ昇格しない。
 * @boundary TypeScript宣言文字列とRuntime依存Graphの境界。
 * @security Source本文を試験結果へ出力しない。
 * @concurrency N/A: 同期純粋判定である。
 */
function carriesRuntimeValue(clause: string): boolean {
  const normalized = clause.trim();
  if (normalized.startsWith("type ")) return false;
  if (!normalized.startsWith("{")) return true;
  const body = normalized.replace(/^\{/u, "").replace(/\}$/u, "");
  return body
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .some((value) => !value.startsWith("type "));
}

/**
 * 一SourceのRuntime module参照を抽出する。
 *
 * @responsibility 静的Import、再Exportおよび文字列Literalのdynamic importを同じ参照集合へ閉じる。
 * @trace ERB-IT-021
 * @input TypeScript／TSX Source File Pathを受け取る。
 * @returns Runtime valueとして到達するmodule specifier集合を返す。
 * @precondition filePathはWorkbench package内の通常Sourceである。
 * @stimulus SourceのImportとExport宣言を抽出する。
 * @observation Runtime module specifierの重複しない集合を取得する。
 * @oracle 非Literal依存を閉じた依存へ推測せず拒否する。
 * @cleanup N/A: Sourceを読み取るだけである。
 * @postcondition type-only宣言を含まず、同一specifierを重複しない。
 * @effect Source Fileを読取る。
 * @failure 非Literal dynamic importまたは閉じない宣言は試験を例外終了する。
 * @invariant dynamic importの非Literal入力を安全なLocal依存として推測しない。
 * @boundary Workbench SourceとDependency Graph試験の境界。
 * @security Source本文を返さない。
 * @concurrency N/A: 一Fileを同期読取りする。
 */
function runtimeSpecifiers(
  filePath: string,
  includeDeferred = true,
): readonly string[] {
  const source = readFileSync(filePath, "utf8");
  const found = new Set<string>();
  const declarations =
    /(?:^|\n)\s*(?:import|export)\s+([\s\S]*?)\s+from\s+["']([^"']+)["']\s*;/gu;
  for (const match of source.matchAll(declarations))
    if (carriesRuntimeValue(match[1] ?? "")) found.add(match[2] ?? "");
  const sideEffects = /(?:^|\n)\s*import\s+["']([^"']+)["']\s*;/gu;
  for (const match of source.matchAll(sideEffects)) found.add(match[1] ?? "");
  const dynamicImports = [...source.matchAll(/\bimport\s*\(/gu)];
  const literalDynamicImports = [
    ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu),
  ];
  if (dynamicImports.length !== literalDynamicImports.length)
    throw new Error("workbench_dynamic_import_not_closed");
  if (includeDeferred)
    for (const match of literalDynamicImports) found.add(match[1] ?? "");
  return Object.freeze([...found]);
}

/**
 * 相対module specifierを既存Source Pathへ解決する。
 *
 * @responsibility Node入口のLocal TypeScript依存だけを再帰対象へ変換する。
 * @trace ERB-IT-021
 * @input importerと相対module specifierを受け取る。
 * @returns 正規化済み絶対Source Pathを返す。
 * @precondition specifierは相対Pathで始まり、拡張子付きである。
 * @stimulus importerから相対参照を解決する。
 * @observation Repository内の正規化済みSource Pathを取得する。
 * @oracle Repository外への参照と拡張子不明を拒否する。
 * @cleanup N/A: Path文字列だけを変換する。
 * @postcondition 解決Pathは現在Repository内に留まる。
 * @effect N/A: Path文字列だけを変換する。
 * @failure Package越境または拡張子なしを例外で拒否する。
 * @invariant Node built-inと外部packageをLocal Sourceへ推測しない。
 * @boundary Module SpecifierとFilesystem Source Identityの境界。
 * @security Repository Root越境を拒否する。
 * @concurrency N/A: 同期純粋変換である。
 */
function resolveLocalSource(importer: string, specifier: string): string {
  const resolved = path.resolve(path.dirname(importer), specifier);
  const relative = path.relative(repositoryRoot, resolved);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !/\.[cm]?[jt]sx?$/u.test(resolved)
  )
    throw new Error("workbench_local_runtime_dependency_invalid");
  return resolved;
}

// 公開名は利用側の宣言、同一Checkoutのリンク、所有側exportsを照合して追跡する。
function resolveOwnedPackage(importer: string, specifier: string) {
  const match = /^(@qual-lab\/crdd-([a-z-]+))(\/[^?#]+)?$/u.exec(specifier);
  if (!match) return undefined;
  const [, name, suffix, subpath] = match;
  assert.ok(name && suffix);
  const directory = name === "@qual-lab/crdd-server" ? "crdd-server" : suffix;
  const consumer = path.relative(repositoryRoot, importer).split(path.sep)[1];
  assert.ok(consumer);
  const consumerRoot = path.join(repositoryRoot, "40_Develop", consumer);
  const ownerRoot = path.join(repositoryRoot, "40_Develop", directory);
  const manifest = JSON.parse(
    readFileSync(path.join(consumerRoot, "package.json"), "utf8"),
  );
  if (consumer !== directory) {
    assert.equal(manifest.dependencies?.[name], `file:../${directory}`);
    assert.equal(
      realpathSync(path.join(consumerRoot, "node_modules", name)),
      realpathSync(ownerRoot),
    );
  }
  const owner = JSON.parse(
    readFileSync(path.join(ownerRoot, "package.json"), "utf8"),
  );
  assert.equal(owner.name, name);
  const entry = owner.exports?.[subpath ? `.${subpath}` : "."];
  const target = typeof entry === "string" ? entry : entry?.import;
  assert.equal(typeof target, "string", specifier);
  return resolveLocalSource(path.join(ownerRoot, "package.json"), target);
}

/**
 * Node Server入口がBrowser React valueをRuntime依存に含めないことを検証する。
 *
 * @responsibility 純粋CSRの配布閉包をSource Graphで反証する。
 * @trace ERB-IT-021
 * @precondition Node入口とLocal TypeScript Sourceが現在のpackageに存在する。
 * @stimulus CLI入口からRuntime value import／exportを再帰走査する。
 * @observation 到達Source集合と外部module specifierを観測する。
 * @oracle Serverへ到達する一方、Client ModelとReact value依存へは到達しない。
 * @cleanup N/A: Sourceを読取るだけである。
 * @boundary ERB-IT-021=Direct Boundary: Workbench Node Entrypoint→Local TypeScript Dependency Graph
 */
test("Workbench Node RuntimeはBrowser React value依存へ到達しない", () => {
  const entry = path.join(packageRoot, "bin", "crdd-server.ts");
  const coordinatorRoot = fileURLToPath(
    import.meta.resolve("@qual-lab/crdd-coordinator"),
  );
  assert.equal(
    coordinatorRoot,
    path.resolve(packageRoot, "../coordinator/src/index.ts"),
  );
  const pending = [entry];
  const visited = new Set<string>();
  const external = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop();
    assert.ok(current);
    if (visited.has(current)) continue;
    visited.add(current);
    for (const specifier of runtimeSpecifiers(current)) {
      if (specifier.startsWith(".")) {
        pending.push(resolveLocalSource(current, specifier));
      } else {
        const owned = resolveOwnedPackage(current, specifier);
        if (owned) pending.push(owned);
        else external.add(specifier);
      }
    }
  }
  assert.ok(visited.has(path.join(packageRoot, "src", "cli", "command.ts")));
  assert.ok(visited.has(path.join(packageRoot, "src", "app.ts")));
  assert.ok(visited.has(coordinatorRoot));
  assert.equal(
    [...visited].some((value) => {
      const relative = path.relative(repositoryRoot, value).split(path.sep);
      return [
        "mcp-server",
        "workbench-server",
        "cros",
        "workbench-ui",
      ].includes(relative[1] ?? "");
    }),
    false,
    "server_has_no_retired_server_or_ui_runtime_dependency",
  );
  assert.equal(
    [...visited].some((value) => value.endsWith(".tsx")),
    false,
  );
  assert.equal(
    [...external].some((specifier) => /^react(?:\/|$)/u.test(specifier)),
    false,
  );
  const eager = new Set<string>();
  // 統合CLIから分離した内部HTTP起動は、MCPを先行ロードしない。
  pending.push(path.join(packageRoot, "src", "app.ts"));
  while (pending.length > 0) {
    const current = pending.pop();
    assert.ok(current);
    if (eager.has(current)) continue;
    eager.add(current);
    assert.ok(
      path.dirname(current) !== path.join(packageRoot, "src", "transport") ||
        !/^(?:mcp-|tools-)/u.test(path.basename(current)),
      "standalone_http_must_not_eagerly_load_mcp",
    );
    for (const specifier of runtimeSpecifiers(current, false)) {
      if (specifier.startsWith("."))
        pending.push(resolveLocalSource(current, specifier));
      else {
        const owned = resolveOwnedPackage(current, specifier);
        if (owned) pending.push(owned);
        else assert.ok(!specifier.startsWith("@modelcontextprotocol/"));
      }
    }
  }
  const transport = path.join(packageRoot, "src", "transport");
  const mcpServer = path.join(transport, "mcp-server.ts");
  const lowerTransport = [mcpServer];
  const visitedTransport = new Set<string>();
  for (
    let current = lowerTransport.pop();
    current !== undefined;
    current = lowerTransport.pop()
  ) {
    if (visitedTransport.has(current)) continue;
    visitedTransport.add(current);
    for (const specifier of runtimeSpecifiers(current)) {
      if (!specifier.startsWith(".")) continue;
      const resolved = resolveLocalSource(current, specifier);
      assert.notEqual(resolved, mcpServer);
      assert.notEqual(resolved, path.join(transport, "api-server.ts"));
      assert.notEqual(resolved, path.join(transport, "api-http.ts"));
      assert.notEqual(resolved, path.join(transport, "api-document.ts"));
      if (path.dirname(resolved) === transport) lowerTransport.push(resolved);
    }
  }
  for (const name of ["mcp-http.ts", "mcp-stdio.ts", "mcp-protocol.ts"])
    assert.ok(visitedTransport.has(path.join(transport, name)), name);
});

/**
 * BrowserがServer実装や別専門PackageのRuntimeへ直接依存しないことを確認する。
 * @responsibility 共有純粋検査と型参照をServer実行から分離する。
 * @trace ERB-IT-021
 * @precondition 現在Client入口と相対Sourceが存在する。
 * @stimulus 既存のRuntime specifier抽出でClientから再帰走査する。
 * @observation Local Sourceの所有Folder、外部Package集合とServer型の参照先。
 * @oracle RuntimeをUI内に閉じ、Server型は型専用のパッケージルートからのみ参照する。
 * @cleanup N/A: Source読取りのみ。Browser・Serverを起動しない。
 * @boundary Browser Build入口からの実行時依存。Canonical型のtype importは維持する。
 */
test("Workbench BrowserはUIパッケージ内だけをRuntimeで参照する", () => {
  const clientRoot = path.join(repositoryRoot, "40_Develop/workbench-ui/src");
  const clientPackageRoot = path.dirname(clientRoot);
  const clientManifest = JSON.parse(
    readFileSync(path.join(clientPackageRoot, "package.json"), "utf8"),
  );
  assert.equal(
    clientManifest.dependencies?.["@qual-lab/crdd-server"],
    undefined,
  );
  assert.equal(
    clientManifest.devDependencies?.["@qual-lab/crdd-server"],
    "file:../crdd-server",
  );
  assert.equal(
    realpathSync(
      path.join(clientPackageRoot, "node_modules/@qual-lab/crdd-server"),
    ),
    realpathSync(packageRoot),
  );
  let serverTypeImports = 0;
  const pending = [path.join(clientRoot, "main.tsx")];
  const visited = new Set<string>();
  const external = new Set([
    "react",
    "react-dom/client",
    "react-router",
    "react-router/dom",
    "@tanstack/react-query",
  ]);
  while (pending.length > 0) {
    const current = pending.pop();
    assert.ok(current);
    if (visited.has(current)) continue;
    visited.add(current);
    assert.ok(
      current.startsWith(clientRoot + path.sep),
      "browser_runtime_owner",
    );
    for (const [, specifier] of readFileSync(current, "utf8").matchAll(
      /\bfrom\s+["'](\.[^"']+|@qual-lab\/crdd-server[^"']*)["']/gu,
    )) {
      assert.ok(specifier);
      if (specifier.startsWith("@qual-lab/")) {
        assert.equal(specifier, "@qual-lab/crdd-server");
        serverTypeImports++;
        continue;
      }
      const target = resolveLocalSource(current, specifier);
      if (target.startsWith(packageRoot + path.sep))
        assert.fail(
          `browser_server_type_must_use_public_package: ${specifier}`,
        );
    }
    for (const specifier of runtimeSpecifiers(current)) {
      if (specifier.startsWith("."))
        pending.push(resolveLocalSource(current, specifier));
      else
        assert.ok(
          external.has(specifier),
          "browser_runtime_external_allowlist",
        );
    }
  }
  assert.ok(visited.has(path.join(clientRoot, "api/response.ts")));
  assert.ok(serverTypeImports > 0);
  assert.ok(visited.has(path.join(clientRoot, "api/repository.ts")));
  assert.ok(visited.has(path.join(clientRoot, "api/queries.ts")));
});

/** @trace ERB-IT-021 パッケージはCLIと型だけを公開し、実装の直接解決を拒否する。 */
test("Serverの公開入口はCLIとクライアント向け型だけに限る", () => {
  const manifest = JSON.parse(
    readFileSync(path.join(packageRoot, "package.json"), "utf8"),
  );
  assert.deepEqual(manifest.exports, {
    ".": { types: "./src/index.ts" },
    "./cli": "./bin/crdd-server.ts",
  });
  assert.equal(
    fileURLToPath(import.meta.resolve("@qual-lab/crdd-server/cli")),
    path.join(packageRoot, "bin", "crdd-server.ts"),
  );
  for (const suffix of ["", "/api", "/mcp", "/src/app.ts", "/src/index.ts"]) {
    assert.throws(() => import.meta.resolve(`@qual-lab/crdd-server${suffix}`), {
      code: "ERR_PACKAGE_PATH_NOT_EXPORTED",
    });
  }
  const types = readFileSync(path.join(packageRoot, "src/index.ts"), "utf8");
  const declarations = types.replace(/\/\*[\s\S]*?\*\//gu, "");
  const namedTypeExports =
    /export type\s*\{([^}]+)\}\s*from\s*"\.\/[^"]+\.ts"\s*;/gsu;
  assert.equal(declarations.replace(namedTypeExports, "").trim(), "");
  assert.deepEqual(
    [...declarations.matchAll(namedTypeExports)]
      .flatMap(([, names]) => (names ?? "").split(","))
      .map((name) => name.trim())
      .filter(Boolean)
      .sort(),
    [
      "AiRequestMode",
      "AiRequestSnapshot",
      "AiResultItem",
      "AiSelectionView",
      "ManagementResult",
      "ManagementView",
      "OwnerArtifactCatalog",
      "ProjectPlanObservation",
      "ProjectQualityObservation",
      "ViewResponse",
    ],
  );
  assert.match(
    stripTypeScriptTypes(types)
      .replace(/\/\*[\s\S]*?\*\//gu, "")
      .trim(),
    /^(?:export\s*\{\s*\};?)?$/u,
  );
});

/**
 * WorkbenchのHTML・CSS・JS配布物がGit Indexと一致することを検証する。
 *
 * @responsibility Vite生成物が固定Pathの通常Fileであり、Git Indexの追跡Blobと同一であることを保証する。
 * @trace ERB-IT-021
 * @precondition Workbench Buildが固定PathへBrowser Bundleを生成済みである。
 * @stimulus BundleのFile種別、Git Index EntryおよびWorking Tree Blobを観測する。
 * @observation 固定Asset Path、Index mode、Index Blob IDおよびWorking Tree Blob IDを取得する。
 * @oracle 固定3ファイルが通常Fileであり、それぞれGit Indexの通常Blobと同一である。
 * @cleanup N/A: FilesystemとGit Indexを読取るだけである。
 * @boundary ERB-IT-021=Direct Boundary: Vite Build Artifact→Git Index
 */
test("WorkbenchのHTML・CSS・JS配布物はGit Indexと一致する", () => {
  for (const file of [
    "index.html",
    "workbench.css",
    "assets/workbench-client.js",
  ]) {
    const relativeAsset = `40_Develop/workbench-ui/dist/client/${file}`;
    const assetPath = path.join(repositoryRoot, ...relativeAsset.split("/"));
    assert.equal(existsSync(assetPath), true, relativeAsset);
    const assetStatus = lstatSync(assetPath);
    assert.equal(assetStatus.isSymbolicLink(), false, relativeAsset);
    assert.equal(assetStatus.isFile(), true, relativeAsset);
    const indexEntry = execFileSync(
      "git",
      [
        "-C",
        repositoryRoot,
        "ls-files",
        "--stage",
        "--error-unmatch",
        "--",
        relativeAsset,
      ],
      { encoding: "utf8", windowsHide: true },
    ).trim();
    const match = /^(100644) ([0-9a-f]{40,64}) 0\t(.+)$/u.exec(indexEntry);
    assert.notEqual(match, null);
    assert.equal(match?.[3], relativeAsset);
    const workingBlob = execFileSync(
      "git",
      ["-C", repositoryRoot, "hash-object", "--no-filters", "--", assetPath],
      { encoding: "utf8", windowsHide: true },
    ).trim();
    assert.equal(workingBlob, match?.[2], relativeAsset);
  }
});
