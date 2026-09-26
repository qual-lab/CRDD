# REQ-000039 TopicとMeetingの共通操作

成果物種別: Discovery定義
要求ID: `REQ-000039`
Discoveryでの判断: 要求採用
判断する人: Qual-Lab
探索元: [EXP-000032](../../Analysis/EXP-000032/exploration.md)

## 要求

利用者は、TopicとMeetingのそれぞれについて、登録、編集、削除、一覧および取得を、Chat Agent、MCP、Workbenchその他の入口から同じ意味と結果で利用できなければならない。各入口は同じApplication Capabilityを利用し、入口固有の正本、Lifecycleまたは削除規則を作ってはならない。

Topicは時間を越えて追跡する論点の現在状態、関係、経緯、昇格先および終了理由を保持しなければならない。Meetingは特定時点の記録、参加主体、Source、関連Topic、Decision／Action／更新候補および反映結果を保持し、後から判明した現在状態で当時の内容を無言で上書きしてはならない。

一度の回答または明確な操作で閉じる問い合わせや単発作業を、件数確保または履歴保存だけを目的としてTopicへ登録してはならない。調査、比較、人間判断、情報待ち、複数時点にわたる状態または経緯の追跡が必要になった論点をTopicとして扱う。具体的な変更が採用された場合はCHGへ接続し、変更の実行と検証をTopicへ重複保持しない。Topicは回答、現状維持、統合、保留または別Ownerへの移管でも終了でき、すべてのTopicにCHG作成を要求しない。

誤って登録したものまたは不要に作成したものは、他の成果物からRelationを持つ場合でも物理削除できなければならない。ただし削除前に、対象、参照元、参照先、失われる内容、Relationへの処置および復旧可能性を利用者へ示し、明示確認を得なければならない。削除対象以外のTopic、MeetingまたはOwner Artifactを連鎖削除してはならず、削除後に無効なRelationを残してはならない。

正当な履歴として成立しているTopicまたはMeetingは、単に現在不要になったことを理由に物理削除せず、終了、撤回、訂正または保持状態を使い分けなければならない。

Meetingは決まった形式のMarkdownとしてRepositoryに保存しなければならない。Meetingは、会議記録が確認され、Decision、Action、TopicおよびOwner Artifact更新の各候補が、完了、担当付きAction、Topicへの昇格、CHGへの接続、所有正本への反映、または理由付き不採用のいずれかへ全件処置された時点で閉じられなければならない。Meeting Action自体の完了をMeetingのClose条件にしてはならない。

Close後もMeetingが所有する未完了Actionの現在状態を更新できなければならない。ただし、会議当時の記録、判断またはOutcomeを現在状態で無言に上書きしてはならない。継続的な調査、判断または経緯の追跡が必要になったActionはTopicへ昇格でき、採用済みの具体的変更はCHGへ接続できなければならない。

TopicとMeetingは、単一Repositoryでも、情報境界により分離された複数Repositoryでも成立しなければならない。単一Repositoryでは同じRepositoryがTopicとMeetingを保持してよい。複数Repositoryでは、DEVとMGMT等の各Repositoryが同じTopic／Meeting契約を使用しつつ、自身の開示範囲に属する内容だけを保持しなければならない。

各TopicとMeetingのOwner Repositoryは一つでなければならない。同じLogical Projectに属すること、題材が似ていること、またはCROSで同時に表示されることを理由に、複数Repositoryへ本文またはIdentityを重複保持してはならない。複数の情報境界へ関係する論点を別Topicへ分ける場合、相手TopicまたはRepositoryの存在を開示できる時だけRelationを保持しなければならない。CROSは、現在の主体が参照できるOwner RepositoryのTopic／Meetingを統合表示できるが、統合されたTopic／Meeting正本を新設してはならない。

## 対象と利用状況

Project運営者、Meeting参加者、Topic責任者およびFront AIが、継続論点や会議記録を作成し、探し、読み、訂正し、不要な誤登録を削除し、後続の判断・Action・正本更新へつなぐ場面を対象とする。

現在は、入口に共通の操作契約がなければ、利用者またはAIがMarkdownの場所、書式、Relationおよび削除影響を入口ごとに解釈する必要がある。

## 解く問題と望ましい変化

```text
現在の状況
入口ごとにファイル探索・編集・削除方法が分かれる
    ↓ なぜ困るか
同じTopic／Meetingでも状態、Relation、履歴、結果が一致しない
    ↓ この要求が成立すると
同じApplication Capabilityで一通りの操作を行う
    ↓
入口を変えても同じ正本・Lifecycle・削除結果へ到達できる
```

