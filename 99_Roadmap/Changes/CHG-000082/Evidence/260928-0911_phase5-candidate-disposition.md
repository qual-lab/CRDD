# Phase 5 変更候補の採否境界

記録日: 2026-09-28
対象変更: `CHG-000082`
対象Phase: `Phase 5 — Production Closure`

## 結論

Workbenchの変更候補は、候補生成とは別の確認・採用・破棄操作へ接続した。Candidate IDだけではCanonical Repositoryを変更できず、現在候補との一致、明示確認、Project RuntimeのCanonical Adoption Lease、現在Revision・dirty・変更範囲の再観測、採用Receiptおよび耐久記録が成立した場合だけ採用する。採用はCommitまたはPushを行わない。

## 成立した境界

```text
変更候補生成
  ↓
未信頼・未採用Candidate ID
  ↓
Candidate Storeから安全なMetadataを再読取り
  ↓
人間が候補ID・基準Revision・変更Pathを確認
  ├→ 保留: Repository／Candidate Store Effect 0
  ├→ 破棄: 別確認後に候補Storeだけを変更
  └→ 採用: Project Runtime Adoption Lifecycle
          ├ 旧Lease所有者処置
          ├ Canonical Adoption Lease
          ├ Revision／dirty／Scope再観測
          ├ exact Candidate採用
          ├ Receipt耐久記録
          └ Lease解放
```

採用確認は外部送信確認を流用しない。候補本文、秘密値、Host Pathおよび採用CapabilityをWorkbenchへ公開しない。

## 検証結果

| 対象 | 結果 | 観測 |
|---|---|---|
| Project Runtime `check` | Pass | Formatter、型、Lintが成立 |
| Project Runtime Unit | 66／66 Pass | 新規採用Application 5件を含む |
| Project Runtime Integration | 5／5 Pass | 既存判断Lifecycleに回帰なし |
| Coordinator `check` | Pass | Formatter、型、Lint、Runtime Capability Graph、Runtime TraceabilityおよびProject Runtime Design Traceabilityが成立 |
| Candidate Adapter局所IT | 1／1 Pass | 公開済み候補のIdentity固定、現在観測、採用を実Repository fixtureで確認 |
| Workbench `check` | Pass | Formatter、型、Lintが成立 |
| Workbench直接境界IT | 18／18 Pass | 確認情報表示、未確認採用、別Candidate ID、確認済み採用・破棄を確認 |
| Root Checker | Error 1／Warning 0 | ErrorはFeature Branch HEADと公開済み`v0.21.0` tagの既知不一致だけ |

## 残る範囲

- 実Codex／Claudeで生成した候補を使う署名済みProvider E2Eは未実施である。
- 変更候補を採用した後のCommit／Pushは、既存Repository Workの別操作として扱う。
- 全回帰、Symbol／Test Catalog追随および独立レビューはPhase 5の固定候補で実施する。

## Checklist

- [x] 候補生成と採用Authorityを分離した。
- [x] 未確認、別Candidate IDおよびRevision／Scope不一致を成功へ畳まない。
- [x] 採用Effect、cleanup不明およびRecoveryを公開結果へ保持した。
- [x] 採用をCommitまたはPushへ拡張していない。
- [x] 局所回帰を実施した。
- [x] 実Provider E2Eを実施済みと誤記していない。
