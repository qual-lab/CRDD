# QA-000010 配布物の完全性と信頼判断の検証定義

成果物種別: Quality定義
Quality ID: `QA-000010`
検証目標: CRDD準拠、Artifact改ざん有無、Publisher、利用者所有Trust Policyおよび公式識別を独立に評価すること
主な試験段階: Unit／Integration／System／User Acceptance
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | Obligation Key | 導出元 | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|---|
| [REQ-000018](../../../01_Discovery/Definitions/REQ-000018/requirement.md) | `req-000018.qa-000010` | Requirement Definition（成立条件・失敗・検証意図） | 準拠、改ざん有無、配布者、公式表示を独立結果として返す。一要素のPassから他要素または実行許可を推定しない。公式、組織、手元開発Artifactへ同じ判定モデルを適用する。公式署名、組織署名、改ざん、未署名、準拠不成立を組み合わせ、各結果と最終方針判断を観測する | UT／IT／ST／UAT | `AIT-IT-001`、`AIT-ST-004`、`AIT-UT-005`、`AIT-UAT-006` |
| [REQ-000025](../../../01_Discovery/Definitions/REQ-000025/requirement.md) | `req-000025.qa-000010` | Requirement Definition（成立条件・失敗・検証意図） | 方針の責任者、信頼配布者、用途、期限、例外を明示できる。未知配布者、失効鍵、条件外未署名Buildを外部変更の前に既定拒否する。鍵更新、失効、方針移行後に旧機能が再利用されない。公式、組織、手元、未知、失効、移行中のArtifactを評価し、方針判断、Capability発行、監査記録を観測する | UT／IT／ST／UAT | `AIT-IT-001`、`AIT-ST-004`、`AIT-UT-005`、`AIT-UAT-006` |
| [REQ-000034](../../../01_Discovery/Definitions/REQ-000034/requirement.md) | `req-000034.qa-000010` | Requirement Definition（成立条件・失敗・検証意図） | clone／submodule取得した固定Commitから標準入口を発見できる。同梱Manifestと実行基盤が対象Commit／配布集合へ整合する。別リリースの手動DownloadやVersion推測なしに代表ツールを起動できる。fresh clone、submodule、版不一致、欠落実行基盤、改ざんManifestを用い、発見、拒否、代表起動を観測する | UT／IT | `AIT-IT-002`、`AIT-IT-003`、`AIT-UT-005` |
| [UX-000020](../../../02_UX/Definitions/UX-000020/ux_definition.md) | `ux-000020.qa-000010` | UX Definition（利用者成果・重要場面・重要な失敗） | 準拠、改ざん有無、配布者、公式表示および実行許可を区別し、自分の環境の方針で公式版・派生版・組織版を選べる。重要場面「実行を信頼すると判断する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。一つの署名やブランド表示への全保証集約とQual-Lab署名だけの実行資格化を反証する | UT／IT／ST／UAT | `AIT-IT-001`、`AIT-ST-004`、`AIT-UT-005`、`AIT-UAT-006` |
| [UX-000031](../../../02_UX/Definitions/UX-000031/ux_definition.md) | `ux-000031.qa-000010` | UX Definition（利用者成果・重要場面・重要な失敗） | 公式入口や素材を識別でき、同時に署名・準拠・品質・発行元への信頼の根拠は別に確認できる。重要場面「公式表示を信頼判断へ用いる直前」で、視覚的な公式らしさを保証の証明と誤認しない。表示媒体や入口が変わっても、識別用途と保証根拠の境界を維持する。公式／非公式表示、保証根拠の欠落、見た目だけの信頼推定および識別不能な入口を反証する | UT／IT／ST／UAT | `AIT-IT-001`、`AIT-ST-004`、`AIT-UT-005`、`AIT-UAT-006` |
| [IA-000015](../../../03_IA/Definitions/IA-000015/ia_definition.md) | `ia-000015.qa-000010` | IA Definition（情報・関係・状態・見つけ方） | 公式表示だけに頼らず、異なる根拠を分けて実行基盤を信頼するか決める。UX-000020: 確認済み（verified）／未確認（unverified）／信頼済み（trusted）／非信頼（not_trusted）を別軸にする。UX-000031: 識別済み（identified）／確認済み（verified）／信頼済み（trusted）／品質確認済み（quality_assured）を別軸にする | UT／IT／ST／UAT | `AIT-IT-003`、`AIT-ST-004`、`AIT-UT-005`、`AIT-UAT-006` |
| [UI-000013](../../../04_UI/Definitions/UI-000013/ui_definition.md) | `ui-000013.qa-000010` | UI Definition（認識・操作・Feedback・失敗表示） | 配布元、改ざん有無、準拠、利用者の信頼方針を分けて判断できる。UX-000020: 実行環境の信頼の各要素を別々に評価する: 実行を信頼すると判断する場面: 保証要素と決定権限を分離表示する: 一つの署名表示を全保証と誤認する。UX-000031: 識別表示と保証の根拠を分けて確認する: 公式表示を信頼判断へ用いる直前: 識別表示と検証可能な信頼根拠を別に示す: アイコンや見た目を署名・準拠・品質保証と誤認する。UX-000020／IA-000015: 確認済み（verified）／未確認（unverified）／信頼済み（trusted）／非信頼（not_trusted）を別軸にする: 成果物（Artifact）→各根拠→利用者方針→導入判断。UX-000031／IA-000015: 識別済み（identified）／確認済み（verified）／信頼済み（trusted）／品質確認済み（quality_assured）を別軸にする: 公式表示→配布者（Publisher）→完全性→準拠→品質主張→利用判断 | UT／IT／ST／UAT | `AIT-ST-004`、`AIT-IT-003`、`AIT-IT-001`、`AIT-UT-005`、`AIT-UAT-006` |
| [SPEC-000018](../../../05_SPEC/Definitions/SPEC-000018/spec_definition.md) | `spec-000018.qa-000010` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 公式署名を実行許可と同一視せず、Fork・組織署名・開発用未署名の扱いを方針で決める。境界: 準拠／完全性／配布者／利用者方針／品質根拠を別軸にし、一要素のPassを全体信頼へ広げない。失敗: 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り評価だけを返し、Runtime実行Capabilityを自動発行しない」と矛盾する結果を返さない。失敗: 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。副作用: 読取り評価だけを返し、Runtime実行Capabilityを自動発行しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | UT／IT／ST／UAT | `AIT-IT-001`、`AIT-IT-003`、`AIT-ST-004`、`AIT-UT-005`、`AIT-UAT-006` |
| [ARCH-000014](../../../06_Architecture/Definitions/ARCH-000014/architecture_definition.md) | `arch-000014.qa-000010` | Architecture Definition（責務・境界・状態・故障） | verified／trusted／quality_assuredを別軸にし、Qual-Lab署名を実行資格へ集約しない。Forkや企業署名、許可されたLocal unsignedを利用者所有Policyで評価する。所有する責務: CRDD準拠、Artifact完全性、Publisher、利用者Trust Policy、公式識別の独立評価。所有しない責務: 利用者に代わる信頼判断、外部送信、候補採用。主な外部境界: Runtime Artifact、署名検証、Deployment OwnerのTrust Policy。SPEC-000018: 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。Effect: 読取り評価だけを返し、Runtime実行Capabilityを自動発行しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | UT／IT／ST／UAT | `AIT-IT-001`、`AIT-IT-003`、`AIT-ST-004`、`AIT-UT-005`、`AIT-UAT-006` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [artifact-signing](../../../06_Architecture/Details/artifact-signing/01_Architecture.md) | 署名前検査、署名対象、鍵境界、配置後の検証 |
| [coordinator](../../../06_Architecture/Details/coordinator/01_Architecture.md) | 実行編成、Authority、外部Effect、候補、回収・回復 |
| [crdd-domain-library](../../../06_Architecture/Details/crdd-domain-library/01_Architecture.md) | launcher、署名済みRelease Manifest、実装正本およびNative Runtime Artifactを同じ配布全体Identityへ結合する境界 |
| [runtime-trust](../../../06_Architecture/Details/runtime-trust/01_Architecture.md) | 準拠、Integrity、Publisher、利用者所有Trust Policy |

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

