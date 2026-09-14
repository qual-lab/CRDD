# REQ-000033の利用者体験分析

状態: UX再統合済み・独立再レビュー待ち
要求: `REQ-000033` Work LifecycleとEvidence所有の分離
探索元: [EXP-000018](../../../01_Discovery/Explorations/EXP-000018_Work_and_Evidence_Ownership/exploration.md)

## 1. REQの一次分析

```text
Roadmap、CHG、Evidence、Qualityの置場と役割が重なり、現在状態と履歴を探し回る
        ↓
解決策を先に固定せず、人の仕事として読み替える
        ↓
UXとして必要
Work・Change・Evidence・Qualityを役割別に辿る
```

この要求で解くのは機能の有無だけではない。CRDD保守者・監査者が「変更理由と全影響Pathを重複なく確認できる」状態へ進めないことを問題として扱う。具体的な画面、データ構造、API、Componentまたは数値閾値はここで確定しない。

| 観点 | 内容 |
|---|---|
| 解決する問題 | Roadmap、CHG、Evidence、Qualityの置場と役割が重なり、現在状態と履歴を探し回る |
| UX Need | Work・Change・Evidence・Qualityを役割別に辿る |
| 対象範囲 | 変更を追う人、Release・品質を判断する人が、「Roadmap、CHG、Evidence、Qualityの置場と役割が重なり、現在状態と履歴を探し回る」状態から「何が未完了か、何を変えたか、何が成立を証明するか、現在品質は何かを役割別に辿れる」状態へ移る場面 |
| 対象外 | 具体的な画面、データ構造、実装方式および数値閾値の確定 |

## 2. 利用者・目標・成果

```text
CRDD保守者・監査者
        │
        │ wants to
        ▼
Work・Change・Evidence・Qualityを役割別に辿る
        │
        │ so that
        ▼
変更理由と全影響Pathを重複なく確認できる
```

| 項目 | 内容 |
|---|---|
| Primary Persona | [Product横断の利用者像](../../02_Personas.md)の「CRDD作成者・保守者」 |
| 利用場面 | 変更の現在地や根拠を調べる時 |
| Goal | Work・Change・Evidence・Qualityを役割別に辿る |
| Outcome | 変更理由と全影響Pathを重複なく確認できる |
| REQ固有の差 | 各Ownerから状態・差分・Evidenceを接続することが、この要求固有の成立条件になる |
| 根拠・確信度 | 探索元の課題と採用要求から導いた仮説。CRDD作成者・保守者が「Work・Change・Evidence・Qualityを役割別に辿る」を判断する場面で、各Ownerから状態・差分・Evidenceを接続することが実際に成果へ影響するかは未確認。 |

## 3. 利用者に起きる変化

```text
Before
────────────────
- Roadmap、CHG、Evidence、Qualityの置場と役割が重なり、現在状態と履歴を探し回る
        │
        │ Work LifecycleとEvidence所有の分離が変える体験
        ▼
After
────────────────
- 何が未完了か、何を変えたか、何が成立を証明するか、現在品質は何かを役割別に辿れる
```

Work LifecycleとEvidence所有の分離は、単に内部方式を成立させる要求ではない。「Roadmap、CHG、Evidence、Qualityの置場と役割が重なり、現在状態と履歴を探し回る」状態から、「何が未完了か、何を変えたか、何が成立を証明するか、現在品質は何かを役割別に辿れる」状態へ変わり、利用者が次の判断へ進めることまでを体験として扱う。

この変化で守るのは操作手順ではない。CRDD保守者・監査者がWork・Change・Evidence・Qualityを役割別に辿ることで、変更理由と全影響Pathを重複なく確認できるようになることを守る。

## 4. UX成果への統合

```text
REQ-000033
   │
   └─ New  → UX-000029 Work・Change・Evidence・Qualityを迷わず辿る
```

| UX成果 | 処置 | 判断理由 | この要求が補う内容 |
|---|---|---|---|
| Work・Change・Evidence・Qualityを迷わず辿る | `New → UX-000029` | 本要求が「未完了、変更理由、全影響Path、成立根拠および現在品質を役割の違いとともに辿れる」という独立した利用者成果を最初に定義する。 | 各Ownerから状態・差分・Evidenceを接続することが、この要求固有の成立条件になる |

