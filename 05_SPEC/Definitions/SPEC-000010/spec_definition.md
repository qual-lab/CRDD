# SPEC-000010 Repositoryと実行対象のBindingを解決する

成果物種別: SPEC定義
SPEC ID: `SPEC-000010`
状態: Canonical
維持責任者: Qual-Lab

## 振る舞いの目的

Repositoryと実行対象のBindingを解決する。

## UX観点の入力

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-000010](../../Analysis/UX-000010/spec_analysis.md) | リポジトリ単独で日常作業を続ける |
| [UX-000011](../../Analysis/UX-000011/spec_analysis.md) | プロジェクト・リポジトリ・基点フォルダを区別して対象を選ぶ |

## IA観点の入力

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-000006](../../Analysis/IA-000006/spec_analysis.md) | Project・Repository・Binding・読取り投影（Projection） |
| [IA-000007](../../Analysis/IA-000007/spec_analysis.md) | 手元の情報源と横断情報源 |

## 両観点の統合判断

手元のRepositoryで作業を開始し対象を選ぶ時、検証済みRepository Root、Repository ID、Project ID、Binding、現在改訂版を区別して対象を解決する。

## 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 手元のRepositoryで作業を開始し対象を選ぶ時 |
| 事前条件 | 開始PathからRepository境界を一意に検証できる |
| Authority | 現在Repositoryで作業する主体。別RepositoryへのAuthorityは発行しない |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

## 振る舞い・状態・結果

```text
[開始Path] -> [Repository Root検証] -> [Repository／Project／Binding解決]
  └--曖昧／不正--> [Effect 0]
```

- 振る舞い: 検証済みRepository Root、Repository ID、Project ID、Binding、現在改訂版を区別して対象を解決する。
- 成功条件: 横断機能やCommit済み状態がなくてもRepository-local作業を開始できる。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

## 失敗・回復・副作用

- 失敗: 名前やPath類似から別Repositoryを選ばず、曖昧時はEffect 0で停止する。
- 副作用: 対象解決は読取り専用で、Repository・worktree・Git状態を変更しない。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

## 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 横断機能やCommit済み状態がなくてもRepository-local作業を開始できる |
| 境界 | 検証済みRoot／隣接Root、Binding一意／曖昧を分け、別Repositoryを選ばない |
| 失敗 | 名前やPath類似から別Repositoryを選ばず、曖昧時はEffect 0で停止する |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「対象解決は読取り専用で、Repository・worktree・Git状態を変更しない」と矛盾する結果を返さない |
| 対応UI | [UI-000006](../../../04_UI/Definitions/UI-000006/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

## 対応するUI

- pairs_with: [UI-000006](../../../04_UI/Definitions/UI-000006/ui_definition.md)

## 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 未確認事項・人間判断・戻り条件

| 項目 | 現在の判断 | 不足時に戻す工程 |
|---|---|---|
| 未確認事項 | なし | UI／SPECまたはOwner工程 |
| 人間判断 | 現在のCanonical範囲では追加判断なし | 判断を所有する工程 |
| 戻り条件 | 正式入力、対応関係または成立条件に不足・競合が見つかった場合 | 不足を所有するUX／IA／UI／SPEC |

## 検証意図

正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。

## 補足定義

なし。

## 情報源

- UX観点: [UX-000010](../../Analysis/UX-000010/spec_analysis.md)、[UX-000011](../../Analysis/UX-000011/spec_analysis.md)
- IA観点: [IA-000006](../../Analysis/IA-000006/spec_analysis.md)、[IA-000007](../../Analysis/IA-000007/spec_analysis.md)

## Checklist

- [x] UX DefinitionとIA Definitionの分析を正式入力として処置した
- [x] UX OutcomeとIA Information Contractを保持した
- [x] Actor・Authority、Trigger、PreconditionおよびInput Validationを評価した
- [x] Current State、Behavior、ResultおよびState Transitionを定義した
- [x] Failure・Error、Retry・Recovery、Cancel・UndoおよびSide Effectを評価した
- [x] ConstraintとNon-goalを評価した
- [x] Human Inputの必要性を評価した
- [x] Open・GapとOwner工程へ戻す条件を明示した
- [x] Verification Intentを明示した
- [x] 対応するUIとのRelationを明示した
- [x] UI Presentation、Architecture方式またはSource実装を先取りしていない
- [x] 結果を観測可能な契約として定義した
- [x] 補足定義へ必須情報を退避していない
