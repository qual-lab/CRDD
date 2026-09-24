# QA-000005 候補と正本への引き渡しの検証定義

成果物種別: Quality定義
Quality ID: `QA-000005`
検証目標: 観測した情報を候補として隔離し、人間の採否後だけ所有正本へ引き渡すこと
主な試験段階: Integration／System／User Acceptance
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | Obligation Key | 導出元 | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|---|
| [REQ-000012](../../../01_Discovery/Definitions/REQ-000012/requirement.md) | `req-000012.qa-000005` | Requirement Definition（成立条件・失敗・検証意図） | Meetingの時点記録を保ったまま候補を抽出できる。既存Topicへの統合、新規Topic、正式正本更新、不採用を人間が区別できる。採用後は所有正本を更新し、候補や投影を第二正本にしない。既存Topicと重複する候補、新規論点、決定候補、不採用候補を処理し、時点記録、判断、正本反映を観測する | IT／ST | `CPR-IT-001`、`CPR-IT-004`、`CPR-ST-005` |
| [REQ-000027](../../../01_Discovery/Definitions/REQ-000027/requirement.md) | `req-000027.qa-000005` | Requirement Definition（成立条件・失敗・検証意図） | 外部作用（Effect）の前に送信先、目的、操作、情報分類、許可範囲を確定する。外部内容を指示、決定権限、要求、因果へ自動昇格せず出典付き観察として戻す。新しい要求や方針変更は人間採用判断を経て所有正本へ反映する。許可／不許可情報、外部指示、矛盾情報、公開反応、依存更新を与え、外部送信による作用と内部昇格を観測する | UAT | `CPR-UAT-002`、`CPR-UAT-003` |
| [UX-000014](../../../02_UX/Definitions/UX-000014/ux_definition.md) | `ux-000014.qa-000005` | UX Definition（利用者成果・重要場面・重要な失敗） | 会話・観察・仮説・候補・決定を区別し、既存Topicとの関係を根拠付きで判断して所有正本へ戻せる。重要場面「候補を採用または却下する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。会話の自動採用と文字列一致だけの統合・分割を反証する | IT／UAT | `CPR-UAT-002`、`CPR-IT-001` |
| [UX-000024](../../../02_UX/Definitions/UX-000024/ux_definition.md) | `ux-000024.qa-000005` | UX Definition（利用者成果・重要場面・重要な失敗） | 外部作用（Effect）の前に送信先・目的・操作・情報分類・許可範囲を理解し、外部情報・反応・依存新版を出典付き候補として扱える。重要場面「外部作用（Effect）の前と結果昇格時」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。接続済み・過去同意からの包括許可、不要情報送信、外部反応・依存新版の要求／因果／方針への自動昇格を反証する | IT／UAT | `CPR-UAT-003`、`CPR-IT-001`、`CPR-UAT-002` |
| [IA-000010](../../../03_IA/Definitions/IA-000010/ia_definition.md) | `ia-000010.qa-000005` | IA Definition（情報・関係・状態・見つけ方） | 会話を自動採用せず、候補を既存論点と比較して所有正本へ戻す。UX-000014: 観測済み（observed）／候補（candidate）／採用（adopted）／却下（rejected）。会話と正本を分ける | IT | `CPR-IT-001`、`CPR-IT-004` |
| [IA-000017](../../../03_IA/Definitions/IA-000017/ia_definition.md) | `ia-000017.qa-000005` | IA Definition（情報・関係・状態・見つけ方） | 外部へ何をなぜ渡すかを判断し、戻った結果を自動採用しない。UX-000024: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | IT | `CPR-IT-001`、`CPR-IT-004` |
| [UI-000009](../../../04_UI/Definitions/UI-000009/ui_definition.md) | `ui-000009.qa-000005` | UI Definition（認識・操作・Feedback・失敗表示） | 会議内容から継続論点や候補を見つけ、採否へ進める。UX-000014: 会議の内容を候補として整理し正本へつなぐ: 候補を採用または却下する場面: 候補・判断・反映結果を区別する: 会議記録が自動的に正本へ昇格する。UX-000014／IA-000010: 観測済み（observed）／候補（candidate）／採用（adopted）／却下（rejected）。会話と正本を分ける: Meeting→Item→候補→既存Topic比較→採否→所有正本 | IT／UAT | `CPR-IT-001`、`CPR-UAT-002`、`CPR-IT-004` |
| [UI-000016](../../../04_UI/Definitions/UI-000016/ui_definition.md) | `ui-000016.qa-000005` | UI Definition（認識・操作・Feedback・失敗表示） | 外部へ渡す範囲を理解し、戻った候補を採用前に判断できる。UX-000024: 送信範囲と内部へ戻す際の昇格条件を理解する: 外部作用（Effect）の前と結果昇格時: 同意・投影・採用を分離する: 接続済みを包括許可とし、外部反応や依存新版を要求・因果・方針へ自動昇格する。UX-000024／IA-000014: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）: 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否。UX-000024／IA-000017: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）: 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否 | IT／UAT | `CPR-IT-001`、`CPR-IT-004`、`CPR-UAT-003` |
| [SPEC-000013](../../../05_SPEC/Definitions/SPEC-000013/spec_definition.md) | `spec-000013.qa-000005` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 候補の出所、判断者、採否、反映先を辿れる。境界: 新規候補／既存候補、採用／却下／保留を分け、未採用候補で正本を変更しない。失敗: 文字列一致だけで統合・分割せず、会話を自動採用しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「候補記録を作成し、採用時だけ所有正本を更新する。却下時は正本Effect 0」と矛盾する結果を返さない。失敗: 文字列一致だけで統合・分割せず、会話を自動採用しない。副作用: 候補記録を作成し、採用時だけ所有正本を更新する。却下時は正本Effect 0。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／UAT | `CPR-UAT-003`、`CPR-IT-001`、`CPR-IT-004` |
| [SPEC-000027](../../../05_SPEC/Definitions/SPEC-000027/spec_definition.md) | `spec-000027.qa-000005` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 採否と反映先を辿れ、却下・保留では所有正本を変更しない。境界: 採用／却下／保留、対象改訂版一致／不一致を分け、採用時以外は所有正本を変更しない。失敗: 結果受領や送信許可を候補採用Authorityへ流用しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「採用時だけ所有正本を更新する。却下・保留では正本Effect 0」と矛盾する結果を返さない。失敗: 結果受領や送信許可を候補採用Authorityへ流用しない。副作用: 採用時だけ所有正本を更新する。却下・保留では正本Effect 0。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／UAT | `CPR-UAT-003`、`CPR-IT-001`、`CPR-IT-004` |
| [ARCH-000006](../../../06_Architecture/Definitions/ARCH-000006/architecture_definition.md) | `arch-000006.qa-000005` | Architecture Definition（責務・境界・状態・故障） | Meeting内の観測、候補、採用、却下を区別し、候補作成と正本更新のAuthorityを分ける。媒体ではなく項目の目的で候補種別を決める。所有する責務: Meeting ItemからTopic／Decision候補を作り、出所と採否を追跡するLifecycle。所有しない責務: Meeting本文の意味決定、候補の自動採用、各所有正本の内部規則。主な外部境界: Meeting正本、Topic／Decision等の所有正本、人間判断。SPEC-000013: 文字列一致だけで統合・分割せず、会話を自動採用しない。Effect: 候補記録を作成し、採用時だけ所有正本を更新する。却下時は正本Effect 0。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／UAT | `CPR-IT-001`、`CPR-IT-004`、`CPR-UAT-003` |
| [ARCH-000015](../../../06_Architecture/Definitions/ARCH-000015/architecture_definition.md) | `arch-000015.qa-000005` | Architecture Definition（責務・境界・状態・故障） | not_authorized→authorized→sent→returned→candidate→adoptedを別AuthorityとEffectにし、送信、受領、採用を相互流用しない。所有する責務: 目的限定の送信同意、最小化送信、同じ依頼への結果帰還、候補隔離、採否。所有しない責務: 送信同意からの結果採用、外部AIへの決定権限移譲、所有正本の無断更新。主な外部境界: 外部AI／API／MCP、Candidate Store、所有正本、人間判断。SPEC-000021: 期限切れ・範囲変更・不明な同意ではEffect 0で停止する。Effect: 許可範囲の外部送信Effectを発行し、送信時の依頼識別情報と同意範囲を結果へ結合する。SPEC-000026: 送信時の識別情報へ結合できない結果は採用可能な候補へしない。Effect: 受領した結果を元Taskへ結合し、未信頼候補として返す。Provider Effectを再発行しない。SPEC-000027: 結果受領や送信許可を候補採用Authorityへ流用しない。Effect: 採用時だけ所有正本を更新する。却下・保留では正本Effect 0。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／UAT | `CPR-IT-001`、`CPR-IT-004`、`CPR-UAT-002` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [coordinator](../../../06_Architecture/Details/coordinator/01_Architecture.md) | 実行編成、Authority、外部Effect、候補、回収・回復 |
| [mcp](../../../06_Architecture/Details/mcp/01_Architecture.md) | Transport変換、公開Schema、Session、結果搬送 |
| [project-operation](../../../06_Architecture/Details/project-operation/01_Architecture.md) | Project運営状態、Meeting／Topic候補、正本への引渡し |

