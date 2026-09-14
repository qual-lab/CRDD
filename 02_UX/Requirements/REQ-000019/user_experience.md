# REQ-000019の利用者体験分析

状態: UX再統合済み・独立再レビュー待ち
要求: `REQ-000019` 契約移行時のConsumer閉包
探索元: [EXP-000014](../../../01_Discovery/Explorations/EXP-000014_Runtime_Responsibility_Separation/exploration.md)

## 1. REQの一次分析

```text
責務移動後に珍しい入口だけ旧契約へ残り、Release時に初めて壊れる
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
責務移動後の全Consumerを閉じる
```

この要求で解くのは機能の有無だけではない。Contractを変更する保守者・確認者が「稀な署名・Release・Recovery経路の取り残しを防ぐ」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | 責務移動後に珍しい入口だけ旧契約へ残り、Release時に初めて壊れる |
| UX Need | 責務移動後の全Consumerを閉じる |
| 対象範囲 | CRDDを更新する人、Releaseを受け取る人が、「責務移動後に珍しい入口だけ旧契約へ残り、Release時に初めて壊れる」状態から「変更対象の全利用経路が移行済みか確認でき、未移行範囲を残したまま完成表示されない」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
Contractを変更する保守者・確認者
        │
        │ wants to
        ▼
責務移動後の全Consumerを閉じる
        │
        │ so that
        ▼
稀な署名・Release・Recovery経路の取り残しを防ぐ
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「CRDD作成者・保守者」 |
| 利用場面 | Canonical ContractやOwnerを変更する時 |
| Goal | 責務移動後の全Consumerを閉じる |
| Outcome | 稀な署名・Release・Recovery経路の取り残しを防ぐ |
| REQ固有の差 | Producer・Consumer・派生物・公開経路を照合することが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。CRDD作成者・保守者が「責務移動後の全Consumerを閉じる」を判断する場面で、Producer・Consumer・派生物・公開経路を照合することが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- 責務移動後に珍しい入口だけ旧契約へ残り、Release時に初めて壊れる
        │
        │ 契約移行時のConsumer閉包が変える体験
        ▼
After
────────────────
- 変更対象の全利用経路が移行済みか確認でき、未移行範囲を残したまま完成表示されない
```

契約移行時のConsumer閉包は、単に内部方式を成立させる要求ではない。「責務移動後に珍しい入口だけ旧契約へ残り、Release時に初めて壊れる」状態から、「変更対象の全利用経路が移行済みか確認でき、未移行範囲を残したまま完成表示されない」状態へ変わり、利用者が次の判断へ進めることまでを体験として扱う。

この変化で守るのは操作手順ではない。Contractを変更する保守者・確認者が責務移動後の全Consumerを閉じることで、稀な署名・Release・Recovery経路の取り残しを防ぐようになることを守る。

## 4. UX成果への統合

```text
REQ-000019
   │
   └─ Same → UX-000007 内部変更後も成立済み能力を安全に使う
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| 内部変更後も成立済み能力を安全に使う | `Same → UX-000007` | 既存UXのActor: Runtime導入・運用者<br>現在REQのActor: CRDD作成者・保守者<br>Actor差: 既存UXの「Runtime導入・運用者」に対して現在REQは「CRDD作成者・保守者」だが、両者とも「内部変更後も成立済み能力を安全に使う」を利用・確認する当事者であり、役割差だけでは別Outcomeにならない<br>既存UXのTrigger: Runtime Componentを置換する時<br>現在REQのTrigger: Canonical ContractやOwnerを変更する時<br>Trigger差: 既存UXの「Runtime Componentを置換する時」に対して現在REQは「Canonical ContractやOwnerを変更する時」を具体化するが、同じ「内部変更後も成立済み能力を安全に使う」が必要になる開始条件の差であり、独立した成果境界ではない<br>既存UXのOutcome: 責務・契約・Adapterの変更後も、維持・変更・廃止された能力を理解し、取り残しのない結果を安全に利用・公開できる<br>現在REQのOutcome: 契約移行後に署名・Release・Recoveryを含む全Consumerが接続された能力を安全に利用・公開できる<br>Outcome差: 現在REQは「内部変更後も成立済み能力を安全に使う」をこの要求の場面で成立させるOutcomeを具体化しており、REQ全体のPrimary Outcomeや別のUX成果へ置き換えていない<br>既存UXのFailure: 内部責務の移動後に公開入口や成立済み能力が壊れ、利用者が変更影響を予測できない<br>現在REQのFailure: 主経路だけを更新し署名・Release・Recovery等のConsumerが旧契約に残る<br>Failure差: 現在REQは取り残しの原因をConsumer集合へ具体化するが、内部変更後に能力を失う失敗は同じである<br>同一Outcomeへ統合できる理由: Consumer閉包は既存成果を保証するArchitecture／Validation条件であり、独立した利用者Goalではない | Producer・Consumer・派生物・公開経路を照合することが、この要求固有の成立条件になる |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

