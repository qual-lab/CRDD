# SPEC-000016のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000016`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000016 実行時データの配置・保持・清掃を制御する](../../../05_SPEC/Definitions/SPEC-000016/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

実行時データの配置・保持・清掃を制御する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 実行時データを作成・保持・清掃する時 |
| 事前条件 | 検証済みRuntime Root、用途、所有者、耐久性、保持・清掃条件を確認できる |
| Authority | 各領域Ownerに限定した書込みCapability。別用途・別Repositoryへ転用しない |
| 判定不能 | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する |

### 振る舞い・状態・結果

```text
[作成要求] -> [Root／用途検証] -> [保持中]
 -> [清掃可能判定] -> [清掃] -> [不存在確認]
```

- 振る舞い: 検証済みRoot、所有者、用途、耐久性、保持期限、回復要否に従って書込みと処置を制御する。
- 成功条件: Repository-localとOS管理領域を混同せず、終了時に残存義務を確認できる。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: 用途不明の直下書込み、時間だけの削除、別Repositoryへの波及を拒否する。
- 副作用: 許可領域への作成・publish・清掃Effectを発行し、終了後状態を再観測する。
- 応答喪失またはEffect不明では同じ識別情報で再確認し、終了後確認まで回復義務を保持する。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | Repository-localとOS管理領域を混同せず、終了時に残存義務を確認できる |
| 境界 | Repository-local／OS管理Root、耐久／一時、参照中／清掃可能を分ける |
| 失敗 | 用途不明の直下書込み、時間だけの削除、別Repositoryへの波及を拒否する |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「許可領域への作成・publish・清掃Effectを発行し、終了後状態を再観測する」と矛盾する結果を返さない |
| 対応UI | [UI-000011](../../../04_UI/Definitions/UI-000011/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [Runtime Dataの配置・保持・清掃のArchitecture定義](../../Definitions/ARCH-000011/architecture_definition.md) | Runtime Data Contract | 各領域Ownerに限定した書込みCapability。別用途・別Repositoryへ転用しない | 許可領域への作成・publish・清掃Effectを発行し、終了後状態を再観測する。 | 用途不明の直下書込み、時間だけの削除、別Repositoryへの波及を拒否する。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Runtime Dataの配置・保持・清掃](../../Definitions/ARCH-000011/architecture_definition.md) | Same | temporary／durable／recovery_required／cleanup／unknownを用途別に分ける。Repository-local情報を自Repoに集約し、横断CROS状態はOS管理Rootへ分離する。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000011
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応UIの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
