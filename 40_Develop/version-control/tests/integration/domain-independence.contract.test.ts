/**
 * Version Controlの技術契約とDomain Modelとの依存方向を確認する。
 * @responsibility 逆依存の再発と入力検査の意図しない変更を検出する。
 * @trace RCM-IT-004 RFD-IT-029
 * @level IT
 * @scope 公開契約、技術入力検査、Source依存方向。
 * @boundary 同一Processの純粋値とRepository Source。Git変更・外部通信なし。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
const SOURCE_ROOT = path.resolve(import.meta.dirname, "../../src");
/**
 * 全本番Sourceの静的・動的参照から上位Packageへの逆依存を拒否する。
 * @trace RCM-IT-004
 * @precondition 公式srcを読む。
 * @stimulus 全本番Sourceを読み、上位Packageへの参照を走査する。
 * @observation Domain Modelを指す参照の不存在。
 * @oracle 型だけの逆依存や再公開も存在しない。
 * @cleanup N/A: 読取りのみ。
 */
test("Version Controlは型・再公開を含めDomain Modelへ依存しない", () => {
  for (const entry of fs.readdirSync(SOURCE_ROOT, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
    const file = path.join(entry.parentPath, entry.name);
    // Module参照に加え、上位Package名の実装への埋込みも拒否する。
    assert.doesNotMatch(
      fs.readFileSync(file, "utf8"),
      /(?:domain|document|execution|configuration)-model/u,
      file,
    );
  }
});
