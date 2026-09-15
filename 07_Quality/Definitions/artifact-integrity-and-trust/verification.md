# 配布物の完全性と信頼判断の検証定義

成果物種別: Quality定義
検証目標: CRDD準拠、Artifact改ざん有無、Publisher、利用者所有Trust Policyおよび公式識別を独立に評価すること
主な試験段階: Integration／System
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | 保持する固有条件 | 対応Local Item |
|---|---|---|
| [REQ-000018](../../../01_Discovery/Definitions/REQ-000018/requirement.md) | 準拠、改ざん有無、配布者、公式表示を独立結果として返す。一要素のPassから他要素または実行許可を推定しない。公式、組織、手元開発Artifactへ同じ判定モデルを適用する。公式署名、組織署名、改ざん、未署名、準拠不成立を組み合わせ、各結果と最終方針判断を観測する | `AIT-01`、`AIT-04` |
| [REQ-000025](../../../01_Discovery/Definitions/REQ-000025/requirement.md) | 方針の責任者、信頼配布者、用途、期限、例外を明示できる。未知配布者、失効鍵、条件外未署名Buildを外部変更の前に既定拒否する。鍵更新、失効、方針移行後に旧機能が再利用されない。公式、組織、手元、未知、失効、移行中のArtifactを評価し、方針判断、Capability発行、監査記録を観測する | `AIT-01`、`AIT-04` |
| [REQ-000034](../../../01_Discovery/Definitions/REQ-000034/requirement.md) | clone／submodule取得した固定Commitから標準入口を発見できる。同梱Manifestと実行基盤が対象Commit／配布集合へ整合する。別リリースの手動DownloadやVersion推測なしに代表ツールを起動できる。fresh clone、submodule、版不一致、欠落実行基盤、改ざんManifestを用い、発見、拒否、代表起動を観測する | `AIT-02`、`AIT-03` |
| [UX-000020](../../../02_UX/Definitions/UX-000020/ux_definition.md) | 準拠、改ざん有無、配布者、公式表示および実行許可を区別し、自分の環境の方針で公式版・派生版・組織版を選べる。重要場面「実行を信頼すると判断する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。一つの署名やブランド表示への全保証集約とQual-Lab署名だけの実行資格化を反証する | `AIT-01`、`AIT-04` |
| [UX-000031](../../../02_UX/Definitions/UX-000031/ux_definition.md) | 公式入口や素材を識別でき、同時に署名・準拠・品質・発行元への信頼の根拠は別に確認できる。重要場面「公式表示を信頼判断へ用いる直前」で、視覚的な公式らしさを保証の証明と誤認しない。表示媒体や入口が変わっても、識別用途と保証根拠の境界を維持する。公式／非公式表示、保証根拠の欠落、見た目だけの信頼推定および識別不能な入口を反証する | `AIT-01`、`AIT-04` |
| [IA-000009](../../../03_IA/Definitions/IA-000009/ia_definition.md) | 現在の接続で許可された作業領域とRepositoryだけを利用し、管理能力と内容閲覧を混同しない。UX-000013: 利用可能（available）／接続資格が必要（credential_required）／開示制限（restricted）／利用不能（unavailable）／不明（unknown） | `AIT-03`、`AIT-01` |
| [IA-000015](../../../03_IA/Definitions/IA-000015/ia_definition.md) | 公式表示だけに頼らず、異なる根拠を分けて実行基盤を信頼するか決める。UX-000020: 確認済み（verified）／未確認（unverified）／信頼済み（trusted）／非信頼（not_trusted）を別軸にする。UX-000031: 識別済み（identified）／確認済み（verified）／信頼済み（trusted）／品質確認済み（quality_assured）を別軸にする | `AIT-03`、`AIT-04` |
| [UI-000008](../../../04_UI/Definitions/UI-000008/ui_definition.md) | 接続資格で許可されたWorkspaceだけを利用できる。UX-000013: 許可された作業領域だけへ接続する: 利用可能情報を表示する時: 現在の利用許可範囲（Grant）だけを開示し不足を補完しない: 利用不能なリポジトリの存在や内容を推測表示する。UX-000013／IA-000009: 利用可能（available）／接続資格が必要（credential_required）／開示制限（restricted）／利用不能（unavailable）／不明（unknown）: 接続→接続単位→許可された作業領域→公開されたリポジトリ→情報源 | `AIT-03`、`AIT-01` |
| [UI-000013](../../../04_UI/Definitions/UI-000013/ui_definition.md) | 配布元、改ざん有無、準拠、利用者の信頼方針を分けて判断できる。UX-000020: 実行環境の信頼の各要素を別々に評価する: 実行を信頼すると判断する場面: 保証要素と決定権限を分離表示する: 一つの署名表示を全保証と誤認する。UX-000031: 識別表示と保証の根拠を分けて確認する: 公式表示を信頼判断へ用いる直前: 識別表示と検証可能な信頼根拠を別に示す: アイコンや見た目を署名・準拠・品質保証と誤認する。UX-000020／IA-000015: 確認済み（verified）／未確認（unverified）／信頼済み（trusted）／非信頼（not_trusted）を別軸にする: 成果物（Artifact）→各根拠→利用者方針→導入判断。UX-000031／IA-000015: 識別済み（identified）／確認済み（verified）／信頼済み（trusted）／品質確認済み（quality_assured）を別軸にする: 公式表示→配布者（Publisher）→完全性→準拠→品質主張→利用判断 | `AIT-04`、`AIT-03`、`AIT-01` |
| [SPEC-000012](../../../05_SPEC/Definitions/SPEC-000012/spec_definition.md) | 正常: System管理能力と内容閲覧権限を別に判定する。境界: 有効／期限切れCredential、Exposureあり／なしを分け、非開示対象の存在を返さない。失敗: 未許可対象の存在を漏らさず、古いGrantや一律Unlockを受理しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「認証済みSessionとGrantを作成・更新する。未Exposure Repositoryへ読取りEffect 0」と矛盾する結果を返さない。失敗: 未許可対象の存在を漏らさず、古いGrantや一律Unlockを受理しない。副作用: 認証済みSessionとGrantを作成・更新する。未Exposure Repositoryへ読取りEffect 0。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | `AIT-03`、`AIT-04`、`AIT-01` |
| [SPEC-000018](../../../05_SPEC/Definitions/SPEC-000018/spec_definition.md) | 正常: 公式署名を実行許可と同一視せず、Fork・組織署名・開発用未署名の扱いを方針で決める。境界: 準拠／完全性／配布者／利用者方針／品質根拠を別軸にし、一要素のPassを全体信頼へ広げない。失敗: 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り評価だけを返し、Runtime実行Capabilityを自動発行しない」と矛盾する結果を返さない。失敗: 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。副作用: 読取り評価だけを返し、Runtime実行Capabilityを自動発行しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | `AIT-01`、`AIT-03`、`AIT-04` |
| [ARCH-000014](../../../06_Architecture/Definitions/ARCH-000014/architecture_definition.md) | verified／trusted／quality_assuredを別軸にし、Qual-Lab署名を実行資格へ集約しない。Forkや企業署名、許可されたLocal unsignedを利用者所有Policyで評価する。所有する責務: CRDD準拠、Artifact完全性、Publisher、利用者Trust Policy、公式識別の独立評価。所有しない責務: 利用者に代わる信頼判断、外部送信、候補採用。主な外部境界: Runtime Artifact、署名検証、Deployment OwnerのTrust Policy。SPEC-000018: 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。Effect: 読取り評価だけを返し、Runtime実行Capabilityを自動発行しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | `AIT-01`、`AIT-03`、`AIT-04` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [artifact-signing](../../../06_Architecture/Details/artifact-signing/01_Architecture.md) | 署名前検査、署名対象、鍵境界、配置後の検証 |
| [coordinator](../../../06_Architecture/Details/coordinator/01_Architecture.md) | 実行編成、Authority、外部Effect、候補、回収・回復 |
| [runtime-trust](../../../06_Architecture/Details/runtime-trust/01_Architecture.md) | 準拠、Integrity、Publisher、利用者所有Trust Policy |
| [version-control](../../../06_Architecture/Details/version-control/01_Architecture.md) | Repository境界、Revision、差し替え可能な履歴管理Adapter |

