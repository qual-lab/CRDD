/**
 * 選択Repositoryの成果物原文を実HTTPで検証する。
 * @packageDocumentation
 * @responsibility 出所、入力拒否、現在認可と読取り終了を相関する。
 * @trace RFD-IT-024
 * @trace EST-IT-002
 * @trace EST-IT-010
 * @trace EST-IT-014
 * @level IT
 * @scope 自己生成AM／二Repository→本番Server→閉artifact Model。
 * @boundary 実Browser表示と公開Launcherは別試験。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import test from "node:test";
import { request as httpRequest, ServerResponse } from "node:http";
import {
  createCredentialMaterial,
  type AccessManagementState,
} from "../../../access-management/src/index.ts";
import { deriveRepositoryBindingId } from "../../../access-management/src/state/repository-binding.ts";
import { createFilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import { startWorkbench } from "../../src/index.ts";
import { inspectWorkbenchClientModel } from "../../src/browser/client-model.ts";

/**
 * 同名本文の選択、閉Queryと読取り後の失効／取消を反証する。
 * @responsibility 現在Root外本文・旧認可・遅延読取りを公開しないことを確認する。
 * @trace RFD-IT-024
 * @trace EST-IT-002
 * @trace EST-IT-010
 * @trace EST-IT-014
 * @precondition 検証済みRepository内の自己生成Rootだけ。
 * @stimulus A／B選択、不正入力、Catalog欠測、Link、過大、読取り中の変更・切断。
 * @observation 原文Model、Reader件数、固定拒否、実closeと成功本文件数。
 * @oracle 原文・出所が一致し、不正入力Reader0、読取り後の不成立で本文0。
 * @cleanup 所有Serverをcloseし、exact試験Rootだけ削除する。
 * @boundary Filesystemの途中強制取消を主張せず、Reader終了をjoinする。
 */
