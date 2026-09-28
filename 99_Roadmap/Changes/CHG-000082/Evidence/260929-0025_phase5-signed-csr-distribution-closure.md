# Phase 5 署名CSR配布閉包

記録日時: 2026-09-29 00:25 JST

対象Change: [CHG-000082](../change.md)

対象範囲: 純粋CSR Workbenchの署名Source Tree、固定Browser Bundle、直接起動前の配布閉包

## 結論

純粋CSRのSource実装とNode依存閉包は成立していたが、最初の署名Source TreeにはVite生成済みBrowser Bundleが含まれていなかった。その署名候補はWorkbenchを直接起動できないためRelease Evidenceへ使用しない。

固定BundleをSource Commitと署名対象Treeへ収載する設計へ改め、Build結果とGit追跡集合を検査する契約試験を追加した。修正後のWorkbench局所回帰は21／21 Passである。現在確認できたのは未Commit候補のBuild／Git追跡契約までであり、独立確認、Commit、再署名、署名Tree収載および署名候補の直接起動が残る。

## 検出した不一致

```text
React／TypeScript Source
        ↓ Vite Build
local dist/client/assets/workbench-client.js      present
        ↓ Git archive
signed distribution tree                         absent
        ↓ Workbench startup
workbench_client_asset_unavailable                unavoidable
```

| 項目 | 観測結果 | 判定 |
|---|---|---|
| 署名Source | `e4315a4843ffbb3fc489aff469eeec8e33c6f2b7` | 署名自体は成功 |
| 署名Tree | `e425e2ec1464787aa97e862faf0f11e95eddcd40` | Browser Bundleを含まないため配布閉包として不採用 |
| Runtime Execution Identity | `0c291ca19d1e35025e0451c07bfbd1db0a2aeef78eb8038cc86d80520f816978` | 後続候補へ流用しない |
| Repository側Bundle | 存在 | Build結果だけでは署名Tree収載を保証しない |
| 署名staging側Bundle | 不存在 | 直接起動Gateを開始せず是正へ戻した |

## 是正

- `40_Develop/workbench/dist/client/assets/workbench-client.js`を固定生成AssetとしてGit追跡集合へ追加した。
- Browser Bundleを設計正本へ昇格せず、React／TypeScript Sourceから再生成できる署名配布Artifactとして扱う。
- `workbench-node-dependency-closure.contract.test.ts`へ、固定Bundleの存在とGit追跡集合への収載を確認する試験を追加した。
- Node Serverは引き続きReact／React DOMをRuntime value依存に含めない。
- 署名後のstagingへ未追跡Assetを追加してTree Identityを変える経路は採用しない。

## 検証結果

| 検証 | 結果 |
|---|---|
| Vite production build | PASS — 固定Bundleを生成 |
| Format／Type／Lint | PASS |
| Workbench integration | PASS — 21／21 |
| Node RuntimeのReact依存閉包 | PASS |
| Browser BundleのBuild／Git追跡整合契約 | PASS |
| Browser BundleのSource Commit収載 | PENDING — Commit後に確認 |
| Browser Bundleの署名Tree収載 | PENDING — 再署名後に確認 |

## 未完了Gate

- 修正後固定TreeのCheckerと独立確認
- Source Commit固定とCoordinator Runtime再署名
- 署名stagingからのWorkbench直接起動
- Codex／Claude実Provider E2E
- 同一Release Identityで必要な四経路E2E

## Checklist

- [x] Source成立と配布成立を区別した
- [x] 不採用署名候補を後続Evidenceへ流用していない
- [x] 生成Assetを設計正本へ昇格していない
- [x] 署名後のTree変更を回避した
- [x] 未完了GateをPassへ畳んでいない
