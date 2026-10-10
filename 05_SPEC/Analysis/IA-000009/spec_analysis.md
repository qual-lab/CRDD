# IA-000009のSPEC分析

成果物種別: SPEC分析（IA観点）
分析単位: `IA-000009`
状態: 分析済み（今回変更範囲の限定独立レビュー済み）

## 1. 正式入力

- IA定義: [IA-000009](../../../03_IA/Definitions/IA-000009/ia_definition.md)

この一件だけを正式入力とする。他観点、REQ、Sourceから不足を補完せず、定義で初めて両観点を統合する。

## 2. 正式入力から保持する情報構造

| 対象 | 保持する意味・関係 |
|---|---|
| ユーザー | 安定userId、表示専用名、一つの現行Role。同名・改名はIdentity／Authority変更ではない |
| 接続資格 | Credential ID→userId。生Secretを含めず、古いRole権限を固定しない |
| Role／Role詳細権限 | administrator／manager／developer。詳細権限はRoleが所有し、ユーザー・資格への個別追加権限なし |
| Repository Exposure | Repository IDと公開対象範囲。Role権限・実アクセスとは別 |
| 実アクセス可能性 | Repository IDと現在の取得可能性。不明・取得不能を利用可能にしない |
| 接続中の作業単位 | Session ID、Credential ID、userId。認可は現行Roleへ結び直す |
| Repository情報範囲／リポジトリ | Repository IDと情報責務・内容正本。利用者Roleや公開設定ではない |
| 管理能力 | 現行Roleの管理許可。内容閲覧を自動的に得ない |
| Secret表示境界 | 発行／通常リセット後だけ一度表示。永続Identityを作らない |
| 接続資格状態 | 有効／期限切れ／失効／不明。リセット専用の永続状態は作らない |
| Access Recovery | 同じRecovery IDとAdministrator Recovery／Full Access Resetの種別属性 |
| Recovery対象／保持対象／結果 | 種別に結合した対象・Role影響、変更しないProduct Data、結果改訂・再入場先 |

userIdは正式入力の採用済みUUID制約を継承する。版・Schema・生成方式をここで決めない。
ユーザー／Credential／Role権限→Repository Exposure→実アクセス→Repository内容の関係を保持する。管理能力はRoleの別の許可であり、Repository情報責務はこの許可連鎖とは別にRepositoryが所有する。

## 3. 利用場面・状態・導線

| 利用場面 | 対象と状態 | 保持する導線 |
|---|---|---|
| Remote利用 | 自身、資格、現行Role、公開／実アクセス、利用可能／資格要求／制限／利用不能／不明と複数対象の部分成立 | 資格→ユーザー→現行Role権限→公開対象→実アクセス→情報源 |
| 通常管理 | 管理対象ID・表示名・現行Role・資格の有効／期限切れ／失効／不明 | 対象→現行値→変更またはリセットの影響→結果 |
| Host回復 | 両Recovery種別、対象・Role影響・保持・結果、確認待ち／進行中／blocked／completed | Host確認→種別と対象／保持→同じRecovery→Bootstrap再入場 |

認証済み利用者の自身表示、非認証入口へのユーザー情報0、非管理者への他ユーザー一覧・存在・件数0を別々に保持する。Repository非開示対象の存在・名前・件数も漏らさない。
部分成立を全体利用可能にせず、未観測・古い値・競合を正常や不存在へ畳まない。通常リセットのID／Role保持、旧資格拒否と開始済み取消の分離、Role変更の次認可反映を保持する。

Administrator Recovery／Full Access Resetを別種別として扱い、各種別の対象・Role影響・保全・結果・再入場を保持する。通常リセットとHost回復のAuthorityを混同せず、同じRecovery IDを最初の失敗から再入場まで維持する。

## 4. 入力・開示条件・責任

入力のuserId・Credential ID・Role・Repository IDを各関係へ結び、現行の認可と取得可否を別に判定する。名前やPathからIdentityを再構成しない。通常管理とHost Authorityを別に判定し、秘密値を返す境界と通常Metadataを分ける。

情報契約上の管理責任、Host回復責任、Repository内容責任を保持し、Component配置や物理保存方式は決めない。

## 5. 処置と他観点との統合

| 候補 | 処置 | 理由 |
|---|---|---|
| [SPEC-000012](../../Definitions/SPEC-000012/spec_definition.md) | Same | 情報構造を既存の接続・管理・回復責務へ統合する |

UX観点が保持する利用者成果と、対象・状態・可視性・導線を定義で対応付ける。他観点やSourceから不足を補完しない。

## 未確認事項・人間判断・戻り条件

| 継承元 | 未確認事項 | 判断者・再評価契機 | 未確認時の影響 |
|---|---|---|---|
| UX-000013 | 自身表示名と安定ID、現行Role範囲・利用不能理由の理解、接続負担・失敗後の選択 | 代表利用者・Qual-Lab。実利用確認／前提変更時 | 定量条件と具体導線を確定しない |
| UX-000035 | 対象識別とリセット確認の負担、管理画面／CLI分担、有効期限既定値 | 管理者・Host運用者・Qual-Lab。Pilot／回復実測時 | 期限・画面・配布手順を確定しない |
| UX-000035 | Bootstrap-user結合、緊急時ユーザー情報処置 | Host運用者・Qual-Lab。SPEC Detailで処置範囲を具体化する前 | 通常リセットのID保持を緊急回復へ流用しない |

UUIDは採用済み継承制約として保持し、版・生成方式・Schemaはこの工程で決めない。表示名構文・正規化・一意性、物理保存形式も先取りしない。新しい本人確認・自己管理・複数Role・個別追加権限が必要ならDiscovery／UXへ戻す。正式入力の不足や競合は意味のOwnerへ戻し、現行Sourceから補完しない。

## 検証意図

各Objectの同一性・関係、三可視境界、Role／公開／実アクセスの未成立と部分可視、通常リセットと両Host回復種別の差を確認する。種別ごとの対象・Role影響・保全・結果・再入場を検証へ渡し、秘密・Product Dataを保護する。具体試験手順や実装成立を先取りしない。

## 補足分析

なし。

## Checklist

- [x] 正式入力となるIA Definitionを一件だけ特定した
- [x] 利用場面、Object、Identity、Relation、State、Visibilityおよび時間的意味を保持した
- [x] 入力、条件、状態、結果および開示境界を区別した
- [x] 導線、責任、Authorityおよび失敗時に保持する意味を評価した
- [x] SPEC候補への処置と理由を明示した
- [x] UX観点と統合するときの確認事項を明示した
- [x] Human Inputの必要性を評価した
- [x] Open・GapとSPECまたはIAへ戻す条件を明示した
- [x] Verification Intentを評価した
- [x] UX、UI、REQ、ArchitectureまたはSourceから意味を補完していない
- [x] 実装StateまたはUI Presentationを先取りしていない
- [x] 補足分析へ必須情報を退避していない