test("成果物本文は選択Rootと現在認可に拘束される", async (t) => {
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    import.meta.dirname,
  );
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  fs.mkdirSync(testRoot, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(testRoot, "workbench-artifact-"));
  assert.equal(path.dirname(fixture), testRoot);
  const access = path.join(fixture, "access");
  fs.mkdirSync(access);
  const material = createCredentialMaterial(),
    userId = randomUUID(),
    initialOperationId = randomUUID();
  const state: AccessManagementState = {
    contract: "crdd-access-management/state",
    schemaRevision: 2,
    revision: 1,
    operationId: randomUUID(),
    users: [{ userId, username: "自己生成管理者", role: "administrator" }],
    roleContentAccess: [
      { role: "developer", workspaceIds: ["development"] },
      { role: "manager", workspaceIds: ["development", "management"] },
      { role: "administrator", workspaceIds: ["development"] },
    ],
    credentials: [
      {
        credentialId: material.credentialId,
        userId,
        tokenVersion: 1,
        tokenSalt: material.tokenSalt,
        tokenVerifier: material.tokenVerifier,
        revoked: false,
        operationId: initialOperationId,
        presentation: "confirmed",
      },
    ],
    registeredRepositories: [],
    exposure: [],
    unresolvedKeyExchanges: [],
    initialization: {
      stage: "completed",
      attemptId: initialOperationId,
      initialUserId: userId,
      initialCredentialId: material.credentialId,
      confirmationCredentialId: material.credentialId,
      connection: "confirmed",
    },
  };
  for (const suffix of ["a", "b"]) {
    const target = path.join(fixture, suffix),
      repositoryId = `repo.${suffix}`;
    fs.mkdirSync(target);
    assert.equal(
      spawnSync("git", ["init", "--quiet", target], {
        windowsHide: true,
        encoding: "utf8",
      }).status,
      0,
    );
    fs.mkdirSync(path.join(target, ".crdd", "config"), { recursive: true });
    fs.writeFileSync(
      path.join(target, ".crdd", "config", "repository-manifest.json"),
      JSON.stringify({
        schema: "crdd/repository-manifest/v2",
        projectId: "project.fixture",
        repositoryId,
        displayName: "試験",
        repositoryRole: "development",
        capabilities: [],
        contextSurfaces: [],
        externalSendPolicy: null,
      }),
    );
    fs.writeFileSync(
      path.join(target, "PROJECT_CONTEXT.md"),
      `# Project Context\n\nProject ID: project.fixture\nRepository ID: ${repositoryId}\nRepository Role: development\n` +
        [
          "今どうなっているか",
          "何が危ない、または止まっているか",
          "今、人間が決めることは何か",
          "なぜこの状態・判断になったか",
          "次に何をすべきか",
        ]
          .map(
            (heading, i) =>
              `\n## ${i + 1}. ${heading}\n\n### 結論\n\n自己生成試験。\n\n| 項目 | 内容 |\n|---|---|\n| 試験 | 固定 |\n`,
          )
          .join(""),
    );
    for (const relative of [
      "99_Roadmap/01_Roadmap.md",
      "99_Roadmap/03_Releases.md",
      "07_Quality/01_Quality_Center.md",
      "99_Roadmap/Changes/CHG-000301/change.md",
    ]) {
      const file = path.join(target, ...relative.split("/"));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(
        file,
        `# 原文-${suffix}\n<script>globalThis.__artifactProbe=1</script>\n`,
      );
    }
    state.registeredRepositories.push({
      repositoryId,
      repositoryRoot: target,
      bindingId: deriveRepositoryBindingId(repositoryId, target),
    });
    state.exposure.push({ repositoryId, workspaceIds: ["development"] });
  }
  const current = path.join(access, "access-management.json");
  fs.writeFileSync(current, JSON.stringify(state));
  const root = createFilesystemStoreRoot(access);
  assert.ok(root);
  const handle = await startWorkbench({
    workingDirectory: repositoryRoot,
    localAccessRoot: root,
  });
  const headers = { authorization: `Bearer ${material.token}` };
  /**
   * 成果物HTTP要求へRepository選択と主体を固定して配送する。
   * @responsibility 成果物HTTP要求へRepository選択と主体を固定して配送する。
   * @trace RFD-IT-024
   * @precondition Caseが起動したServerと自己生成二Repository。
   * @stimulus id・route・identityを既存HTTP要求へ渡す。
   * @observation 認証結果、本文状態と対象Artifact。
   * @oracle 別Repository/主体への配送や上限拒否を正常表示に畳まない。
   * @cleanup Serverと所有fixtureの終了はCaseのfinallyで確認する。
   * @boundary 実HTTP→Artifact Reader。外部AIなし。
   */
  const query = (id: string, route: string, identity: string) =>
    `/api/workbench-view?${new URLSearchParams({ repositoryId: id, route, [route === "/change" ? "id" : "path"]: identity })}`;
  try {
    for (const suffix of ["a", "b"])
      for (const [route, identity] of [
        ["/change", "CHG-000301"],
        ["/owner-artifact", "99_Roadmap/01_Roadmap.md"],
      ] as const) {
        const response = await fetch(
          handle.baseUrl + query(`repo.${suffix}`, route, identity),
          { headers },
        );
        assert.equal(response.status, 200);
        const model = inspectWorkbenchClientModel(await response.json());
        assert.equal(model.view, "artifact");
        if (model.view === "artifact") {
          assert.equal(model.repositoryId, `repo.${suffix}`);
          assert.equal(model.selectedRepositoryId, model.repositoryId);
          assert.equal(
            model.artifact.markdown,
            `# 原文-${suffix}\n<script>globalThis.__artifactProbe=1</script>\n`,
          );
        }
      }
    const largeRelative = "99_Roadmap/large.md";
    fs.writeFileSync(
      path.join(fixture, "a", largeRelative),
      `# 大きい変更計画\n${"x".repeat(524289)}`,
    );
    fs.appendFileSync(
      path.join(fixture, "a", "PROJECT_CONTEXT.md"),
      `\n[変更計画](${largeRelative})\n`,
    );
    fs.copyFileSync(
      path.join(repositoryRoot, "99_Roadmap", "03_Releases.md"),
      path.join(fixture, "a", "99_Roadmap", "03_Releases.md"),
    );
    const main = await (
      await fetch(`${handle.baseUrl}/api/workbench-view?repositoryId=repo.a`, {
        headers,
      })
    ).json();
    assert.equal(main.view, "main");
    assert.equal(main.surface.ownerArtifacts.state, "available");
    assert.equal(main.surface.plan.state, "available");
    assert.equal(main.surface.plan.projection.targetVersion, "v0.22.0");
    assert.equal(
      main.surface.ownerArtifacts.artifacts.find(
        (entry: { relativePath: string }) =>
          entry.relativePath === largeRelative,
      )?.title,
      "大きい変更計画",
    );
    assert.equal(
      (
        await fetch(
          handle.baseUrl + query("repo.a", "/owner-artifact", largeRelative),
          { headers },
        )
      ).status,
      403,
    );
    const anonymous = await fetch(
      handle.baseUrl + query("repo.a", "/change", "CHG-000301"),
    );
    assert.equal(anonymous.status, 200);
    assert.equal((await anonymous.json()).view, "access");
    const shell = await fetch(
      `${handle.baseUrl}/change?repositoryId=repo.a&id=CHG-000301`,
    );
    const shellBody = await shell.text();
    assert.match(shellBody, /data-workbench-react-root/u);
    assert.equal(shellBody.includes("原文-a"), false);
    const originalRead = fs.promises.readFile;
    let bodyReads = 0;
    const observe = t.mock.method(
      fs.promises,
      "readFile",
      async (...args: Parameters<typeof originalRead>) => {
        if (
          String(args[0]).startsWith(fixture) &&
          String(args[0]).endsWith(".md")
        )
          bodyReads++;
        return originalRead(...args);
      },
    );
    syncBuiltinESMExports();
    try {
      for (const suffix of [
        "&id=CHG-000301",
        "&path=a.md",
        "&route=%2Fowner-artifact",
        "&repositoryId=repo.b",
        "&unknown=x",
      ]) {
        const response = await fetch(
          handle.baseUrl + query("repo.a", "/change", "CHG-000301") + suffix,
          { headers },
        );
        assert.equal(response.status, 400);
      }
      for (const identity of [
        "../outside.md",
        "https://example.invalid/a.md",
        "/outside.md",
        "a\\b.md",
        "a.txt",
      ]) {
        const response = await fetch(
          handle.baseUrl + query("repo.a", "/owner-artifact", identity),
          { headers },
        );
        assert.equal(response.status, 400);
      }
      assert.equal(bodyReads, 0);
      const control = await fetch(
        handle.baseUrl + query("repo.a", "/change", "CHG-000301"),
        { headers },
      );
      assert.equal(control.status, 200);
      await control.arrayBuffer();
      assert.ok(bodyReads > 0, "artifact_reader_positive_control");
    } finally {
      observe.mock.restore();
      syncBuiltinESMExports();
    }
    for (const identity of ["not-catalogued.md", "99_Roadmap/unknown.md"]) {
      const response = await fetch(
        handle.baseUrl + query("repo.a", "/owner-artifact", identity),
        { headers },
      );
      assert.equal(response.status, 403);
    }
    const quality = path.join(
        fixture,
        "b",
        "07_Quality",
        "01_Quality_Center.md",
      ),
      savedQuality = fs.readFileSync(quality, "utf8");
    fs.unlinkSync(quality);
    try {
      assert.equal(
        (
          await fetch(
            handle.baseUrl +
              query("repo.b", "/owner-artifact", "99_Roadmap/01_Roadmap.md"),
            { headers },
          )
        ).status,
        403,
      );
    } finally {
      fs.writeFileSync(quality, savedQuality);
    }
    const file = path.join(
        fixture,
        "a",
        "99_Roadmap",
        "Changes",
        "CHG-000301",
        "change.md",
      ),
      savedBody = fs.readFileSync(file, "utf8");
    fs.writeFileSync(file, "x".repeat(524289));
    try {
      assert.equal(
        (
          await fetch(
            handle.baseUrl + query("repo.a", "/change", "CHG-000301"),
            { headers },
          )
        ).status,
        403,
      );
    } finally {
      fs.writeFileSync(file, savedBody);
    }
    const expanded = t.mock.method(
      fs.promises,
      "readFile",
      async (...args: Parameters<typeof originalRead>) => {
        const value = await originalRead(...args);
        return path.resolve(String(args[0])).toLowerCase() ===
          file.toLowerCase()
          ? "x".repeat(524289)
          : value;
      },
    );
    syncBuiltinESMExports();
    try {
      assert.equal(
        (
          await fetch(
            handle.baseUrl + query("repo.a", "/change", "CHG-000301"),
            { headers },
          )
        ).status,
        403,
      );
    } finally {
      expanded.mock.restore();
      syncBuiltinESMExports();
    }
    const outside = path.join(fixture, "outside");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "change.md"), "# 境界外自己生成\n");
    const link = path.join(fixture, "a", "99_Roadmap", "Changes", "CHG-000302");
    fs.symlinkSync(
      outside,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.equal(
      (
        await fetch(handle.baseUrl + query("repo.a", "/change", "CHG-000302"), {
          headers,
        })
      ).status,
      403,
    );
    for (const change of ["credential", "exposure", "manifest"] as const) {
      let entered!: () => void, release!: () => void;
      const started = new Promise<void>((resolve) => {
          entered = resolve;
        }),
        held = new Promise<void>((resolve) => {
          release = resolve;
        });
      let reads = 0;
      const hold = t.mock.method(
        fs.promises,
        "readFile",
        async (...args: Parameters<typeof originalRead>) => {
          const value = await originalRead(...args);
          if (
            path.resolve(String(args[0])).toLowerCase() === file.toLowerCase()
          ) {
            reads++;
            entered();
            await held;
          }
          return value;
        },
      );
      syncBuiltinESMExports();
      const manifest = path.join(
          fixture,
          "b",
          ".crdd",
          "config",
          "repository-manifest.json",
        ),
        oldManifest = fs.readFileSync(manifest, "utf8");
      try {
        const pending = fetch(
          handle.baseUrl + query("repo.a", "/change", "CHG-000301"),
          { headers },
        );
        await started;
        if (change === "manifest") {
          const altered = JSON.parse(oldManifest);
          altered.displayName = "変更中";
          fs.writeFileSync(manifest, JSON.stringify(altered));
        } else {
          const altered = structuredClone(state);
          altered.revision++;
          if (change === "credential") {
            const credential = altered.credentials[0];
            assert.ok(credential);
            credential.revoked = true;
          } else
            altered.exposure = altered.exposure.filter(
              (row) => row.repositoryId !== "repo.b",
            );
          fs.writeFileSync(current, JSON.stringify(altered));
        }
        release();
        const response = await pending;
        assert.equal(response.status, 403);
        assert.equal((await response.text()).includes("原文-a"), false);
        assert.equal(reads, 1);
      } finally {
        release();
        hold.mock.restore();
        syncBuiltinESMExports();
        fs.writeFileSync(current, JSON.stringify(state));
        fs.writeFileSync(manifest, oldManifest);
      }
    }
    let entered!: () => void, release!: () => void, closed!: () => void;
    const started = new Promise<void>((resolve) => {
        entered = resolve;
      }),
      held = new Promise<void>((resolve) => {
        release = resolve;
      }),
      responseClosed = new Promise<void>((resolve) => {
        closed = resolve;
      });
    let successBodies = 0;
    const hold = t.mock.method(
      fs.promises,
      "readFile",
      async (...args: Parameters<typeof originalRead>) => {
        const value = await originalRead(...args);
        if (
          path.resolve(String(args[0])).toLowerCase() === file.toLowerCase()
        ) {
          entered();
          await held;
        }
        return value;
      },
    );
    const originalAssign = ServerResponse.prototype.assignSocket,
      originalEnd = ServerResponse.prototype.end;
    const assign = t.mock.method(
      ServerResponse.prototype,
      "assignSocket",
      function (
        this: ServerResponse,
        ...args: Parameters<typeof originalAssign>
      ) {
        this.once("close", closed);
        return originalAssign.apply(this, args);
      },
    );
    const end = t.mock.method(
      ServerResponse.prototype,
      "end",
      function (this: ServerResponse, ...args: Parameters<typeof originalEnd>) {
        if (this.statusCode === 200 && args[0] !== undefined) successBodies++;
        return originalEnd.apply(this, args);
      },
    );
    syncBuiltinESMExports();
    try {
      const client = httpRequest(
        handle.baseUrl + query("repo.a", "/change", "CHG-000301"),
        { headers },
      );
      client.on("error", () => {});
      client.end();
      await started;
      client.destroy();
      await Promise.race([
        responseClosed,
        new Promise<never>((_, reject) => {
          const timer = setTimeout(
            () => reject(new Error("artifact_response_close_unconfirmed")),
            5000,
          );
          timer.unref();
        }),
      ]);
      release();
      await handle.close();
      assert.equal(successBodies, 0);
    } finally {
      release();
      hold.mock.restore();
      assign.mock.restore();
      end.mock.restore();
      syncBuiltinESMExports();
    }
  } finally {
    await handle.close();
    assert.equal(path.dirname(fixture), testRoot);
    fs.rmSync(fixture, { recursive: true, force: true });
    assert.equal(fs.existsSync(fixture), false);
  }
});