## 2. 評価軸

```text
[配布物]
   ├→ [CRDD準拠]
   ├→ [Artifact完全性]
   ├→ [Publisher]
   ├→ [利用者Trust Policy]
   └→ [公式配布物か]
              ↓
        [構造化した判断]
```

## 3. 検証項目

| Local ID | 分類 | 事前状態／入力 | 操作／刺激 | 観測と期待結果 | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- |
| `AIT-01` | 正常 | 署名者、完全性、準拠状態が既知の公式物・独自配布物・未署名Local開発物 | 各成果物を同じTrust Policyで評価する | 各軸を独立評価し、Policyに応じた利用判断を返す | 署名検証だけでRuntime Authorityを発行しない | Automated |
| `AIT-02` | 異常 | 検証済みmanifestとRuntime実行集合、Trust Policy、Native成果物、Publisher情報 | 各要素を一つずつ改変して再評価する | 変更した軸だけでなく相関不変条件の差を検出し、Authority非発行 | 署名／配置／Runtime Effect 0 | Automated |
| `AIT-03` | 判定不能 | Publisherまたは検証材料が不明・不足・読取不能な成果物 | 不足状態のままTrust評価を要求する | unknownをtrustedにせず、不足軸と再評価条件を返す | Runtime Authority 0 | Automated |
| `AIT-04` | 組合せ | 公式だがPolicy外、信頼済みFork、完全性Pass・準拠Failの組合せ | 各組合せへ同じTrust評価を適用する | 公式識別、信頼、完全性、準拠を一つのbooleanへ丸めない | 利用者Policyと矛盾するAuthority 0 | Automated |

## 4. 署名入口とEvidence

秘密入力前に非秘密の全検査を実行し、失敗時は鍵読取り、署名、配置およびAuthority発行を行わない。Evidenceは署名値や鍵を保持せず、検証した軸、対象Identity／Hash、Policy判定、非発行または後続Gateへの引き渡しを保持する。
