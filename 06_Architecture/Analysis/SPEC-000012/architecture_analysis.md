# SPEC-000012のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000012`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000012 接続資格からWorkspace利用範囲を確定する](../../../05_SPEC/Definitions/SPEC-000012/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

接続資格からWorkspace利用範囲を確定する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | リモート接続を開始または再接続する時 |
| 事前条件 | 接続資格を検証でき、WorkspaceとRepository Exposureが現行である |
| Authority | Credential発行時に固定されたWorkspace Grant。管理Capabilityと内容Grantを分離する |
| 判定不能 | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する |

### 振る舞い・状態・結果

```text
[未認証] -> [Credential検証] -> [Session＋Workspace Grant]
  ├ current -> [利用可能範囲]
  └ stale／invalid -> [拒否・存在非開示]
```

- 振る舞い: 接続資格を検証し、現在有効なWorkspace GrantとRepository Exposureから利用可能範囲を確定する。
- 成功条件: System管理能力と内容閲覧権限を別に判定する。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: 未許可対象の存在を漏らさず、古いGrantや一律Unlockを受理しない。
- 副作用: 認証済みSessionとGrantを作成・更新する。未Exposure Repositoryへ読取りEffect 0。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | System管理能力と内容閲覧権限を別に判定する |
| 境界 | 有効／期限切れCredential、Exposureあり／なしを分け、非開示対象の存在を返さない |
| 失敗 | 未許可対象の存在を漏らさず、古いGrantや一律Unlockを受理しない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「認証済みSessionとGrantを作成・更新する。未Exposure Repositoryへ読取りEffect 0」と矛盾する結果を返さない |
| 対応UI | [UI-000008](../../../04_UI/Definitions/UI-000008/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [Workspace利用範囲とRepository FederationのArchitecture定義](../../Definitions/workspace-access-federation/architecture_definition.md) | CROS Session／Workspace Resolver | Credential発行時に固定されたWorkspace Grant。管理Capabilityと内容Grantを分離する | 認証済みSessionとGrantを作成・更新する。未Exposure Repositoryへ読取りEffect 0。 | 未許可対象の存在を漏らさず、古いGrantや一律Unlockを受理しない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Workspace利用範囲とRepository Federation](../../Definitions/workspace-access-federation/architecture_definition.md) | Same | credential_required／restricted／unavailable／unknownを区別し、Credential→Session→Workspace Grant→Exposure→Repositoryの順で利用範囲を決める。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000008
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応UIの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
