# IA分析: Projectの意味と作業差分を一つの流れで扱う

成果物種別: IA分析
分析対象: [UX-000034](../../../02_UX/Definitions/UX-000034/ux_definition.md)
状態: 分析済み

## 1. UXから受け取る意味

| 観点 | この分析で受け取る内容 |
|---|---|
| 利用者 | 開発者、Project運営者／PM |
| 場面 | Projectの状況から次の仕事を選び、変更を確認・共有する時 |
| 目的 | Project上の判断とRepository上の変更を一続きで扱う |
| 得たい結果 | 次の仕事、差分、共有対象を取り違えず進める |
| 重要場面 | 外部へPushする直前 |
| 避ける失敗 | Workbench固有正本、誤った送信対象、未確認Push、失敗状態の隠蔽 |
| 守る品質 | 結論からOwnerと差分へ戻り、外部Effect前に対象を確認する |

## 2. 情報候補と関係

| 情報Object | 利用者にとっての意味 | 同一性と関係の基準 |
|---|---|---|
| Project Context Projection | Projectの現在地と五場面 | Project ID＋Repository ID＋Repository Role |
| Owner情報 | 投影の根拠と詳細 | Owner Artifact ID／Relation |
| 次の仕事 | 現在選べる判断・Action | Owner Relationと現在状態に結合 |
| Repository | 作業対象 | Repository IDと検証済みRoot |
| 作業ツリー状態 | Staged／Unstaged／Untracked／Conflict | Repository＋Path＋観測改訂版 |
| 差分 | 変更前後の内容 | Repository＋Path＋比較基準 |
| Commit候補 | 共有前にまとめる変更 | 選択したStaged集合とMessage |
| Push対象 | Remoteへ送るBranchとCommit集合 | Repository＋Remote＋Branch＋送信対象Commit |
| 操作結果 | 要求、受理、拒否、終了後状態 | 操作Identityと終了後観測 |

```text
[O: Project Context Projection] ──根拠へ戻る──▶ [O: Owner情報]
             │                                      │
             └──次を示す──▶ [O: 次の仕事] ──対象にする──▶ [O: Repository]
                                                               │
                                                               ▼
                                                    [O: 作業ツリー状態]
                                                               │
                                          ┌────────────────────┴─────────────┐
                                          ▼                                  ▼
                                      [O: 差分]                       [O: Commit候補]
                                                                               │
                                                                               ▼
                                                                       [O: Push対象]
                                                                               │
                                                                               ▼
                                                                       [O: 操作結果]
```

図中の`[O:]`は情報Objectだけを表す。利用者、判断行為、利用者成果をObjectとして代用しない。

### Canonical化候補

| 接続先 | 分析Object | Canonical Object | 処置 | 判断理由 |
|---|---|---|---|---|
| IA-000023 | Project Context Projection | Project Context Projection | Same | 五場面とOwner Relationを保持する |
| IA-000023 | Owner情報 | 現在事実 | Merge | Owner Relationへ戻れる現在事実として保持する |
| IA-000023 | 次の仕事 | 共有分析 | Merge | 根拠・前提付きの次の一手候補として保持する |
| IA-000006 | Repository | リポジトリ | Same | Projectと作業対象の識別を保持する |
| IA-000007 | 作業ツリー状態 | 履歴管理状態 | Rename | 差替可能なVersion Control能力が提供する現在状態として保持する |
| IA-000007 | 差分 | 変更差分 | Rename | Pathと比較基準に結び付く変更として保持する |
| IA-000007 | Commit候補 | 変更集合 | Rename | Staged集合と共有前の変更単位を保持する |
| IA-000007 | Push対象 | 外部共有対象 | Rename | Remote、Branch、Commit集合を確認対象として保持する |
| IA-000007 | 操作結果 | 履歴管理操作結果 | Rename | 要求、受理、拒否、終了後状態を区別する |

## 3. 状態・可視性・導線・責任

