# 成果物署名のアーキテクチャ

成果物種別: Architecture詳細設計
詳細設計領域: artifact-signing
状態: Canonical

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000014](../../Definitions/ARCH-000014/architecture_definition.md) | 署名対象の完全性、鍵Capability、Publisher証明および署名結果を具体化する。 | Covered |

Relation状態は、この領域が担当する責務断面に対する状態である。複数領域で同じARCH-IDを実現する場合、各領域の断面を合成して基本設計全体を閉じる。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | 鍵参照、事前検査、秘密入力、署名、秘密byte消去の責務を分ける。 | [§2](#2-責務境界) |
| Interface Model | Required | 意味非依存の署名契約と利用側の境界を固定する。 | [§4](#4-公開契約) |
| Data Flow | Required | 鍵参照から署名結果まで秘密値を複製せず追跡する。 | [§3](#3-鍵参照と署名の状態遷移) |
| State Model | Required | 事前検査、鍵読取り、署名、秘密byte消去を別状態にする。 | [§3](#3-鍵参照と署名の状態遷移) |
| Sequence | Required | 非秘密検査を秘密入力より前に完了させる順序が成立条件になる。 | [§3](#3-鍵参照と署名の状態遷移) |
| Failure／Recovery | Required | 途中失敗時に署名済み・公開済みと誤認しない必要がある。 | [§5](#5-検証境界) |
| Deployment | N/A | 配布Root、Manifest envelope、配置、promotionおよび公開はCoordinatorが所有し、本領域は意味非依存の署名結果だけを返す。 | [§2](#2-責務境界) |
| Observability | Required | 事前検査、秘密入力、署名、秘密byte消去のどこまで成立したかを区別する。 | [§3](#3-鍵参照と署名の状態遷移) |
| Security Boundary | Required | 秘密鍵、passphrase、期待Publisherを独立して保護する。 | [§2](#2-責務境界) |

`N/A`は未検討を意味しない。対象外にできるArchitecture上の理由を記載する。

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | N/A | 本領域は共有staging、Manifest、配置または公開を所有しない。一回限りAuthorizationは単一署名Operation内でのみ消費し、複数Operationの直列化は利用側が所有する。 | [§2](#2-責務境界) |
| Timing | N/A | 期限保証は持たず、各Filesystem／暗号Effectの完了観測を成功条件にする。 | [§3](#3-鍵参照と署名の状態遷移) |
| Resource Lifecycle | PASS | 鍵bytes、passphrase bytesおよび一回限りAuthorizationの取得・消費・zeroizationを分ける。 | [§3](#3-鍵参照と署名の状態遷移) |
| External Boundary | PASS | 暗号ProviderとFilesystemを独立境界として扱う。 | [§4](#4-公開契約) |
| Failure／Recovery | PASS | 事前検査、秘密入力、鍵読取り、署名を別状態にし、失敗時に署名結果を返さない。 | [§5](#5-検証境界) |
| State／Consistency | PASS | 事前検査、鍵読取り、署名、秘密byte消去を別状態にする。 | [§3](#3-鍵参照と署名の状態遷移) |
| Observability | PASS | 事前検査、秘密入力、署名、秘密byte消去の到達点を、秘密値を報告せず区別する。 | [§5](#5-検証境界) |
| Security／Trust | PASS | 秘密鍵、passphrase、期待Publisherを独立して保護する。 | [§2](#2-責務境界) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 検証単位 | 対象 | 正常条件 | 反証する失敗 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|
| 署名Component | 鍵Capabilityとpayload | 期待Publisherの署名結果 | 鍵差替え、Authorization再利用 | reason、signature有無 | 秘密bytes消去、未配置 | なし |
| 利用側境界 | 意味非依存の署名結果 | Manifest／配置fieldを含まず利用側へ返る | 署名結果から配置・公開完了を推定 | result contract、意味固有field 0 | 配置Effect 0 | Manifest、staging、promotion、公開はCoordinatorの検証単位 |

## 現行実装との照合

現行Sourceと既存試験は本詳細設計の正式入力ではない。本設計候補を固定した後、成立済み能力を失わないよう`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

担当責任者: Qual-Lab
最終更新日: 2026-09-13
要求: [`REQ-000036`](../../../01_Discovery/Definitions/REQ-000036/requirement.md)
変更: [`CHG-000072`](../../../99_Roadmap/Changes/CHG-000072/change.md)

## 1. なぜ独立させるのか

秘密鍵の参照、対話端末からの秘密入力、任意byte列への暗号署名は、Provider実行を編成するCoordinator固有の責務ではない。Coordinator内に置くと、別のCRDD成果物を署名する利用側がRuntime Manifestの内部実装へ依存する。

成果物署名（Artifact Signing）は、署名対象の意味を知らないRoot Componentとする。CoordinatorはRuntime Execution IdentityとManifest payloadを構築し、固定Publisher Policy、P検査／S検査の順序およびstaging配置を所有する。

```text
Coordinator Release Adapter
  ├─ Runtime依存集合を観測
  ├─ Manifest payloadを構築
  ├─ 固定Publisherを選択
  └─ P検査 → 秘密入力 → S検査 → staging配置
                     │
                     │ byte payload／期待する公開鍵
                     ▼
            Artifact Signing
              ├─ 鍵参照を事前固定
              ├─ hidden input
              ├─ 秘密入力後の鍵再観測
              ├─ Ed25519署名
              └─ 秘密byteのzeroization
```

## 2. 責務境界

| 責務 | 所有者 | 所有しないもの |
|---|---|---|
| Git管理外設定から鍵参照を構文解析 | Artifact Signing | `.env-crdd`という用途名、Runtime Manifest field |
| 鍵参照の事前検査と一回限りAuthorization | Artifact Signing | 鍵利用を許可するPublisher Policy |
| direct TTYの秘密入力 | Artifact Signing | passphraseの永続化、環境変数入力、redirect fallback |
| 任意byte列のEd25519署名と秘密byte消去 | Artifact Signing | payloadの意味、Release状態、配置先 |
| Runtime依存観測とManifest payload | Coordinator | 汎用暗号primitiveの再実装 |
| 期待する公開鍵と発行Policy | Coordinator | 利用者所有Trust Policy全般 |
| P／S順序、Manifest envelope、staging配置 | Coordinator | 鍵参照のFilesystem再解釈 |

## 3. 鍵参照と署名の状態遷移

```text
[reference received]
        │
        ├─ missing／directory／link／Repository内／過大
        │      └─ [blocked, secret input 0, signing effect 0]
        │
        ▼
[preflight identity fixed]
        │  one-shot authorization
        ▼
[secret input]
        │
        ├─ cancelled／invalid
        │      └─ [blocked, key content unread]
        │
        ▼
[fresh reference observation]
        │
        ├─ replaced／changed／unobservable
        │      └─ [blocked, signing effect 0]
        │
        ▼
[stable key bytes opened]
        │
        ├─ decrypt failure／unexpected public key
        │      └─ [blocked, published result 0]
        │
        ▼
[payload signed]
        │
        └─ key bytes／passphrase bytes zeroized
```

事前観測を署名時観測へ流用しない。一方で署名時のFile Identityは事前観測と一致しなければならず、事前検査後の正規な鍵差替えも同じOperationでは受理しない。

## 4. 公開契約

| Input | Output | 失敗時 |
|---|---|---|
| env file、変数名 | 絶対鍵参照 | 構文不正・重複を拒否。鍵Fileは読まない |
| 鍵参照、禁止Root、最大byte | opaqueな一回限りAuthorization | 秘密入力前にEffect 0で停止 |
| Authorization、payload、passphrase、期待SPKI | algorithm、key ID、signature | Authorization再利用、鍵差替え、公開鍵不一致を拒否 |
| prompt | hidden line | 非TTY、取消、EOFを拒否。別搬送へfallbackしない |

公開結果はManifest、Repository、CoordinatorまたはRelease固有fieldを含まない。利用側は署名結果を独自に再計算せず、意味固有のenvelopeと配置を自身の責務で行う。

## 5. 検証境界

| 観点 | 必須反証 |
|---|---|
| 参照 | 欠落、directory、symbolic link、Repository内、過大File |
| 時間差 | preflight後の内容・Identity差替え |
| Authority | 偽造、再利用、別Authorization |
| 秘密 | passphrase未入力時の鍵内容read 0、完了後zeroization |
| Publisher | 期待SPKI不一致で署名結果・配置0 |
| Consumer | CoordinatorのCLI指定と`.env-crdd`指定が同じpreflightへ到達 |
| 配布 | Artifact Signingの到達Sourceとpackage metadataがRuntime Execution Identityへ含まれる |

試験用鍵によるComponent検証と、公式鍵を使う正式署名を分離する。Component試験の成功または署名成功だけから、Coordinator Manifestの正しさ、staging配置またはRelease完了を推定しない。

## Checklist

- [x] 関連するARCH-IDと担当する責務断面を明示した
- [x] 9種類の詳細成果物を全数Applicability判定した
- [x] Requiredを実在する節または成果物へ接続した
- [x] N/AにArchitecture上の理由を記録した
- [x] 8種類のEngineering Concernを全数評価した
- [x] PASSを設計済みの意味に限定した
- [x] Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した
- [x] Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した
- [x] Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] 現行実装との照合をReality Auditとして分離した
- [x] Source構造をCanonical詳細設計へ逆輸入していない