## 5. 重要な体験

### このREQのJourney

```text
Canonical ContractやOwnerを変更する時
        ↓
Producer・Consumer・派生物・公開経路を照合する
        │
        ├─ ★ Critical: 移行完了を表示する直前
        ├─ ⚠ Failure:  代表Consumerだけ更新して完了扱いする
        └─ ✓ Quality:  自動導出集合と契約試験で閉包を確認する
        ↓
稀な署名・Release・Recovery経路の取り残しを防ぐ
```

### Service Blueprintの処置

処置: `作成`

```text
[U: CRDD作成者・保守者]
        │ 利用者行動: 変更した意味と維持する利用側を明示する
        ▼
[T: Canonical ContractやOwnerを変更する時]
        │
        ├─ 時間差: 契約変更後にConsumer導出と独立確認を行い、閉包まで時間差がある
        ├─ 完了時: Producer、全Consumer、派生物、公開・署名・Release経路の接続状態
        └─ 失敗時: 未接続Consumerと旧契約残存を独立確認者から変更担当へ返す
                     │
                     ▼
             [R: 独立確認者]
                     │ 返却された事実と判断不能範囲を確認
                     └─ 次の行動: 不足Consumerを移行するか、意図した廃止として判断を得る

---------------- 可視境界 ----------------
                     │ 時間関係: 契約変更後にConsumer導出と独立確認を行い、閉包まで時間差がある
                     ▼
[S: 提供System]
        └─ 提供責務: 宣言と実Sourceから利用側集合と差分を提示する
```

この図は、利用者行動、利用者が観測する接点、提供責務および失敗時の引き渡しを示す。内部Componentの構造やProtocolは下流工程で具体化する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [標準を変更・検証・公開する](../../03_Experience_Map.md#標準を変更検証公開する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| CRDD作成者・保守者 | 変更した意味と維持する利用側を明示する | 代表Consumerだけで移行完了としない |
| 提供System | 宣言と実Sourceから利用側集合と差分を提示する | Registryだけを完全な正本とみなさない |
| 独立確認者 | 稀な署名・Release・Recovery経路まで閉じたか確認する | 試験件数だけでConsumer閉包を推定しない |

### 補足する品質

- 結果または状態を最初に受け取る時: 主要経路だけで完了としない。（避ける失敗: 責務移動後に珍しい入口だけ旧契約へ残り、Release時に初めて壊れる）
- 結果を判断または引き継ぐ時: 署名・Recovery・Release等の副次経路を含める。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: 旧Contract残存を検出可能にする。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


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
| 変更対象の全利用経路が移行済みか確認でき、未移行範囲を残したまま完成表示されないことで、責務移動後に珍しい入口だけ旧契約へ残り、Release時に初めて壊れるという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | CRDD作成者・保守者が「責務移動後の全Consumerを閉じる」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | ArchitectureはConsumer Closureを、MaintenanceとVerificationは全Consumer反証とRelease Gateを具体化する。 |

Discoveryへ戻す条件は、想定した利用者、問題または「責務移動後の全Consumerを閉じる」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「稀な署名・Release・Recovery経路の取り残しを防ぐ」という成果を無断で弱めない。
