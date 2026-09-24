# SPEC-XXXXXXのArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-XXXXXX`
状態: Candidate

## 1. 正式入力

- SPEC定義: [SPEC-XXXXXX 名称](../../../05_SPEC/Definitions/SPEC-XXXXXX/spec_definition.md)

SPEC定義だけから、振る舞いを実現する責務、状態、Effect、失敗および検証境界を分析する。UI、IA、UX、REQまたは現行実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

| 観点 | 引き継ぐ内容 |
|---|---|
| 契機・事前条件 | |
| Authority | |
| 状態・結果 | |
| Effect・外部境界 | |
| 失敗・回復 | |
| 検証義務 | |
| 未確認事項・人間判断 | |
| Verification Intent | |

## 3. Architecture観点の分析

| 設計観点 | SPECから必要になる構造 | Architectureでまだ決めないこと |
|---|---|---|
| Application責務 | | |
| Port・Adapter | | |
| Data・状態所有 | | |
| 外部Effect | | |
| 診断・終了観測 | | |

### 観点別評価

| 観点 | 判定 | 根拠・引渡し |
|---|---|---|
| Responsibility | 評価済み／OPEN／FAIL | |
| Boundary／Component／Interface | 評価済み／OPEN／FAIL | |
| Data／State Ownership | 評価済み／OPEN／FAIL | |
| Failure／Recovery | 評価済み／OPEN／FAIL | |
| Security／Trust | 評価済み／OPEN／FAIL | |
| Quality Constraint | 評価済み／OPEN／FAIL | |
| Human Input | なし／継承あり／OPEN | |
| Open／Gap | なし／上流確認を継承／OPEN／FAIL | |
| Verification Intent | 評価済み／OPEN／FAIL | |

Human Inputがある場合は、判断者、現在判定、未確認時の影響および再評価契機を記録する。Architectureは上流の未確認事項を解消済みにしない。

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [責務名](../../Definitions/ARCH-XXXXXX/architecture_definition.md) | New／Same | |

## 5. UI観点との統合時に確認すること

SPECが定める契機、結果、Effectおよび失敗が、対応UIから利用者に認識・操作できるかを確認する。

## Checklist

結果は`[x]`、未評価は`[ ]`、未完了は`OPEN: 理由`、不適合は`FAIL: 理由`、非該当は`N/A: 理由`で記録する。

- [ ] 自分自身のSPEC定義だけを正式入力として処置した
- [ ] 契機、事前条件、Authority、状態、結果およびEffectを保持した
- [ ] Architectureが担う責務と担わない責務を評価した
- [ ] Boundary、主要ComponentおよびInterfaceの必要性を評価した
- [ ] Data／State Ownershipを評価した
- [ ] External Boundaryと終了後観測を評価した
- [ ] Failure BoundaryとRecovery責任を評価した
- [ ] Security／TrustとQuality Constraintを評価した
- [ ] Human Inputの必要性を評価した
- [ ] Open／GapとOwner工程へ戻す条件を明示した
- [ ] Verification Intentを評価した
- [ ] 現行Sourceや実装構造から意味を逆輸入していない
- [ ] UI観点との統合時に確認する事項を明示した