## 3. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
| --- | --- | --- | --- | --- |
| UT | Required | Trust各軸の判定と相関不変条件 | N/A | 各Sourceが要求する独立判定を結合前に反証するため |
| IT | Required | Manifest、実行集合、Policy、署名検証器の直接・隣接結合 | Related 2 Blocks | 異なる所有者の値を結合してAuthority発行可否を決めるため |
| ST | Required | 配布物取得からRuntime Authority非発行／発行まで | System/E2E | 署名検証だけの成功をRuntime成立へ誤認しないため |
| UAT | Required | 利用者所有Policyによる公式・Fork・Local開発物の判断 | User Acceptance | 公式表示と利用許可を分けて判断できる利用者成果を確認するため |

### 条件区分の適用

| 条件区分 | 適用 | 対応Local Item | 判断理由 |
|---|---|---|---|
| 正常 | Required | AIT-IT-001 | 通常の成立経路を独立して確認する。 |
| 境界 | Required | AIT-ST-004、AIT-UT-005、AIT-UAT-006、AIT-IT-007、AIT-IT-009、AIT-UT-011、AIT-UT-012、AIT-IT-013、AIT-IT-014 | 値、Authority、情報、責務または利用者判断の境界を確認する。 |
| 準正常 | Required | AIT-IT-003 | 継続可能な分岐、保留、観測不能または診断状態を成功へ畳まない。 |
| 異常 | Required | AIT-IT-002、AIT-IT-008 | 不正入力、故障または拒否経路を通常成功へ畳まない。 |
| 回復 | Required | AIT-ST-010 | 失敗・取消後に同じIdentityと義務で安全に再入場できることを確認する。 |

