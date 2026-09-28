# Phase 5 純粋CSR Runtime閉包検証

検証日時: 2026-09-28 23:54 JST

対象変更: `CHG-000082`

対象固定Tree: `231b4a6f3dff5fbf5869b90fdfc5ce72806ae022`

対象範囲: Workbench Node実行閉包、Browser-only React表示、AI Profile Catalog Revision 0、Coordinator助言Dispatch

## 結論

純粋CSR移行後のNode実行グラフからBrowser専用のReact valueを除外し、Workbench ServerをReact packageなしの署名配布閉包で起動できる構造に戻した。画面DOMのOwnerはBrowser側Reactに維持し、Node側の認証、Authority、Repository EffectおよびJSON Read Model生成はClientへ移していない。

正常な空のRepository AI Profile Storeは検証済み既定Catalogを`revision 0`として返し、同じProfile、ModelおよびRevisionをProduction CompositionからProvider AdapterとExecution Planまで搬送する。最初の採用だけが`revision 1`を公開する。Revision不連続とEnvelope／Schema破損は独立した反証で、どちらも`revision 0`へ縮退せずProvider Effect前に拒否する。

## 境界

```text
Workbench Node Runtime
├ 固定Document Shell
├ JSON Read Model
├ 認証／Authority／Repository Effect
└ AI Profile Store → Composition → Dispatch → Provider Adapter
              ×
       Browser-only React value

Browser
└ React Client
   ├ 表示Component
   └ JSON Runtime Inspection
```

## 検証結果

| 確認対象 | 結果 | 観測 |
|---|---|---|
| Coordinator静的検査 | PASS | Formatter、型検査、Lint、Runtime Capability Graph、Runtime Traceability、Project Runtime Design Traceabilityが成功 |
| Coordinator全Portable回帰 | PASS | 2110件中2105件成功、5件明示Skip、失敗0。所要時間17分43秒 |
| Workbench Build／統合回帰 | PASS | Vite Build、Formatter、型検査、Lintおよび20件全件成功 |
| Node依存閉包 | PASS | `bin/workbench.ts`から`.tsx`、`client/`、`react`、`react/*`への実行時値依存は0 |
| Catalog正常初期状態 | PASS | 空Storeの`revision 0`がProduction Composition、Dispatch、Provider Adapter、Execution PlanまでProfile／Modelと共にexact搬送され、初回採用のみ`revision 1` |
| Catalog不連続反証 | PASS | 有効EnvelopeのRevision 2だけを配置し、不連続だけで`blocked`、`coordinator_ai_profile_snapshot_unavailable`、Executor呼出し0 |
| Catalog破損反証 | PASS | 連続するRevision 1に不正Envelopeを配置し、Schema破損だけで同じ`blocked`、Executor呼出し0 |
| Browser JSON境界 | PASS | 通常Snapshotと操作結果Snapshotの両方でRevision 0を受理し、負数と小数を描画前に拒否 |
| Repository Checker | PASS WITH EXPECTED FEATURE-BRANCH FINDING | 今回差分由来のFindingは0。公式v0.21.0 Tagと作業Branch HEADの差を示す`stable-release-tag-identity-mismatch`のみ |
| 独立レビュー | PASS | 固定Tree、Index、Worktreeの一致を確認し、Finding 0 |
| 文書監査 | PASS | 表構造、現在状態、次処置、23件の影響File収録およびリンクを確認し、Finding 0 |
| Gap／Impact監査 | PASS | 正常、不連続、破損、Node閉包、QA Local Item、CHG伝播を確認し、Finding 0 |

## 検出と是正

旧署名候補の直接起動で、Node実行グラフがReact rendererへ到達することと、正常な空StoreのCatalog Revision 0をExecution Planが拒否することを検出した。表示値をBrowser-only Componentへ移し、Node側はデータとApplication境界だけを公開した。Catalog Revisionは0以上のsafe integerに固定し、負数、小数および不正Storeを拒否した。

初回の反証試験はRevision 2の不連続と破損Envelopeを一つのfixtureに重ね、先にRevision不連続で停止していた。不連続fixtureを有効Envelopeへ変更し、連続Revision 1の破損Envelopeを別fixtureへ分離した。これにより、異なる原因による二つの停止経路を独立に観測した。

## 保持した境界

- Node側からBrowser Client／React valueへの実行時依存を戻さない。
- 認証、Authority、Provider EffectおよびRepository EffectをBrowser側へ移さない。
- 破損、不連続または観測不能のStoreを`revision 0`へ畳まない。
- ProfileとCatalog Revisionを別のSnapshotから解決しない。
- Provider、Model、Offering、Repository非共有およびfallback禁止を緩和しない。
- SSR、Hydration、Node DOM所有およびRaw HTML Fragment生成を再導入しない。

## 残るRelease Verification Gate

- 本TreeをCommitし、新しい配布TreeとしてCoordinator Runtimeを再署名する。
- 再署名した候補からWorkbench Serverを直接起動する。
- Codex／Claudeの読取り助言を署名実Provider E2Eで確認する。
- 必要な四経路E2Eを同じRelease Identityで閉じる。

## Checklist

- [x] 固定Treeと実行した検証を結合した。
- [x] NodeとBrowserのOwner境界を直接反証した。
- [x] Revision 0の正常経路と破損／不連続の拒否経路を分離した。
- [x] 全Portable回帰を完了した。
- [x] 独立レビュー、文書監査、Gap／Impact監査を同じ固定Treeで完了した。
- [x] 再署名、直接起動、実Provider E2Eを未実施のGateとして保持した。
