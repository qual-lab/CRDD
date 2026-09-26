# Project情報と作業ツリーを一つの入口で扱う

成果物種別: Discovery分析
探索ID: `EXP-000033`
状態: 要求採用
主な情報源・根拠: v0.21以前のWorkbench構想、v0.22再Discovery、Project Context／MCP／Version Control範囲に関する人間との対話
判断する人: Qual-Lab
記録の性質: v0.22開始時の再Discovery
下流の主要CHG: 未作成

> 本探索は既存Workbench WIPやDashboard案を正解として採用しない。利用者がProject情報と現在の作業状態を扱う時、専用入口が解くべき問題を確認する。

## 事前入力の理解確認

AIは当初、WorkbenchをProject Contextの五場面を表示する薄いViewとして理解した。人間との確認により、Topic、Meetingその他のMCPで扱う情報、さらに横断分析とVersion Controlの現在状態・操作まで必要だと修正された。

```text
AIの事前理解
Project Contextを表示する薄いWorkbench
        ↓ 人間による修正
Project Context以外にも多くのProject情報が必要
        ↓ 追加確認
MCPで操作できる内容に加え、
Tree、Diff、Stage等の簡易SourceTreeが必要
        ↓ 追加確認
Stage／Unstage／Commitに加え、通常Pushも必要
        ↓ 現在理解
WorkbenchはProject理解、業務Context操作、
Version Controlを一つにつなぐ人間向け作業入口
```

## きっかけ

現在のCRDD作業では、Projectの現在地を理解するためにMarkdownやAIを使い、TopicやMeetingを扱うために正本ファイルを探し、差分やStage、Commit、PushのためにGit ClientやCLIを使う。各手段は個別には成立していても、利用者は「何が起きているか」「何を変えたか」「次に何をするか」を自分でつなぐ必要がある。

Project Contextを標準化すれば現在地の説明は揃うが、それだけでは詳細確認、候補処置、差分確認および変更の送信まで進めない。反対に、Git Clientだけでは変更のProject上の意味、判断待ち、Quality、TopicおよびMeetingを理解できない。

## 本当の問題は何だったか

問題はDashboardやGit GUIがないことではない。Projectの意味を扱う入口と、現在の作業ツリーを扱う入口が分かれ、利用者が複数の道具の情報を頭の中で結び直さなければ、状況理解から次の仕事まで進めないことである。

```text
Project Context／Roadmap／Topic／Meeting／Quality
                    │
                    ├─ 利用者が自分で結合 ─┐
                    │                       │
Git Tree／Diff／Stage／Commit／Push ────────┘
                                            ↓
                                 判断と次の仕事
```

## こうすれば解けると考えた

Project情報の正本と共通Application Capabilityを利用し、現在の作業ツリーをVersion Control Adapterから取得するWorkbenchを設ける。Workbenchは情報を再所有せず、人間の判断場面に合わせて複数情報を横断投影し、許可された定型操作へ接続する。

| 能力群 | Workbenchで得たいこと | 正本／境界 |
|---|---|---|
| Project Overview | 現在地、Risk、判断待ち、理由、次の一手をまとめて理解する | Project ContextとOwner Relation |
| Project情報 | Roadmap、Topic、Meeting、Decision／Action、Quality、Documentation、Runtime Stateを確認・操作する | 各Ownerと共通Application Capability |
| 横断投影 | Attention、Timeline、依存、比較、重要な変化を判断単位で見る | 元のOwner Relationを保持するProjection |
| Version Control | Tree、状態、Diff、Stage／Unstage、Commit、通常Pushを扱う | Version Control Adapter |
| 対話支援 | 現在事実と保存済み分析を基に追加説明・提案を得る | 事実・共有分析・対話時推論を区別する |

### 比較した代替

| 方向 | 保持できること | 残る問題 | 現在の判断 |
|---|---|---|---|
| Chat Agent＋MCPだけを使う | 自由な質問と操作 | Tree、Diff、Stage等の継続的な視覚確認と定型操作が弱い | 併用するが単独では不十分 |
| 既存Git Client＋Editor＋AIを使う | 成熟した専門機能 | Project Contextとの意味接続を利用者が行う | 専門的な代替として維持 |
| Project Contextだけを表示する | 現在地を短時間で理解できる | 詳細確認、操作、Version Controlへ進めない | Workbench完成形として不採用 |
| フルIDEを作る | 一つの画面で多くを扱える | Scopeと維持費が大きく、既存Editorと競合する | 初期範囲外 |
| Project仕事と簡易Version ControlをつなぐWorkbench | 状況理解から次の仕事まで一つの入口で進める | 情報過多、第二正本化、Git操作Riskを制御する必要がある | 採用 |

