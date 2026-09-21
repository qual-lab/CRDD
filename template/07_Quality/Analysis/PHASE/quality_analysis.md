# <工程>工程のQuality分析

成果物種別: Quality分析（<工程ID prefix>観点）
分析Origin: `<REQ／UX／IA／UI／SPEC／ARCH>`
状態: Draft
維持責任者: `<担当責任者>`

## 1. 目的

この工程が定義した成立条件を全件処置し、成功の意味、失敗またはRisk、検証義務および統合候補を、後から推測せずQuality Integrationへ渡す。

```text
[工程のCanonical Definition]
              ↓
       [成功の意味]
              ↓
       [失敗／Risk]
              ↓
       [検証義務]
              ↓
       [統合候補のQA-ID]
```

## 2. 全件Coverage Index

この表はCanonical IDの処置漏れを防ぐ索引であり、意味分析の正本ではない。Source固有の成立条件、失敗、RiskおよびLocal Itemとの関係は第3章で示す。

| Source ID | 成功の意味 | 検証義務 | 統合先の検証目標 | 試験段階 | 試験種別 | 処置状態 |
|---|---|---|---|---|---|---|
| `<Canonical IDへのLink>` | `<この工程が成立したと判断できる利用者・業務・System上の結果>` | `<防ぐ失敗と、何を確認する必要があるか>` | `<QA-IDのQuality定義へのLinkまたは候補名>` | `<UT／IT／ST／UAT>` | `<Functional／State／Fault等>` | `Mapped／Gap／N/A` |

対象工程のCanonical集合は、各IDを一行で処置する。独立した検証義務の識別、導出元および検証目標ごとの分解は第3章だけで正本化し、このCoverage Indexへ重複保持しない。Quality側で合否を組み立てられない場合は推測で補わず、Source工程を再開する。

## 3. 検証目標への統合

| Source ID | Obligation Key | 導出元 | 検証目標 | 保持する固有条件 | 試験段階 | 外部境界の段階 | 対応Local Item |
|---|---|---|---|---|---|---|---|
| `<Canonical IDへのLink>` | `<局所参照>` | `<Definitionの節、Architecture Model Itemまたは詳細設計の導出キー>` | `<QA-IDのQuality定義へのLink>` | `<Source固有の成立条件。共通目標名へ置換しない>` | `<UT／IT／ST／UAT>` | `<N/A／Direct Boundary／Adjacent 1 Block／Related 2 Blocks／System/E2E／User Acceptance>` | `<各試験段階を満たすDefinition内Local ID>` |

全件処置に示す試験段階は、複数の検証目標へ分けた各関係の試験段階の和集合と一致させる。各関係は、同じ試験段階のLocal Itemを一件以上持つ。

## 4. 必要義務と定義済み項目の差分

| 区分 | 件数 | 対象 | 処置 |
|---|---:|---|---|
| Required - Defined | `<件数>` | `<必要だがLocal ItemがないObligation Key>` | `<Definition追加／上流再開>` |
| Defined - Required | `<件数>` | `<必要性へ戻れないLocal Item>` | `<Legacy／重複／Gap分類>` |
| Level不一致 | `<件数>` | `<必要段階と定義段階が違う組>` | `<Local Item分割／Mapping是正>` |
| Relation不明 | `<件数>` | `<導出元へ戻れない組>` | `<推測せずGap>` |

## 5. 未解決事項

- Canonical母集団: `<件数と導出元>`
- 処置済み: `<件数>`
- Gap／N/A: `<件数と理由>`
- Source工程へ戻す事項: `<なし／判定不能な成立条件>`
- Quality Integrationへ渡す事項: `<検証目標候補、状態、観測、終了後条件>`

## Checklist

結果は`[x]`、未評価は`[ ]`、未完了は`OPEN: 理由`、不適合は`FAIL: 理由`、非該当は`N/A: 理由`で記録する。

- [ ] 対象工程の全Canonical IDを一件以上処置した
- [ ] 各Source固有の成功、境界、失敗、Riskおよび観測不能を分析した
- [ ] 表題や共通定型句ではなくSource固有の検証義務を記録した
- [ ] 意味の近い義務を統合してもSource固有条件を失っていない
- [ ] 各Sourceと検証目標、試験段階およびLocal Itemを接続した
- [ ] 必要検証義務を既存Local ItemやTestから逆算していない
- [ ] Required／Definedの集合差、Level不一致およびRelation不明を評価した
- [ ] 上流の未確認事項をUAT、OPEN義務または上流再開へ処置した
- [ ] 現行Source、TestまたはEvidenceから検証義務を逆算していない
- [ ] 未解決事項、判断者および再評価契機を明示した
