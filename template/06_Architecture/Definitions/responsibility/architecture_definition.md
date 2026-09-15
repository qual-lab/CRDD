# 責務名のArchitecture定義

成果物種別: Architecture定義
状態: Candidate
維持責任者: （記入）

## 1. 責務と境界

この定義が所有する責務、所有しない責務、変更理由および失敗を閉じ込める境界を示す。入力固有の状態、Authority、Effect、失敗、lifecycleを共通語へ丸めない。

| 区分 | 内容 |
|---|---|
| 状態Owner | |
| 所有する責務 | |
| 所有しない責務 | |
| 主な外部境界 | |

## 2. UI観点の入力

| UI分析 | この設計で成立させる認識・操作・Feedback |
|---|---|
| [UI-XXXXXX](../../Analysis/UI-XXXXXX/architecture_analysis.md) | |

## 3. SPEC観点の入力

| SPEC分析 | この設計で成立させる振る舞い・結果・Effect |
|---|---|
| [SPEC-XXXXXX](../../Analysis/SPEC-XXXXXX/architecture_analysis.md) | |

## 4. 両観点の統合判断

UI上の約束とSPEC上の振る舞いを、どの責務、状態所有、PortおよびAdapterで同時に成立させるかを示す。一つの入力が独立した複数責務へ関係する場合は、その多対多関係を保持する。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-XXXXXX | UI | | | | | |
| SPEC-XXXXXX | SPEC | | | | | |

## 5. 構造と依存方向

入力ごとのSibling blockと、対象に必要な全体／内部ブロック図を示す。前のblockのAuthority、Effectまたはlifecycleを次のblockへ暗黙に継承しない。

```text
[状態Owner]
├─ [UI-XXXXXX: 利用者が認識・操作する境界]
└─ [SPEC-XXXXXX: 振る舞いと結果を成立させる境界]
```

## 6. データ・状態・Interface

共通するIdentityとDataの関係を示す。ただし状態Owner、AuthorityおよびEffectは入力単位で分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-XXXXXX | | UI契約はAuthorityを発行しない | UI契約はEffectを定義しない |
| SPEC-XXXXXX | | | |

## 7. 失敗・回復・観測

失敗領域、Effect、cleanup、Recovery、終了後観測および診断情報を示す。

## 8. 品質・保護・運用

性能、可用性、セキュリティ、プライバシー、保持、操作および費用のうち適用対象を、入力固有の失敗境界へ接続する。

| 入力 | 保護する失敗境界 | 検証可能性 |
|---|---|---|
| UI-XXXXXX | | |
| SPEC-XXXXXX | | |

## 9. 互換性・移行・成立済み能力

基準版の能力、置換先、移行、切戻しおよび現行構造との照合結果を示す。新規責務には存在しない過去Evidenceを付けない。

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| | | | | | |

## 10. 実装と検証への引き渡し

実装制約、禁止依存、必要な観測点、検証義務および未解決事項を示す。

## 11. 情報源と現行照合

- [UI-XXXXXXのArchitecture分析](../../Analysis/UI-XXXXXX/architecture_analysis.md)
- [SPEC-XXXXXXのArchitecture分析](../../Analysis/SPEC-XXXXXX/architecture_analysis.md)

現行設計と実装は成立済みCapabilityとの比較にだけ使い、UI／SPECにない意味を補わない。
