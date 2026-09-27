# UX-000034 Projectの意味と作業差分を一つの流れで扱う

成果物種別: UX定義
UX ID: `UX-000034`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

Projectの現在地と次の仕事を理解し、関連する作業差分を確認して安全な共有まで一続きで進める。

```text
開発者／Project運営者
        │ 状況を見て作業し、変更を共有する時
        ▼
Projectの意味と作業差分を結ぶ
        │
        ▼
次の仕事、差分、共有対象を取り違えず進める
```

## 利用者・状況・目的

| 項目 | 内容 |
|---|---|
| 主な想定利用者／利用状況 | 開発者とProject運営者／PMが、Projectの状況を確認して関連作業を進める状況 |
| 利用のきっかけ／場面 | Projectの現在地から次の仕事を選び、変更を確認・共有する時 |
| 目的 | Project上の判断とRepository上の変更を一続きで扱う |
| 得られる結果 | 状況理解から次の仕事、差分確認、Commit、通常Pushまで進み、必要ならOwnerや別入口へ戻れる |

## 利用者に起きる変化

```text
変更前
Project情報、AI、Editor、Git Clientを行き来して意味と差分を結ぶ
        ↓
変更後
Projectの現在地、次の仕事、変更内容、共有対象を一続きで判断する
```

Workbenchの利用を強制せず、Chat＋MCP、CLI、Editorおよび既存Git Clientを代替経路として維持する。

## 成立条件

- Project ContextからRoadmap、Topic、Meeting、Decision／Action、Quality、DocumentationおよびRuntime Stateへ進める。
- Attention、関係・経緯、依存、比較・変化および次の仕事からOwner情報へ戻れる。
- Repository、Branch、HEAD、Staged、Unstaged、Untracked、ConflictおよびDiffを確認できる。
- Stage、Unstage、Commitおよび設定済みUpstreamへの通常Pushを一続きで扱える。
- Push前にRemote、Branch、送信対象Commitを理解し、人間が明示確認できる。
- Workbenchがなくても、同じ正本と公開能力を別入口から利用できる。
- 欠測、競合、権限不足、観測不能、Push拒否または部分失敗を成功へ畳まない。

## 重要な体験・失敗・品質期待

```text
Projectの状況を確認する
        ↓
次の仕事を選び、TreeとDiffを確認する
        ↓
Stage／Commit
        │
        ├─ ★ 重要場面: 外部へPushする直前
        ├─ ⚠ 失敗: 誤ったRemote・Branch・Commitを送る
        └─ ✓ 守る品質: 送信対象を示し明示確認を得る
        ↓
共有または別入口への引き継ぎを完了する
```

### 重要な失敗

- 横断要約を完全なProject状態または保存済み事実と誤認する。
- Workbench固有StoreやGit情報を業務正本として扱う。
- 誤ったRemote、BranchまたはCommitを確認なしにPushする。

### 体験品質への期待

- 結論、根拠、次の仕事、差分の順に段階的に理解できる。
- Project情報とVersion Control情報のOwnerおよび現在状態を区別できる。
- 外部Effect前に対象と結果見込みを確認でき、失敗後の状態と次行動が分かる。

## 必要な情報

Project Context、Owner Relation、Attention、関係・経緯、次の仕事、Repository、Branch、HEAD、Tree、Staged／Unstaged／Untracked／Conflict、Diff、Commit、Remote、Push対象、Authority、操作結果および終了後状態。

## 責任境界・制約・対象外

- UXが定義すること: Project上の意味と作業差分を一続きで扱う成果、重要場面、失敗および品質期待。
- 下流工程へ残すこと: 情報構造、Screen、Navigation、Visual、操作、Version Control Adapter、確認および回復方式。
- 制約: Workbenchを唯一の入口にせず、Git CommitをProjectや業務成果物のIdentityにしない。
- 対象外: フルIDE、Force Push、暗黙のUpstream作成、Branch作成、Merge、RebaseおよびRemote設定管理。

## 未確認事項と戻り条件

- 未確認事項: 役割別情報量、常時表示、部分Stage、Large Repository、認証失敗時の負担および既存Toolとの比較価値。
- 現在判定: 後続確認が必要。現在のUX定義を止める事項ではない。
- 確認事項: Workbenchが再探索と対応付け負担を減らし、誤操作を増やさないか。
- 判断者: 開発者、Project運営者／PMおよびQual-Lab。
- 未確認時の影響: Screen、Visual、詳細操作、性能条件および初期範囲の拡張を確定しない。
- Discoveryへ戻す条件: 既存入口より負担や誤操作が増える、Owner Relationを失う、または維持費が価値を上回る場合。
- UX分析へ戻す条件: Project理解と作業差分の接続が一つの利用者成果として成立しない場合。

## 検証意図

Projectの現在地から次の仕事を選び、Owner情報と作業差分を確認してCommit・通常Pushまで進めること、Workbenchを使わない経路も保つこと、Push前確認と失敗後状態が理解できることを観測する。

## 下流への引き渡し

| 接続先 | 保持する意味 |
|---|---|
| IA（直後工程への正式な引き渡し） | Project Context、Owner情報、Attention、関係・経緯、次の仕事、Repository、Tree、差分、Stage、Commit、Remote、BranchおよびPush対象 |
| Quality Analysis / UX（伴走） | 状況理解、入口代替性、Owner到達、誤操作防止、Push前確認、欠測・競合・失敗後の行動 |
| UI（後続Contract Relation） | 情報量、段階的開示、作業の連続性、Diff／Stage／Pushの認識と確認 |
| SPEC（後続Contract Relation） | Projection、定型操作、Version Control結果、外部Effect、確認、失敗および回復の成立条件 |

## 関係

- 元の要求分析: [REQ-000040](../../Analysis/REQ-000040/ux_analysis.md)
- 製品全体の整理: [想定利用者](../../02_Personas.md)、[利用体験の全体像](../../03_Experience_Map.md)、[サービス提供の流れ](../../04_Service_Blueprint.md)、[体験品質として守ること](../../05_Quality_Expectations.md)

## Checklist

- [x] UX IDと表題から独立した利用者成果を識別できる
- [x] 定義単独で利用者、利用場面および前後の状況を理解できる
- [x] 利用者の目的を理解できる
- [x] 得られる結果をUI操作ではなく独立した利用者成果として表現した
- [x] 利用前後の変化を必要な範囲で説明した
- [x] 成立条件を観察可能な意味で説明した
- [x] 重要場面を処置した
- [x] 重要な失敗を処置した
- [x] 体験品質への期待と必要性を処置した
- [x] 必要な情報をIAへ引き渡せる
- [x] UXが所有する責任と下流へ残す判断を区別した
- [x] 制約と対象外を保持した
- [x] 未確認事項と影響を明示した
- [x] 人間による評価または確認の必要性を評価した
- [x] 検証意図を具体的なTest Caseへ先取りせず定義した
- [x] IAへの正式な引き渡しを明示した
- [x] Quality Analysis / UXへの伴走入力を明示した
- [x] UIとSPECが後続で保持するUX ContractをIAへの工程移行と区別した
- [x] IAがUX Analysisを読み直さずDefinitionから開始できる
- [x] 下流成果物、Architectureまたは現行実装をUXへ逆輸入していない
- [x] DiscoveryまたはUX分析へ戻す条件を明示した
- [x] 補足定義へ必須情報を退避していない
