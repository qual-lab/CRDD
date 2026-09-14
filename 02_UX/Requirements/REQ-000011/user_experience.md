# REQ-000011の利用者体験分析

状態: Candidate
要求: `REQ-000011` Remote接続のWorkspace限定
探索元: [Remote Project Context](../../../01_Discovery/Explorations/EXP-000022_Remote_Project_Context/exploration.md)

## 1. なぜこの要求を体験として扱うのか

Remote接続では、接続できたことと閲覧できる範囲を同一視しやすい。利用者は現在のCredentialで何を利用でき、何が見えず、次に何が必要かを誤認なく理解する必要がある。

## 2. 利用者に起きる変化

| 利用前 | 利用後 |
|---|---|
| Serverへ接続できれば全Projectを扱えると思う | 現在SessionへGrantされたWorkspaceだけが利用できると分かる |
| 取得不能を権限不足か障害か推測する | `credential_required`、`restricted`、`unavailable`を区別する |

## 3. UXへの処置

`UX-000007@1`「Workspace限定Remote利用」として扱う。固定Roleを体験モデルへ持ち込まず、Connection Credentialから得た現在のWorkspace集合を表示と操作の境界にする。

## 4. 重要場面、失敗、品質期待

- 認証後もGrant外のRepository名、件数、状態を漏らさない。
- Credential切替や失効後は投影を再評価する。
- `Unlock`は別Credentialが必要で存在開示可能な場合だけ示す。
- System管理能力とContent閲覧範囲を混同しない。

## 5. 下流への引き渡し

IAはCredential、Session、Workspace、ExposureおよびSource可用性を区別する。Threat／SPEC／Architectureは開示可否とEffect Authorityを別契約として具体化する。
