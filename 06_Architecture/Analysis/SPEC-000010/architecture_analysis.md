# SPEC-000010のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000010`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000010 Repositoryと実行対象のBindingを解決する](../../../05_SPEC/Definitions/SPEC-000010/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

Repositoryと実行対象のBindingを解決する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 手元のRepositoryで作業を開始し対象を選ぶ時 |
| 事前条件 | 開始PathからRepository境界を一意に検証できる |
| Authority | 現在Repositoryで作業する主体。別RepositoryへのAuthorityは発行しない |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

### 振る舞い・状態・結果

```text
[開始Path] -> [Repository Root検証] -> [Repository／Project／Binding解決]
  └--曖昧／不正--> [Effect 0]
```

- 振る舞い: 検証済みRepository Root、Repository ID、Project ID、Binding、現在改訂版を区別して対象を解決する。
- 成功条件: 横断機能やCommit済み状態がなくてもRepository-local作業を開始できる。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: 名前やPath類似から別Repositoryを選ばず、曖昧時はEffect 0で停止する。
- 副作用: 対象解決は読取り専用で、Repository・worktree・Git状態を変更しない。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 横断機能やCommit済み状態がなくてもRepository-local作業を開始できる |
| 境界 | 検証済みRoot／隣接Root、Binding一意／曖昧を分け、別Repositoryを選ばない |
| 失敗 | 名前やPath類似から別Repositoryを選ばず、曖昧時はEffect 0で停止する |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「対象解決は読取り専用で、Repository・worktree・Git状態を変更しない」と矛盾する結果を返さない |
| 対応UI | [UI-000006](../../../04_UI/Definitions/UI-000006/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [Repository境界とBindingのArchitecture定義](../../Definitions/repository-binding/architecture_definition.md) | Version Control PortとRepository Binding Resolver | 現在Repositoryで作業する主体。別RepositoryへのAuthorityは発行しない | 対象解決は読取り専用で、Repository・worktree・Git状態を変更しない。 | 名前やPath類似から別Repositoryを選ばず、曖昧時はEffect 0で停止する。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Repository境界とBinding](../../Definitions/repository-binding/architecture_definition.md) | Same | verified／unverified／ambiguous／unavailableを分け、local／cross-sourceの対象範囲を明示する。GitはAdapterの一実装であり、未Commitを理由に通常利用を拒否しない。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000006
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応UIの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