## 採用理由と比較

| 選択肢 | 保持できること | 残る問題 | 判断 |
|---|---|---|---|
| 各入口からMarkdownを直接操作する | 早く個別入口を作れる | 入力、競合、Relation、削除結果が入口ごとに分かれる | 不採用 |
| 汎用Artifact CRUDへ統合する | API数を減らせる | Topic／Meeting固有の時間、候補、訂正、終了の意味が失われる | 単独案として不採用 |
| 読取りだけを共通化する | 安全な初期段階を作れる | 登録・編集・削除は直接編集へ戻り、日常操作が完成しない | 段階実装に限定 |
| Topic／Meeting別Application Capabilityを複数入口で共有する | 固有Lifecycleと一通りの操作を両立できる | Authority、競合、削除影響を設計・検証する必要がある | 採用 |

## 成立条件

- TopicとMeetingの両方で、登録、編集、削除、一覧および取得を利用できる。
- Chat Agent、MCP、Workbenchその他の入口が、同じ入力意味、状態語彙、Relation、Authorityおよび結果を利用する。
- 一覧から対象を識別し、取得結果から現在状態、経緯、Relation、根拠および次の処置へ進める。
- Topicの現在状態とMeetingの時点記録を区別し、相互にRelationをたどれる。
- 即時に回答・完了できる問い合わせまたは単発作業と、継続追跡が必要なTopicを区別できる。
- Topicから具体的な変更が採用された場合はCHGへ接続し、Topicだけで変更実行・検証の完了を主張しない。
- CHGへ進まないTopicも、回答、現状維持、統合、保留または移管の理由を残して終了できる。
- Meetingから生じた候補はREQ-000012に従って既存TopicやOwner Artifactと比較し、人間確認後に反映される。
- Meetingの記録確認状態、Outcome処置状態およびAction実行状態を区別できる。
- Meetingを閉じる前に、Decision、Action、TopicおよびOwner Artifact更新の候補が、処置先または理由付き終了へ全件解決される。
- 未完了Actionが残っていても、担当、期限、完了条件および追跡先が確定していればMeetingを閉じられる。
- Close後のAction状態更新と、会議当時の記録・判断・Outcomeの訂正を区別できる。
- 継続的な理解・判断が必要なActionはTopicへ、採用済みの具体的変更はCHGへ接続できる。
- 誤登録または余計に作成した対象は、Relationの有無だけを理由に削除不能にならない。
- Relationがある対象の物理削除前に、参照元、参照先、影響、Relation処置および復旧可能性を表示し、利用者の明示確認を得る。
- 物理削除後にDangling Relationを残さず、削除対象以外を暗黙に連鎖削除しない。
- 正当な履歴を持つ対象の終了、撤回、訂正と、誤登録の物理削除を区別する。
- 未Commitの作業状態でも通常操作を行え、Commit済みであることだけを成立条件にしない。
- 競合、権限不足、観測不能または一部更新失敗を成功へ畳まず、終了後状態と必要な回復を確認できる。
- 情報境界を分ける必要がないProjectでは、単一RepositoryだけでTopic／Meetingの全操作が成立する。
- Repository分離を使うProjectでは、各Topic／MeetingからOwner Repositoryを一意に特定でき、操作はそのRepositoryへ帰還する。
- CROSで複数RepositoryのTopic／Meetingを表示しても、Owner、Identityおよび開示境界を失わない。

## 失敗・リスク・制約

- 読取りCredentialまたはRepository参照可能性だけから書込み・削除Authorityを生成しない。
- 参照されているという理由だけで誤登録の削除を永久に禁止しない。
- 参照されている対象を、影響表示と人間確認なしに削除しない。
- Relationを先に消して対象削除に失敗する、または対象だけ消してRelationが残る部分成功を正常完了にしない。
- Meetingの過去記録を、現在のTopic状態や後続判断で無言に置換しない。
- 未完了Actionがあることだけを理由に、終了済みMeetingを無期限にOpenとして扱わない。
- Outcomeの処置先が未確定のまま、Meetingを処置済みまたはCloseと表示しない。
- 削除確認を、曖昧な一括同意、接続Credentialの存在またはAI判断だけで代替しない。
- Git Commit、Commit SHAまたはGit履歴をTopic／Meetingの業務Identityにしない。
- MCPまたはWorkbench固有のTopic／Meeting Storeを作らない。
- 問い合わせ件数を増やす目的で、即時に閉じた問い合わせまたは単発作業をTopicとして保存しない。
- 単一RepositoryのProjectへ、DEV／MGMT分離を一律に要求しない。
- Repository分離時に、同じTopic／Meeting本文をDEVとMGMTへ複製しない。
- 存在開示が許可されていない別RepositoryのTopic／MeetingまたはRelationを表示しない。

