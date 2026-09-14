# REQ-000025の利用者体験分析

状態: UX再統合済み・独立再レビュー待ち
要求: `REQ-000025` Deployment Ownerが所有するTrust Policy
探索元: [EXP-000028](../../../01_Discovery/Explorations/EXP-000028_User_Owned_Runtime_Trust/exploration.md)

## 1. REQの一次分析

```text
Qual-Lab署名の有無だけで実行可否が固定され、Forkや組織Buildを安全に使えない
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
信頼するPublisherとLocal例外を自分で定める
```

この要求で解くのは機能の有無だけではない。Deployment Ownerが「OSS Forkや組織Buildも方針に従って利用できる」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | Qual-Lab署名の有無だけで実行可否が固定され、Forkや組織Buildを安全に使えない |
| UX Need | 信頼するPublisherとLocal例外を自分で定める |
| 対象範囲 | Deployment Owner、組織のRuntime管理者が、「Qual-Lab署名の有無だけで実行可否が固定され、Forkや組織Buildを安全に使えない」状態から「公式版・組織版・Local版の信頼条件を所有し、更新・失効・移行を管理できる」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
Deployment Owner
        │
        │ wants to
        ▼
信頼するPublisherとLocal例外を自分で定める
        │
        │ so that
        ▼
OSS Forkや組織Buildも方針に従って利用できる
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「Runtime導入・運用者」 |
| 利用場面 | Runtime Artifactを実行候補にする時 |
| Goal | 信頼するPublisherとLocal例外を自分で定める |
| Outcome | OSS Forkや組織Buildも方針に従って利用できる |
| REQ固有の差 | Artifact Integrityと利用者所有Trust Policyを照合することが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。Runtime導入・運用者が「信頼するPublisherとLocal例外を自分で定める」を判断する場面で、Artifact Integrityと利用者所有Trust Policyを照合することが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- Qual-Lab署名の有無だけで実行可否が固定され、Forkや組織Buildを安全に使えない
        │
        │ Deployment Ownerが所有するTrust Policyが変える体験
        ▼
After
────────────────
- 公式版・組織版・Local版の信頼条件を所有し、更新・失効・移行を管理できる
```

Deployment Ownerが所有するTrust Policyは、単に内部方式を成立させる要求ではない。「Qual-Lab署名の有無だけで実行可否が固定され、Forkや組織Buildを安全に使えない」状態から、「公式版・組織版・Local版の信頼条件を所有し、更新・失効・移行を管理できる」状態へ変わり、利用者が次の判断へ進めることまでを体験として扱う。

この変化で守るのは操作手順ではない。Deployment Ownerが信頼するPublisherとLocal例外を自分で定めることで、OSS Forkや組織Buildも方針に従って利用できるようになることを守る。

## 4. UX成果への統合

```text
REQ-000025
   │
   └─ Same → UX-000020 利用環境の信頼方針でRuntimeを選ぶ
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| 利用環境の信頼方針でRuntimeを選ぶ | `Same → UX-000020` | 既存UXのActor: Runtime導入・運用者<br>現在REQのActor: Runtime導入・運用者<br>Actor差: 既存UXと現在REQはいずれも「Runtime導入・運用者」であり、Actorの差はない<br>既存UXのTrigger: Runtimeを導入または更新する時<br>現在REQのTrigger: Runtime Artifactを実行候補にする時<br>Trigger差: 既存UXの「Runtimeを導入または更新する時」に対して現在REQは「Runtime Artifactを実行候補にする時」を具体化するが、同じ「利用環境の信頼方針でRuntimeを選ぶ」が必要になる開始条件の差であり、独立した成果境界ではない<br>既存UXのOutcome: 準拠、改ざん有無、Publisher、公式表示および実行許可を区別し、自分の環境の方針で公式版・Fork・組織版を選べる<br>現在REQのOutcome: Deployment Ownerが自身のTrust PolicyでQual-Lab公式版・Fork・組織Buildの実行可否を選べる<br>Outcome差: 現在REQは「利用環境の信頼方針でRuntimeを選ぶ」をこの要求の場面で成立させるOutcomeを具体化しており、REQ全体のPrimary Outcomeや別のUX成果へ置き換えていない<br>既存UXのFailure: 準拠・Integrity・Publisher・実行許可を一つのTrust表示へ畳み、環境所有者が選べない<br>現在REQのFailure: Qual-Lab署名だけを唯一の実行資格とし、Forkや組織Buildを方針に従って評価できない<br>Failure差: 現在REQはPolicy所有者と許可規則を具体化するが、自分の環境の信頼方針でRuntimeを選べない失敗は同じである<br>同一Outcomeへ統合できる理由: Trust Policyは同じRuntime選択成果を実行時に成立させる決定条件である | Artifact Integrityと利用者所有Trust Policyを照合することが、この要求固有の成立条件になる |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