## 選んだこと、選ばなかったこと

Workbenchをv0.22の採用要求とする。Project Contextだけでなく、MCPで公開するProject情報と操作、Workbench固有の横断Projection、および簡易Version Control Viewを扱う。

Version Controlの初期操作は、状態・Tree・Diff・履歴の閲覧、Stage、Unstage、Commitおよび設定済みUpstreamへの通常Pushを含む。Push前にはRemote、Branchおよび送信対象Commitを示し、人間の明示確認後にだけ実行する。Force Push、暗黙のUpstream作成、Branch作成、MergeおよびRebaseは初期範囲外とする。Discardを採用する場合は、失う差分と復旧可能性を示す個別確認を必須にする。

Workbench固有のProject正本、Topic／Meeting Store、Authority Store、秘密値StoreまたはGit履歴依存の業務Storeは作らない。Workbenchを使わない通常のRepository作業も維持する。

## 後から分かったこと

Workbenchが必要とする「プラスアルファ」は情報項目を増やすことだけではなかった。複数のOwnerをAttention、関係・経緯、比較・変化および次の仕事へまとめることと、同じ判断場面で作業ツリーの差分を確認・処置できることに価値候補がある。

一方、これらを一画面へ詰め込むと情報過多になる。常時表示、必要時表示、深掘り導線および役割別の粒度はUX／IA以降で判断する必要がある。

## 採用した要求

[REQ-000040](../../Definitions/REQ-000040/requirement.md)を採用した。

## 現在地と次への引き渡し

Workbenchの必要能力と初期Version Control範囲を要求へ昇格した。次はUXで、Developer、Project運営者／PM、Managementのどの場面に何を常時見せ、どの操作をどの確認で行うかを分析する。IAではProject情報、Attention、Relation、Version Control状態を一つの情報構造へ統合し、UI／SPEC DetailでScreen Inventory、Flow、Hero、具体操作およびFailureを設計する。

Workbench固有価値は実利用で反証可能に保つ。Chat Agent＋MCPまたは既存Git Clientで同じ利用者成果をより低い負担で達成できる場合は、画面や機能を縮小するためDiscoveryへ戻す。

## Checklist

- [x] 情報源と、情報源から確認できる範囲を示した。
- [x] 事前入力からAIが意味を再構成した場合、AIの事前理解、人間の修正および確認後の現在理解を区別した。
- [x] 現在案を変え得る有力な代替または反証を人間と突き合わせるか、該当する案がない理由を示した。
- [x] 人間理解の確認と、要求・方針の採用判断を分けた。
- [x] 人間が抽象的な問題や要求を言語化できることを前提にせず、具体的な出来事、行動、迷い、回避策または比較から問題仮説を引き出した。
- N/A: 発言の少なさ、回答不能または沈黙は観測されず、必要情報と操作が段階的に明示されたため — 発言の少なさ、回答不能または沈黙を、同意、問題不存在または要求採用へ読み替えていない。
- [x] 確認できた事実と、そこから導いた解釈・仮説を区別した。
- [x] 解決策ではなく、本質的な問題を説明した。
- [x] 技術名称を除いても、誰が何に困っているか理解できる。
- [x] 影響を受ける人または判断する人を特定した。
- [x] どのような変化を期待するか説明した。
- [x] 原因と解決に関する仮説を、事実として扱っていない。
- [x] 未確認事項と不確実性を明示した。
- [x] 人間による確認または判断が必要かを評価した。
- [x] 情報不足をAIの推測だけで補っていない。
- [x] 失敗、リスク、制約および対象外を評価した。
- [x] 採用、不採用、保留を区別した。
- [x] 次工程が保持すべき問題、変化および条件を示した。
- [x] 情報不足時にDiscoveryへ戻す条件を示した。
- [x] 因果、比較または時系列を図示する必要性を判定し、作成または理由付きN/Aとして処置した。
- [x] 補足分析へ必須情報を退避していない。
