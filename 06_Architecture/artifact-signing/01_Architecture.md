# 成果物署名のアーキテクチャ

状態: Architecture Ready（v0.21.0）
担当責任者: Qual-Lab
最終更新日: 2026-09-13
要求: [`REQ-000036`](../../01_Discovery/Definitions/REQ-000036/requirement.md)
変更: [`CHG-000072`](../../99_Roadmap/Changes/CHG-000072/change.md)

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