## 5. 重要な体験

### このREQのJourney

```text
Runtime Artifactを実行候補にする時
        ↓
Artifact Integrityと利用者所有Trust Policyを照合する
        │
        ├─ ★ Critical: Runtime Authorityを与える直前
        ├─ ⚠ Failure:  Qual-Lab署名だけを唯一の実行資格にする
        └─ ✓ Quality:  Publisher Trustと実行許可を利用環境が所有する
        ↓
OSS Forkや組織Buildも方針に従って利用できる
```

### Service Blueprintの処置

処置: `作成`

```text
[U: Deployment Owner（Runtime導入・運用者）]
        │ 利用者行動: 信頼するPublisherとLocal例外を自分で定める
        ▼
[T: Runtime Artifactを実行候補にする時]
        │
        ├─ 時間差: Artifact公開後、Deployment Ownerが導入時に自身のPolicyを適用する
        ├─ 完了時: Publisher、Integrity、準拠結果、適用Policy、実行可否
        └─ 失敗時: Policy不一致と不足する検証をDeployment Ownerへ返す
                     │
                     ▼
             [R: Deployment Owner（Trust Policy適用の判断役割へ切替）]
                     │ 返却された事実と判断不能範囲を確認
                     └─ 次の行動: Artifactを採用、拒否または追加検証する

---------------- 可視境界 ----------------
                     │ 時間関係: Artifact公開後、Deployment Ownerが導入時に自身のPolicyを適用する
                     ▼
[S: 提供System]
        └─ 提供責務: 現在Policyに従って実行候補を評価する
```

この図は、利用者行動、利用者が観測する接点、提供責務および失敗時の引き渡しを示す。内部Componentの構造やProtocolは下流工程で具体化する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [Runtimeを導入・更新・回復する](../../03_Experience_Map.md#runtimeを導入更新回復する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| Runtime Publisher | 自身が発行したArtifactと保証範囲を示す | 利用者環境の信頼判断を代行しない |
| Deployment Owner | 信頼するPublisherと限定例外を所有する | SecretやPolicyをRepositoryへ平文保存しない |
| 提供System | 現在Policyに従って実行候補を評価する | Qual-Lab署名だけを唯一の実行資格にしない |

### 補足する品質

- 結果または状態を最初に受け取る時: 既定拒否とLocal開発例外を区別する。（避ける失敗: Qual-Lab署名の有無だけで実行可否が固定され、Forkや組織Buildを安全に使えない）
- 結果を判断または引き継ぐ時: Publisher変更を無言で受け入れない。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: 管理者権限とContent Accessを混ぜない。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


## 6. 下流への引き渡し

```text
このREQで確定した利用者成果
        │
        ├─→ IA: 必要な情報・関係・見つけ方
        ├─→ UI: 誤認させない表示・操作意図
        ├─→ SPEC: 振る舞い・失敗・体験品質の条件
        └─→ Verification: 仮説を破る反例と観測
```

### 妥当性確認と未確認事項

| 確認する仮説 | 観測方法 | 現在未確認の範囲 |
|---|---|---|
| 公式版・組織版・Local版の信頼条件を所有し、更新・失効・移行を管理できることで、Qual-Lab署名の有無だけで実行可否が固定され、Forkや組織Buildを安全に使えないという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | Runtime導入・運用者が「信頼するPublisherとLocal例外を自分で定める」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | IAはPublisher、Trust Policy、Key、Deploymentを分け、UI／SPECはPolicy変更と影響を提示する。 |

Discoveryへ戻す条件は、想定した利用者、問題または「信頼するPublisherとLocal例外を自分で定める」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「OSS Forkや組織Buildも方針に従って利用できる」という成果を無断で弱めない。
