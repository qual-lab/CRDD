# SPEC-000012 接続資格からWorkspace利用範囲を確定する

成果物種別: SPEC定義
SPEC ID: `SPEC-000012`
状態: Canonical
維持責任者: Qual-Lab

## 振る舞いの目的

接続資格からWorkspace利用範囲を確定する。

## UX観点の入力

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-000013](../../Analysis/UX-000013/spec_analysis.md) | 許可された作業領域だけをリモート利用する |

## IA観点の入力

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-000009](../../Analysis/IA-000009/spec_analysis.md) | 接続資格・作業領域・公開範囲 |

## 両観点の統合判断

リモート接続を開始または再接続する時、接続資格を検証し、現在有効なWorkspace GrantとRepository Exposureから利用可能範囲を確定する。

## 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | リモート接続を開始または再接続する時 |
| 事前条件 | 接続資格を検証でき、WorkspaceとRepository Exposureが現行である |
| Authority | Credential発行時に固定されたWorkspace Grant。管理Capabilityと内容Grantを分離する |
| 判定不能 | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する |

## 振る舞い・状態・結果

```text
[未認証] -> [Credential検証] -> [Session＋Workspace Grant]
  ├ current -> [利用可能範囲]
  └ stale／invalid -> [拒否・存在非開示]
```

- 振る舞い: 接続資格を検証し、現在有効なWorkspace GrantとRepository Exposureから利用可能範囲を確定する。
- 成功条件: System管理能力と内容閲覧権限を別に判定する。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

## 失敗・回復・副作用

- 失敗: 未許可対象の存在を漏らさず、古いGrantや一律Unlockを受理しない。
- 副作用: 認証済みSessionとGrantを作成・更新する。未Exposure Repositoryへ読取りEffect 0。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

## 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | System管理能力と内容閲覧権限を別に判定する |
| 境界 | 有効／期限切れCredential、Exposureあり／なしを分け、非開示対象の存在を返さない |
| 失敗 | 未許可対象の存在を漏らさず、古いGrantや一律Unlockを受理しない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「認証済みSessionとGrantを作成・更新する。未Exposure Repositoryへ読取りEffect 0」と矛盾する結果を返さない |
| 対応UI | [UI-000008](../../../04_UI/Definitions/UI-000008/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

## 対応するUI

- pairs_with: [UI-000008](../../../04_UI/Definitions/UI-000008/ui_definition.md)

## 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 情報源

- UX観点: [UX-000013](../../Analysis/UX-000013/spec_analysis.md)
- IA観点: [IA-000009](../../Analysis/IA-000009/spec_analysis.md)
