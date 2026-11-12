/**
 * Package横断のSource試験で宣言を構文木からexactに選択する試験補助。
 * @responsibility コメント位置やFile末尾に依存せず、既存の試験代役へ実宣言だけを渡す。
 * @trace ERB-IT-004
 * @level IT
 * @scope Source構造を直接検査する試験。
 * @boundary 試験内のSource文字列と構文解析。製品入口・実資源・保存を追加しない。
 */
import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { API } from "typescript/unstable/sync";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import {
  isVariableStatement,
  isFunctionDeclaration,
} from "typescript/unstable/ast";

const declarations = new Map<string, ReadonlyMap<string, string>>();

/**
 * 実Sourceの名前付き宣言を型とexportを除いて返す。
 * @responsibility 欠測・重複を拒否し、後続宣言を誤って試験本文へ含めない。
 * @trace ERB-IT-004
 * @precondition 現行Source本文と実在するtop-level宣言名を渡す。
 * @stimulus 構文木から同名宣言を選択する。
 * @observation JavaScriptの単一宣言本文を返す。
 * @oracle File構造の変更で別の関数やexportを取り込まない。
 * @cleanup APIとSnapshotを同じ呼出しで閉じる。Cacheは試験Process内だけ。
 * @boundary Source文字列の局所解析。
 */
export function sourceDeclaration(source: string, name: string): string {
  let indexed = declarations.get(source);
  if (!indexed) {
    const root = path
      .resolve(process.cwd(), ".source-declaration-test")
      .replaceAll("\\", "/");
    const file = `${root}/source.ts`;
    const config = `${root}/tsconfig.json`;
    const api = new API({
      cwd: root,
      fs: createVirtualFileSystem({
        [config]: JSON.stringify({
          files: [file],
          compilerOptions: { noLib: true, noResolve: true, noEmit: true },
        }),
        [file]: source,
      }),
    });
    const snapshot = api.updateSnapshot({ openProjects: [config] });
    try {
      const project = snapshot.getProject(config);
      assert.ok(project);
      const parsed = project.program.getSourceFile(file);
      assert.ok(parsed);
      assert.equal(project.program.getSyntacticDiagnostics(file).length, 0);
      const result = new Map<string, string>();
      for (const statement of parsed.statements) {
        // overloadの型宣言は実行本文ではない。複数の実装宣言は引き続き拒否する。
        if (isFunctionDeclaration(statement) && !statement.body) continue;
        const names = isVariableStatement(statement)
          ? statement.declarationList.declarations.map((declaration) =>
              declaration.name.getText(),
            )
          : "name" in statement && statement.name
            ? [(statement.name as { getText(): string }).getText()]
            : [];
        for (const declarationName of names) {
          assert.equal(result.has(declarationName), false, declarationName);
          result.set(
            declarationName,
            stripTypeScriptTypes(statement.getText()).replace(/^export\s+/, ""),
          );
        }
      }
      indexed = result;
      declarations.set(source, indexed);
    } finally {
      snapshot.dispose();
      api.close();
    }
  }
  const result = indexed.get(name);
  assert.notEqual(result, undefined, `source declaration missing: ${name}`);
  return result as string;
}