## 4. 検証項目

| Local ID | 条件区分 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測 | Oracle | Evidence | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AIT-IT-001` | 正常 | IT | Contract／Trust | Artifact Observer→Trust Evaluator→Policy | Adjacent 1 Block | 署名者、完全性、準拠状態が既知の公式物・独自配布物・未署名Local開発物 | 各成果物を同じTrust Policyで評価する | AIT-IT-001として、「各成果物を同じTrust Policyで評価する」前後のArtifact Observer→Trust Evaluator→Policyについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 各軸を独立評価し、Policyに応じた利用判断を返す | AIT-IT-001、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「各軸を独立評価し、Policyに応じた利用判断を返す」および終了後条件「署名検証だけでRuntime Authorityを発行しない」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 署名検証だけでRuntime Authorityを発行しない | Automated |
| `AIT-IT-002` | 異常 | IT | Integrity／Fault | Manifest・実行集合・Native成果物→Trust判定 | Related 2 Blocks | 検証済みmanifestとRuntime実行集合、Trust Policy、Native成果物、Publisher情報 | 各要素を一つずつ改変して再評価する | AIT-IT-002として、「各要素を一つずつ改変して再評価する」前後のManifest・実行集合・Native成果物→Trust判定について、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 変更した軸だけでなく相関不変条件の差を検出し、Authority非発行 | AIT-IT-002、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「変更した軸だけでなく相関不変条件の差を検出し、Authority非発行」および終了後条件「署名／配置／Runtime Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 署名／配置／Runtime Effect 0 | Automated |
| `AIT-IT-003` | 準正常 | IT | Contract／Unknown | 検証材料Reader→Trust Evaluator | Direct Boundary | Publisherまたは検証材料が不明・不足・読取不能な成果物 | 不足状態のままTrust評価を要求する | AIT-IT-003として、「不足状態のままTrust評価を要求する」前後の検証材料Reader→Trust Evaluatorについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | unknownをtrustedにせず、不足軸と再評価条件を返す | AIT-IT-003、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「unknownをtrustedにせず、不足軸と再評価条件を返す」および終了後条件「Runtime Authority 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | Runtime Authority 0 | Automated |
| `AIT-ST-004` | 境界 | ST | Scenario／Trust | 配布物観測→Policy評価→Runtime Authority Gate | System/E2E | 公式だがPolicy外、信頼済みFork、完全性Pass・準拠Failの組合せ | 各組合せへ同じTrust評価を適用する | AIT-ST-004として、「各組合せへ同じTrust評価を適用する」前後の配布物観測→Policy評価→Runtime Authority Gateについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 公式識別、信頼、完全性、準拠を一つのbooleanへ丸めない | AIT-ST-004、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「公式識別、信頼、完全性、準拠を一つのbooleanへ丸めない」および終了後条件「利用者Policyと矛盾するAuthority 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 利用者Policyと矛盾するAuthority 0 | Automated |
| `AIT-UT-005` | 境界 | UT | Trust Semantics／Correlation | Trust各軸の純粋判定規則 | N/A | 準拠、完全性、Publisher、公式表示、Policyの正常・不明・不一致の組合せ | 一軸ずつ値を変えて利用判断を評価する | AIT-UT-005として、「一軸ずつ値を変えて利用判断を評価する」前後のTrust各軸の純粋判定規則について、入力差分、判定結果、欠落・重複・不一致および理由codeを記録する | 各軸を独立結果として保ち、一軸のPassを全保証へ広げない | AIT-UT-005、固定入力「準拠、完全性、Publisher、公式表示、Policyの正常・不明・不一致の組合せ」、観測した差分と理由code、Oracle判定「各軸を独立結果として保ち、一軸のPassを全保証へ広げない」および終了後条件「署名検証・Runtime Authority Effect 0」を保存する | 署名検証・Runtime Authority Effect 0 | Automated |
| `AIT-UAT-006` | 境界 | UAT | Acceptance／Trust | Trust結果→利用者判断 | User Acceptance | 公式、組織、Fork、未署名Local開発物の根拠と利用者所有Policy | 利用者が用途に応じて採用・拒否・保留を判断する | AIT-UAT-006として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 公式表示、検証結果、配布者、利用許可を区別して判断できる | AIT-UAT-006、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「公式表示、検証結果、配布者、利用許可を区別して判断できる」および終了後条件「判断から未承認Runtime Authorityを自動発行しない」を保存する | 判断から未承認Runtime Authorityを自動発行しない | Manual |
| `AIT-IT-007` | 境界 | IT | Authorization／Concurrency | one-time Authorization→予約→鍵読取り→署名 | Related 2 Blocks | 同じ未使用Authorizationを同時に消費する二要求と、予約後失敗を注入できる固定入力 | 二要求を同時開始し、勝者の予約後に取消または署名失敗を発生させる | 勝者・敗者のRequest Identity、各Authorization状態の前後、要求別の鍵読取り回数、署名結果数、再利用試行結果を記録する | 勝者は最大一件、敗者は鍵read 0・署名Effect 0。失敗後もAuthorizationを未使用へ戻さない | AIT-IT-007、Request Identity集合、Authorization状態遷移、要求別鍵読取り回数、署名結果数、再利用試行結果およびOracle判定を保存する。Secret、鍵bytes、passphraseは保存しない | Authorizationは再利用不能で、署名結果は最大一件 | Automated |
| `AIT-IT-008` | 異常 | IT | Signing／Secret Lifecycle | Key Capability→Secret Buffer observer→Signer→Publisher結果 | Direct Boundary | 検証済み単一Snapshot、正常・誤鍵のone-time Key Capability、期待／不一致Publisher、消費済みCapability、正常・署名失敗・取消の各終了経路 | 正常署名、誤鍵、Publisher不一致、Capability再利用、署名失敗、取消を個別に要求する | Snapshot／Request／Buffer Identity、Capability状態、acquire回数、zeroize要求・完了回数、Signer終了時live secret buffer件数、署名結果数、Publisher判定を記録する | 正常時だけPublisher結果を一件返す。誤鍵・Publisher不一致・再利用を拒否し、全終了経路でlive secret buffer 0とする | AIT-IT-008、非秘密のIdentity、Capability状態、Secret Buffer lifecycle eventと件数、署名結果数、Publisher判定、Oracleを保存する。Secret値、鍵bytes、passphraseは保存しない | 全終了経路でKey Capability失効、live secret buffer 0 | Automated |
| `AIT-IT-009` | 境界 | IT | Result Boundary／Responsibility | Signer結果→Coordinator配置契約 | Adjacent 1 Block | 正常Signer結果と、Manifest Path・配置・公開fieldを混入した反例 | Signer結果Schemaと利用側契約を検査する | Signer結果field集合、拒否理由、Signer／配置Effect件数を記録する | Signerは署名値・Publisher・対象Identityだけを返し、Manifest生成・配置・公開判断を所有しない | AIT-IT-009、field集合、Schema判定、拒否理由、Effect件数を保存する | 不正field時の署名・配置Effect 0 | Automated |
| `AIT-ST-010` | 回復 | ST | Promotion／Single Snapshot／Recovery | 単一Snapshot→署名→staging→Manifest配置→promotion→明示破棄 | System/E2E | 固定Snapshotと正常入力に加え、Distribution Root差、署名対象一件欠落、途中段階だけ別Snapshot、配置前後の各故障注入点 | 正常promotion、各反例、各配置故障、promotion後の明示破棄を個別に実行する | 各段階のSnapshot／staging／file object Identity、Distribution Root、対象集合、byte数、Hash、配置Effect、promotion後staging状態、明示破棄Effect、失敗段階、回復義務を記録する | Root差・対象漏れ・Snapshot混入は署名／配置Effect 0。正常時はstagingと最終Pathが同一file objectでbyte数・Hash一致。破棄は別Effectとして完了する | AIT-ST-010、各Identity、Root・対象集合、byte数・Hash、段階別Effect、promotion後staging状態、明示破棄、失敗理由、回復義務を保存する | promotion完了時は二名同一objectを許可する。明示破棄完了時だけ最終Path単独。失敗時はexact回復Identityを保持する | Automated |
| `AIT-UT-011` | 境界 | UT | Signature Component | 署名PrimitiveとPublisher検証規則 | N/A | 期待Publisher、別Publisher、鍵差替え、無効署名 | 署名と検証規則を適用する | Publisher、payload Hash、署名結果、拒否理由を記録する | 期待Publisherの有効署名だけを受理し鍵内容を公開しない | 公開分類済み入力、Hash、結果、判定 | 秘密byte残存0 | Automated |
| `AIT-UT-012` | 境界 | UT | One-shot Authorization | Authorization状態機械 | N/A | 未使用、予約済み、消費済み、失敗、競合要求 | Authorizationを原子的に予約・消費する | 状態遷移、勝者、敗者、鍵read回数を記録する | 一件だけが消費でき敗者と再利用要求は鍵を読まない | 入力、遷移、read回数、判定 | 再利用可能Authorization 0 | Automated |
| `AIT-IT-013` | 境界 | IT | Signed Promotion Boundary | Signer→Staging→Manifest配置 | Adjacent 1 Block | 固定Snapshot、Root差、対象欠落、配置競合 | 署名結果を同じSnapshotのStagingへ配置する | Snapshot、署名、配置対象、競合、結果を記録する | 別Snapshotを混ぜず全対象が揃う場合だけ配置結果を返す | Snapshot、対象集合、配置結果、判定 | 部分配置0または同一Identityの回復義務 | Automated |
| `AIT-IT-014` | 境界 | IT | Runtime Trust Policy | Artifact観測→Deployment Policy→Authority Gate | Direct Boundary | 同じArtifactに異なるDeployment Owner Policy、失効・未知条件 | Policyを評価しRuntime Authority可否を返す | Artifact Identity、Policy、判定、Authority発行を記録する | Qual-Lab固定許可を使わずDeployment OwnerのPolicyだけを適用する | 入力、Policy、結果、Authority、判定 | 拒否時Authority 0 | Automated |

## Semantic Coverage Pilot

この表はQuality Local Itemが検証する設計上の意味だけを正方向で宣言する。逆方向の一覧は生成し、本文の類似表現から推測しない。

| Local ID | Semantic Key |
|---|---|
| `AIT-IT-001` | `coordinator.runtime-trust-consumption` |

## 5. 署名入口とEvidence

秘密入力前に非秘密の全検査を実行し、失敗時は鍵読取り、署名、配置およびAuthority発行を行わない。Evidenceは署名値や鍵を保持せず、検証した軸、対象Identity／Hash、Policy判定、非発行または後続Gateへの引き渡しを保持する。

## 追加試験種別の適用

| 種別 | 適用 | 確認する範囲 | 実行許可 | 未実行時の扱い |
|---|---|---|---|---|
| RT | Required | 変更した意味と利用側から、再実行する既存Local Itemを選ぶ | Changeの通常検証範囲 | 未選択の範囲を明示し、選択した回帰の結果で評価する |
| PT | N/A | 現在のQuality Contractに性能成立条件がないため非該当 | N/A | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |
| LT | N/A | 現在のQuality Contractに長時間成立条件がないため非該当 | N/A | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |


## Checklist

- [x] Quality ID、検証目標およびSource固有条件を自己完結して示した
- [x] 各Local ItemをRequired Verification Obligationの局所参照と導出元へ接続した
- [x] UT／IT／ST／UATの適用または理由付きN/Aを記録した
- [x] 外部境界の直接、隣接1 block、関連2 blocks、System／E2Eおよび利用者受入を適用判定した
- [x] 正常、境界、準正常、異常および回復をLocal Itemで処置した
- [x] 各Local Itemで観測とOracleを分けた
- [x] 各Local ItemのEvidence要件を示した
- [x] 事前条件、刺激、終了後条件、cleanupおよびRecoveryを必要な範囲で示した
- [x] RT／PT／LTの適用または理由付きN/Aを記録し、PT／LTは人間の明示指定なしに実行しない
- [x] 自動化、手動確認および人間判断の境界を示した
- [x] 現行Source、TestおよびEvidenceとの照合をReality Auditへ分離した
