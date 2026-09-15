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

## 3. Architecture観点の分析

| 設計観点 | SPECから必要になる構造 | Architectureでまだ決めないこと |
|---|---|---|
| Application責務 | | |
| Port・Adapter | | |
| Data・状態所有 | | |
| 外部Effect | | |
| 診断・終了観測 | | |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [責務名](../../Definitions/responsibility/architecture_definition.md) | New／Same | |

## 5. UI観点との統合時に確認すること

SPECが定める契機、結果、Effectおよび失敗が、対応UIから利用者に認識・操作できるかを確認する。