## 対象外

- 具体的なMCP Tool名、Resource URI、画面、Component、保存形式または実装技術の確定。
- Topic／Meetingから正式正本へ人間確認なしで自動反映すること。
- 単発問い合わせを保持する独立Entity、問い合わせ台帳または問い合わせ件数の網羅的な集計。
- 録音、文字起こしまたは会議中のリアルタイムAI支援。
- 削除対象とRelationを持つ別成果物の連鎖削除。
- Branch作成、CommitまたはPushをTopic／Meeting操作の必須前提にすること。

## 未確認事項と戻り条件

- 登録時の必須入力、Draft、重複判定、一覧Filter、Paginationおよび取得結果の詳細粒度は後工程で決める。
- 単発問い合わせの件数・傾向を保持する必要が実利用で確認された場合は、本要求へ暗黙追加せずDiscoveryを再開し、記録範囲、情報最小化、Ownerおよび保持期間を決める。
- 物理削除を一つのFilesystem transactionで閉じられない構成では、候補、確認、適用、失敗、回復および再実行可能性をArchitectureで具体化する。
- 実利用で確認負担が直接編集より大きい、Relation影響を安全に説明できない、入口間で結果が分かれる、または正当な履歴を誤って消す場合はDiscoveryへ戻す。

## 検証意図

TopicとMeetingについて、登録、編集、一覧、取得および削除を異なる入口から行い、同じ正本、Identity、状態、Relationおよび結果を観測できることを確認する。単一RepositoryだけのProjectでも全操作が成立し、Repository分離時はDEV／MGMT等が同じ契約の下で別の内容を保持し、CROSによる統合表示後もOwner Repositoryと開示境界を失わないことを確認する。同じ題材を理由に本文やIdentityが自動統合されず、非開示Relationが漏れないことも確認する。Meetingでは、未完了Actionを残したままでも記録確認とOutcome全件処置によりCloseでき、未処置Outcomeがある場合はCloseできず、Close後のAction状態更新が当時記録を上書きしないことを確認する。未参照の誤登録、Relationを持つ誤登録、正当な履歴を持つ対象、権限不足、競合および削除途中失敗を含め、影響表示と人間確認なしに物理削除されないこと、確認後はRelationを整合させて対象だけを削除できること、失敗時に部分成功を隠さないことも確認する。

## UXへの引き渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | 利用者が入口を変えてもTopic／Meetingを一通り扱え、誤登録はRelation影響を理解して削除でき、正当な履歴は終了・撤回・訂正として保持できること | 操作する人、利用場面、確認負担、重要場面、失敗、回復、体験品質 |

## 関係

- 元の探索記録: [EXP-000032](../../Analysis/EXP-000032/exploration.md)
- 関連要求: [REQ-000010](../REQ-000010/requirement.md)、[REQ-000012](../REQ-000012/requirement.md)、[REQ-000036](../REQ-000036/requirement.md)
- 下流工程への正式入力: UXはこの要求定義だけを正式入力として分析する。元の探索記録を直接の補助入力にせず、意味が不足する場合はDiscoveryへ差し戻す。

## Checklist

- [x] 要求だけを読んでも、必要な変化を理解できる。
- [x] 探索元と採用判断を一意に辿れる。
- [x] 対象、利用状況、問題および望ましい変化を説明した。
- [x] 特定の画面、実装または技術方式へ不要に固定していない。
- [x] 要求として採用した理由と主要な代替を示した。
- [x] 正常時の成立条件を判定可能な形で示した。
- [x] 不完全・異常・境界時にも守る条件を示した。
- [x] 成立主張を破る反証条件を示した。
- [x] 失敗、リスクおよび制約を評価した。
- [x] 対象外を明示した。
- [x] 未確認事項と人間確認の必要性を評価した。
- [x] 情報不足をAIの推測だけで補っていない。
- [x] 検証意図を、具体的な試験項目を先取りせず説明した。
- [x] UXが探索記録を直接読まず、この定義だけから分析を開始できる。
- [x] 下流工程の結論をDiscoveryへ逆輸入していない。
- N/A: 補足分析を使用していないため — 補足分析へ必須情報を退避していない。
