# UI-XXXXXXのArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-XXXXXX`
状態: Candidate

## 1. 正式入力

- UI定義: [UI-XXXXXX 名称](../../../04_UI/Definitions/UI-XXXXXX/ui_definition.md)

UI定義だけから、利用者が認識・操作・回復できるためにArchitectureが成立させる境界を分析する。SPEC、IA、UX、REQまたは現行実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

| 観点 | 引き継ぐ内容 |
|---|---|
| 利用者が得る結果 | |
| 認識・操作・Feedback | |
| 区別する状態 | |
| 開示・アクセシビリティ | |
| 避ける失敗 | |

## 3. Architecture観点の分析

| 設計観点 | UIから必要になる構造 | Architectureでまだ決めないこと |
|---|---|---|
| 入口・表示面 | | |
| Application境界 | | |
| 状態・観測 | | |
| Authority・開示 | | |
| 失敗・回復 | | |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [責務名](../../Definitions/ARCH-XXXXXX/architecture_definition.md) | New／Same | |

## 5. SPEC観点との統合時に確認すること

UIが必要とする認識、操作、Feedbackおよび状態差が、SPEC由来の発火条件、結果、Effectおよび失敗境界で成立するかを確認する。

## Checklist

結果は`[x]`、未評価は`[ ]`、未完了は`OPEN: 理由`、不適合は`FAIL: 理由`、非該当は`N/A: 理由`で記録する。

- [ ] 自分自身のUI定義だけを正式入力として処置した
- [ ] 利用者が得る結果、認識、操作、Feedbackおよび状態差を保持した
- [ ] Architectureが担う責務と担わない責務を評価した
- [ ] Boundary、主要ComponentおよびInterfaceの必要性を評価した
- [ ] Data／State Ownershipを評価した
- [ ] Authority、Effectおよび開示境界を評価した
- [ ] Failure BoundaryとRecovery責任を評価した
- [ ] Security／TrustとQuality Constraintを評価した
- [ ] Human Inputの必要性を評価した
- [ ] Open／GapとOwner工程へ戻す条件を明示した
- [ ] Verification Intentを評価した
- [ ] 現行Sourceや実装構造から意味を逆輸入していない
- [ ] SPEC観点との統合時に確認する事項を明示した