| 観点 | 分析結果 |
|---|---|
| 状態 | Projectのcurrent／incomplete／conflicting、Treeのstaged／unstaged／untracked／conflict、Pushの確認待ち／要求済み／受理／拒否／不明を区別する |
| 可視性 | Project情報はRepository Role内、Version Control情報は現在Repository内で示し、Credential値は表示・保存しない |
| 導線 | Project Context→Owner／次の仕事→Repository→Tree→Diff→Commit候補→Push対象→操作結果 |
| 責任 | OwnerがProject情報を保ち、Version Control能力が作業状態を観測し、利用者がCommitとPush対象を決める |
| 時間的な意味 | Project投影、Tree観測、Commit、Remote反映の時点差を保持し、要求発行をRemote反映とみなさない |
| 情報の優先度 | 最初に結論・不完全性・次の仕事、次にOwner、変更状態、差分、外部共有対象を示す |
| 情報のまとまり | Project判断と対象Repositoryの作業状態をRelationで接続し、所有者は混ぜない |
| 判断権限 | Project判断はOwner、人間がStage／Commit／Pushを決め、接続CredentialだけからAuthorityを作らない |
| 重要な失敗 | Workbench固有正本、意味と差分の誤対応、誤Remote／Branch／Commit、失敗状態の隠蔽 |
| 制約・対象外 | Screen、Component、Git CLI、保存方式、性能条件、高度なGit操作は確定しない |
| 人間判断 | 役割別情報量とWorkbench比較価値をDogfoodで判断する。IA固有の追加判断はない |
| IAへ戻す条件 | Project OwnerとVersion Control Ownerを分離したまま一続きの導線を作れない場合 |
| 検証意図 | 各情報のOwner、時点、比較基準、外部共有対象および終了後状態を取り違えず辿れることを確認する |

ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。後続工程は、この責任境界を保ったまま実際の主体へ割り当てる。

### 未確認事項と判断

| 区分 | 内容 |
|---|---|
| UXから継承する確認事項 | 役割別情報量、常時表示、部分Stage、Large Repository、認証失敗時の負担、既存Toolとの比較価値 |
| 判断者 | 開発者、Project運営者／PMおよびQual-Lab |
| 現在判定 | 後続確認が必要。既存IA定義の補強は進められる |
| 未確認時の影響 | Screen、Visual、性能条件、高度な操作を確定しない |
| IAで追加した未確認事項 | なし |
| IA固有の追加人間判断 | なし |
| Discoveryへ戻す条件 | 既存入口より負担や誤操作が増える、Owner Relationを失う、または維持費が価値を上回る場合 |

## 4. 現実照合の参考情報（正式入力ではない）

この節は後続のReality Auditへ引き継ぐ参考情報であり、IA Candidateを導く正式入力ではない。前節までをUX Definitionから再導出した結果として優先する。

現在のGit Adapter、Workbench試作、MCP実装はReality Auditで比較し、IA候補へ逆輸入しない。

## 5. IA処置

`Same`として[IA-000023](../../Definitions/IA-000023/ia_definition.md)、[IA-000006](../../Definitions/IA-000006/ia_definition.md)、[IA-000007](../../Definitions/IA-000007/ia_definition.md)へ接続する。Project投影、ProjectとRepositoryの識別、手元作業とVersion Control状態へ分担し、Workbench固有の情報正本または新IA-IDは作らない。

## 6. 後続工程が保持する意味

| 接続先 | 保持する意味 |
|---|---|
| UI（UX＋IAの正式入力） | 結論・Owner・次の仕事・Repository・Tree・Diff・共有対象の優先度と導線 |
| SPEC（UX＋IAの正式入力） | Identity、観測時点、比較基準、状態、Authority、Push対象、要求・受理・終了後状態 |
| Quality Analysis / IA（伴走） | Owner到達、未Commit継続、送信対象確認、入口代替性、失敗後状態および秘密値非保持 |

ArchitectureやSourceへ直接引き渡さない。

## 7. 補足分析

なし。

## Checklist

- [x] 正式入力となるUX Definitionを一件だけ特定した
- [x] UXの利用者成果と重要な失敗を保持した
- [x] 情報候補と利用者にとっての意味を特定した
- [x] 同じ情報と異なる情報を識別する条件を処置した
- [x] 情報同士の関係を処置した
- [x] 全Canonical Object候補を分析Objectへ対応付け、暗黙の改名・分離・統合を残していない
- [x] Identity／RelationをCanonical側で再解釈させない変換根拠を残した
- [x] 状態と可視性を処置した
- [x] 時間的な意味を処置した
- [x] 情報の優先度・まとまり・見つけ方を評価した
- [x] 情報の責任者と判断権限を分けて評価した
- [x] 機能責任と実際の人物・組織・Componentへの割当を区別した
- [x] 欠損・誤認・古さ・競合・曖昧性を評価した
- [x] 人間判断の必要性を評価した
- [x] UXから継承する未確認事項・判断者・影響とIA固有事項を区別した
- [x] UI・SPEC・Quality Analysis / IAへの接続を区別した
- [x] 情報構造の検証意図を評価した
- [x] 画面・Component・DB・API・Classを先取りしていない
- [x] 現行UI・Architecture・Sourceから意味を逆輸入していない
- [x] 補足分析へ必須情報を退避していない