## 2. 成立の流れ

```text
[観測／外部結果]
       ↓ 出所と同じ依頼を保持
[隔離された候補]
       ↓
[人間の採用／却下]
   ┌────┴────┐
   ↓               ↓
[所有正本]     [候補の破棄／保留]
```

## 3. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
| --- | --- | --- | --- | --- |
| UT | Conditional | 候補状態と採否判定の純粋規則 | N/A | 状態判定を独立実装する場合に必要 |
| IT | Required | 観測結果、Candidate Store、正本Writerの境界 | Related 2 Blocks | 候補隔離と正本Effect 0を共同確認するため |
| ST | Required | 観測から候補作成、採否、正本反映まで | System/E2E | 一部のStore成功だけで昇格成立にしないため |
| UAT | Required | 人間が採用・却下・保留を選び結果を理解する場面 | User Acceptance | 採否は人間の決定権限を含むため |

### 条件区分の適用

| 条件区分 | 適用 | 対応Local Item | 判断理由 |
|---|---|---|---|
| 正常 | Required | CPR-IT-001、CPR-UAT-002、CPR-ST-005 | 通常の成立経路を独立して確認する。 |
| 境界 | Required | CPR-IT-006、CPR-UAT-007 | 値、Authority、情報、責務または利用者判断の境界を確認する。 |
| 準正常 | Required | CPR-UAT-003 | 継続可能な分岐、保留、観測不能または診断状態を成功へ畳まない。 |
| 異常 | Required | CPR-IT-004 | 不正入力、故障または拒否経路を通常成功へ畳まない。 |
| 回復 | N/A | - | 失敗後の再入場または回復義務を持たない。 |