Same／Newは技術用語の近さや件数目標では決めない。「利用者は、どの状況で、何をするためにSystemと関わり、何ができるようになるか」が同じかを比較する。Capability、Information、Quality、Validationまたは下流の実現要素は、独立UXへ分割せず対応する成果の成立条件として保持する。

## 5. 重要な体験

### このREQのJourney

```text
変更の現在地や根拠を調べる時
        ↓
各Ownerから状態・差分・Evidenceを接続する
        │
        ├─ ★ Critical: 変更の影響漏れを確認する場面
        ├─ ⚠ Failure:  同じ説明を複製し代表ファイルだけで済ませる
        └─ ✓ Quality:  正本を分け全影響ファイルを列挙する
        ↓
変更理由と全影響Pathを重複なく確認できる
```

### Service Blueprintの処置

処置: `作成`

```text
[U: CRDD作成者・保守者]
        │ 利用者行動: 目的に応じて未完了・変更理由・根拠・品質を辿る
        ▼
[T: 変更の現在地や根拠を調べる時]
        │
        ├─ 時間差: 各Ownerの成果物更新後にChange Viewが再投影される
        ├─ 完了時: Work、Change、全影響Path、Evidence、現在品質への参照
        └─ 失敗時: 所有先不明または参照切れの情報を該当成果物Ownerへ返す
                     │
                     ▼
             [R: 各成果物Owner]
                     │ 返却された事実と判断不能範囲を確認
                     └─ 次の行動: 正本を修正するか、現在状態と未完了を明示する

---------------- 可視境界 ----------------
                     │ 時間関係: 各Ownerの成果物更新後にChange Viewが再投影される
                     ▼
[S: 提供System]
        └─ 提供責務: Owner間のRelationと全影響Pathを提示する
```

この図は、利用者行動、利用者が観測する接点、提供責務および失敗時の引き渡しを示す。内部Componentの構造やProtocolは下流工程で具体化する。

### 横断Synthesisへの接続

- Journeyの横断統合先: [標準を変更・検証・公開する](../../03_Experience_Map.md#標準を変更検証公開する)
- Service Blueprintの横断統合先: [共同Service Blueprint](../../04_Service_Blueprint.md#1-共同service-blueprint)
- 横断成果物はこの個別分析から共通パターンを合成する。このREQのJourney、責任境界または品質の代替にはしない。

### このREQでの責任境界

| 担い手 | この要求で担うこと | 越えてはならない境界 |
|---|---|---|
| CRDD作成者・保守者 | 目的に応じて未完了・変更理由・根拠・品質を辿る | 一つの成果物を全情報の正本とみなさない |
| 各成果物Owner | 担当する状態・差分・Evidenceを現在の正本として保つ | 他Ownerの説明を複製して上書きしない |
| 提供System | Owner間のRelationと全影響Pathを提示する | 代表ファイルだけで影響範囲を省略しない |

### 補足する品質

- 結果または状態を最初に受け取る時: 同じ説明を複数正本へ複製しない。（避ける失敗: Roadmap、CHG、Evidence、Qualityの置場と役割が重なり、現在状態と履歴を探し回る）
- 結果を判断または引き継ぐ時: CHGから全影響Pathを確認できる。（避ける失敗: 必要条件を満たしていないのに完了・正常と理解する）
- 失敗・不足から次の行動を選ぶ時: 過去Evidenceを現在状態で上書きしない。（避ける失敗: 成立不能の理由や回復先が分からないまま作業が止まる）


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
| 何が未完了か、何を変えたか、何が成立を証明するか、現在品質は何かを役割別に辿れることで、Roadmap、CHG、Evidence、Qualityの置場と役割が重なり、現在状態と履歴を探し回るという負担または誤認を減らせる。 | 代表シナリオの利用者確認、UX専門Review、および品質期待を破る反例による下流検証 | CRDD作成者・保守者が「Work・Change・Evidence・Qualityを役割別に辿る」を行う際の判断基準、許容負担、利用環境および失敗後の選択 |

### 工程別の引き渡し

| 引き渡し先 | 具体化する義務 |
|---|---|
| 下流工程 | IAはWork LifecycleのNavigationとEntity関係を分け、Release・Quality・Checkerは各Owner境界を維持する。 |

Discoveryへ戻す条件は、想定した利用者、問題または「Work・Change・Evidence・Qualityを役割別に辿る」という必要性が誤っていると分かった場合である。下流は実現方式を具体化してよいが、「変更理由と全影響Pathを重複なく確認できる」という成果を無断で弱めない。
