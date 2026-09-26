# REQ-000040 Project情報と作業ツリーをつなぐWorkbench

成果物種別: Discovery定義
要求ID: `REQ-000040`
Discoveryでの判断: 要求採用
判断する人: Qual-Lab
探索元: [EXP-000033](../../Analysis/EXP-000033/exploration.md)

## 要求

利用者は、Project Context、Roadmap、Topic、Meeting、Decision／Action、Quality、DocumentationおよびProject Runtime Stateを理解・操作しながら、同じRepositoryの現在Tree、差分、Stage状態、CommitおよびPushを一つのWorkbenchから扱えなければならない。

WorkbenchはMCPで公開するProject情報と同じApplication Capabilityを利用し、Project Context ViewerまたはMCP操作一覧に限定してはならない。複数のOwner情報からAttention、関係・経緯、依存、比較・変化および次の仕事を人間の判断場面へ投影し、各結論から所有正本へ戻れなければならない。

Version Control情報は差し替え可能なAdapterから取得し、Git CLI出力、Commit SHAまたはGit履歴をProject、Topic、Meetingその他の業務Identityや正本の代わりにしてはならない。未Commit状態も正常な作業状態として扱い、通常のProject操作をCommit済み状態だけに限定してはならない。

初期のVersion Control操作には閲覧、Stage、Unstage、Commitおよび設定済みUpstreamへの通常Pushを含めなければならない。Push前にはRemote、Branchおよび送信対象Commitを表示し、人間の明示確認後にだけ外部Effectを発行しなければならない。

## 対象と利用状況

Developer、Project運営者／PMおよび管理主体が、Projectの現在地を確認し、TopicやMeeting等の詳細へ進み、判断や定型操作を行い、同じ作業のRepository差分を確認してCommit・Pushする場面を対象とする。

Workbenchを使わない利用者、AI対話、CLI、既存Git ClientおよびEditorを排除せず、同じ正本と公開能力を別入口から利用できる状態を維持する。

## 解く問題と望ましい変化

```text
現在
Project情報、AI、Editor、Git Clientを行き来する
    ↓
利用者がProject上の意味と作業ツリーの差分を頭の中で結ぶ
    ↓
Workbench
Project理解、詳細、横断Attention、定型操作、Version Controlを接続する
    ↓
状況理解から次の仕事、差分確認、共有まで一つの流れで進める
```

## 採用理由と比較

| 選択肢 | 保持できること | 残る問題 | 判断 |
|---|---|---|---|
| Chat Agent＋MCP | 自由な質問と操作 | Tree、Diff、Stage等の継続的な視覚確認が弱い | 併用する |
| 既存Git Client＋Editor＋AI | 成熟した専門機能 | Project情報と差分の関係を利用者が結ぶ | 代替として維持 |
| Project Context Viewer | 現在地を短時間で確認できる | 詳細、操作、Version Controlへ進めない | 単独案として不採用 |
| フルIDE | 一つの製品で多くを扱える | Scopeと維持費が大きい | 初期範囲外 |
| Project仕事と簡易Version ControlをつなぐWorkbench | 状況理解から次の仕事と共有まで接続できる | 情報過多、第二正本化、外部Effectを制御する必要がある | 採用 |

## 成立条件

- Project Contextの五場面を入口に、Roadmap、Topic、Meeting、Decision／Action、Quality、DocumentationおよびRuntime Stateへ進める。
- MCPとWorkbenchが同じApplication Capability、Identity、状態語彙、Authorityおよび結果を利用する。
- Attention、関係・経緯、依存、比較・変化および次の仕事を、元のOwner Relation付きで理解できる。
- Repository、Branch、HEAD、Staged、Unstaged、Untracked、ConflictおよびDiffを確認できる。
- Stage、Unstage、Commitおよび設定済みUpstreamへの通常Pushを利用できる。
- Push前にRemote、Branch、送信対象Commitを確認し、明示承認なしに外部Effectを発行しない。
- Workbenchを使わなくても、AI、MCP、CLI、Editorまたは既存Git Clientから同じ正本と公開能力を利用できる。
- Workbench固有のProject正本、業務Store、Authority Storeまたは秘密値Storeを作らない。
- 未Commit状態でもProject情報の読取りと許可された操作が成立する。
- 欠測、競合、権限不足、Git観測不能、Push拒否または一部失敗を成功へ畳まない。

## 失敗・リスク・制約

- 多くの情報を一画面へ並べることを完成条件にしない。
- 横断ProjectionからOwner Relationを失わず、Workbenchだけでしか意味を復元できない状態を作らない。
- AIの追加推論を保存済み事実または共有分析として表示しない。
- Force Push、暗黙のUpstream作成、Branch作成、MergeおよびRebaseを初期範囲に含めない。
- Discardを採用する場合は、対象差分、失われる内容および復旧可能性を示した個別確認を必須にする。
- Credential、Token、Passwordその他の秘密値をWorkbench固有Store、表示、ログまたはProject Contextへ保存しない。
- Pushの要求発行、Remote受理および終了後のRemote状態を同一視しない。
- Git実装へ直接依存させず、Version Control境界から同等機能へ差し替え可能にする。

## 対象外

- 初期版でフルIDE、コードEditorまたは高度なGit Clientを再実装すること。
- Force Push、Branch作成、Merge、RebaseおよびRemote設定管理。
- Workbenchだけでしか実行できないProject操作を作ること。
- CI、Deploy先またはInfrastructureのLive監視をProject Contextへ取り込むこと。
- 具体的なScreen、Navigation、Hero、ComponentおよびVisual Directionの確定。

## 未確認事項と戻り条件

- 常時表示と必要時表示、役割別の情報量、Attentionの優先度および横断Projectionの最小範囲はUX／IAとDogfoodで確認する。
- Commit作成時のMessage支援、署名、Hook、部分Stage、Binary Diff、Large Repositoryおよび認証失敗の詳細はSPEC／ArchitectureでApplicabilityを評価する。
- Chat Agent＋MCPや既存Git Clientより作業負担が増える、Owner Relationが分からない、誤操作が増える、または維持費が利用価値を上回る場合はDiscoveryへ戻し、Scopeを縮小する。

## 検証意図

代表的なProject作業について、Projectの現在地を理解し、TopicまたはMeetingを確認・操作し、関連する変更差分をFile TreeとDiffから確認し、Stage、Commitおよび通常Pushまで進める。Owner Relation、欠測、競合、未Commit状態、Push前確認、Push拒否および実行後状態を観測し、Workbench固有Storeや秘密値保存なしに同じApplication Capabilityへ接続していることを確認する。Chat Agent＋MCPおよび既存Git Clientとの比較で、Workbench固有価値と追加負担も確認する。

## UXへの引き渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | 利用者がProjectの意味と作業ツリーを結び、状況理解から次の仕事、差分確認、Commit・Pushまで進めること。Workbenchを使わない経路も維持すること | Persona別の利用場面、情報量、重要場面、操作確認、失敗・回復、体験品質 |

## 関係

- 元の探索記録: [EXP-000033](../../Analysis/EXP-000033/exploration.md)
- 関連要求: [REQ-000007](../REQ-000007/requirement.md)、[REQ-000008](../REQ-000008/requirement.md)、[REQ-000010](../REQ-000010/requirement.md)、[REQ-000036](../REQ-000036/requirement.md)、[REQ-000038](../REQ-000038/requirement.md)、[REQ-000039](../REQ-000039/requirement.md)
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