## 4. 検証項目

| Local ID | 条件区分 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測 | Oracle | Evidence | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CPR-IT-001` | 正常 | IT | Contract／Persistence | 観測結果→Candidate Store | Direct Boundary | 出所・対象改訂版・依頼Identityを持つMeeting Itemまたは外部処理結果 | 正本を変更せず候補を作成する | CPR-IT-001として、「正本を変更せず候補を作成する」前後の観測結果→Candidate Storeについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 出所、対象改訂版、同じ依頼、候補Identityを保持 | CPR-IT-001、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「出所、対象改訂版、同じ依頼、候補Identityを保持」および終了後条件「正本Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 正本Effect 0 | Automated |
| `CPR-UAT-002` | 正常 | UAT | Acceptance／Authority | 候補表示→人間判断→正本Writer | User Acceptance | 未採用候補、対象Ownerと範囲、採用権限を持つ決定権限者 | 決定権限者が採用範囲を選び正本反映を許可する | CPR-UAT-002として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 対象Ownerと範囲を再確認し、採用した内容だけ正本へ反映 | CPR-UAT-002、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「対象Ownerと範囲を再確認し、採用した内容だけ正本へ反映」および終了後条件「候補と採用結果を相関」を保存する | 候補と採用結果を相関 | Hybrid |
| `CPR-UAT-003` | 準正常 | UAT | Acceptance／Decision | 候補表示→人間判断 | User Acceptance | 未採用候補と、却下または保留の理由・再評価条件 | 決定権限者が却下または保留を選ぶ | CPR-UAT-003として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 正本を変更せず、理由と再評価条件を必要範囲で保持 | CPR-UAT-003、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「正本を変更せず、理由と再評価条件を必要範囲で保持」および終了後条件「正本Effect 0」を保存する | 正本Effect 0 | Hybrid |
| `CPR-IT-004` | 異常 | IT | Security／Authority | Candidate Store→Authority Gate→正本Writer | Related 2 Blocks | 権限なし自動採用、出所不明、別依頼結果、Owner不明の各反例 | 各反例から正本反映を要求する | CPR-IT-004として、「各反例から正本反映を要求する」前後のCandidate Store→Authority Gate→正本Writerについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 採用を拒否し、候補の隔離と原の正本を保持 | CPR-IT-004、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「採用を拒否し、候補の隔離と原の正本を保持」および終了後条件「追加送信・正本Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 追加送信・正本Effect 0 | Automated |
| `CPR-ST-005` | 正常 | ST | Scenario／Promotion | Meeting観測→候補→人間判断→所有正本 | System/E2E | 同じMeetingから抽出した既存Topic候補、新規Topic候補、不採用候補 | 各候補を作成し、採否を分けて処置する | CPR-ST-005として、「各候補を作成し、採否を分けて処置する」前後のMeeting観測→候補→人間判断→所有正本について、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 時点記録を保ち、採用分だけ所有正本へ一度反映する | CPR-ST-005、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「時点記録を保ち、採用分だけ所有正本へ一度反映する」および終了後条件「未採用候補と正本を混同せず、重複反映0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 未採用候補と正本を混同せず、重複反映0 | Hybrid |
| `CPR-IT-006` | 境界 | IT | Context Adoption Boundary | Candidate Store→所有正本 | Adjacent 1 Block | 採用、却下、保留、競合Revision、媒体名だけが同じ候補 | 人間判断を所有正本へ適用する | Candidate Identity、判断、Revision、正本Effectを記録する | 明示採用だけが一回反映され競合・媒体名から意味を推定しない | Candidate、判断、Revision、Effect、判定 | 未採用正本Effect 0 | Automated |
| `CPR-UAT-007` | 境界 | UAT | Acceptance／Context Promotion | 候補→利用者判断→所有正本 | User Acceptance | Topic／Meeting／Communication候補と根拠、競合・不明候補 | 利用者が採用先と採否を判断する | 判断、理由、理解できない項目、保留範囲を記録する | 利用者が候補の意味と所有先を理解して採否を選べる | 参加条件、候補、判断、理由 | 判断前の正本Effect 0 | Manual |

## Semantic Coverage Pilot

この表はQuality Local Itemが検証する設計上の意味だけを正方向で宣言する。逆方向の一覧は生成し、本文の類似表現から推測しない。

| Local ID | Semantic Key |
|---|---|
| `CPR-IT-001` | `coordinator.candidate-review-boundary` |

## 5. 評価とEvidence

候補生成の成功を正本反映の成功にしない。Evidenceは候補の出所、人間判断、対象Owner、実際の反映範囲、却下／失敗時のEffect 0を別々に記録する。

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
