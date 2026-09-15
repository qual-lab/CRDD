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

## 2. 全件処置

| Source ID | 成功の意味 | 失敗／Riskと検証義務 | 統合先の検証目標 | 試験段階 | 試験種別 | 処置状態 |
|---|---|---|---|---|---|---|
| `<Canonical IDへのLink>` | `<この工程が成立したと判断できる利用者・業務・System上の結果>` | `<防ぐ失敗と、何を確認する必要があるか>` | `<QA-IDのQuality定義へのLinkまたは候補名>` | `<UT／IT／ST／UAT>` | `<Functional／State／Fault等>` | `Mapped／Gap／N/A` |

対象工程のCanonical集合は、各IDを一行以上で処置する。同じIDに複数の独立した検証義務がある場合は複数行に分ける。Quality側で合否を組み立てられない場合は推測で補わず、Source工程を再開する。

## 3. 検証目標への統合

| Source ID | 検証目標 | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|---|
| `<Canonical IDへのLink>` | `<QA-IDのQuality定義へのLink>` | `<Source固有の成立条件。共通目標名へ置換しない>` | `<UT／IT／ST／UAT>` | `<各試験段階を満たすDefinition内Local ID>` |

全件処置に示す試験段階は、複数の検証目標へ分けた各関係の試験段階の和集合と一致させる。各関係は、同じ試験段階のLocal Itemを一件以上持つ。

## 4. 未解決事項

- Canonical母集団: `<件数と導出元>`
- 処置済み: `<件数>`
- Gap／N/A: `<件数と理由>`
- Source工程へ戻す事項: `<なし／判定不能な成立条件>`
- Quality Integrationへ渡す事項: `<検証目標候補、状態、観測、終了後条件>`
