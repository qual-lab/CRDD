# IA-000012 実行時データ・保持・清掃

成果物種別: IA定義
IA ID: `IA-000012`
状態: Canonical
維持責任者: Qual-Lab

## 意味と利用者成果

保存場所の内部構造を推測せず、保持すべき状態、一時物、回復義務を安全に扱う。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000017](../../Analysis/UX-000017/ia_analysis.md) | 実行環境の導入・運用者／実行時データを作成または清掃する時 | 実行データの基点（Runtime Root）、実行データ（Data Item）、目的（Purpose）、責任者（Owner）、永続性（Durability）、保持条件（Retention）、Cleanup | 一時（temporary）／保持必要（durable）／回復必要（recovery_required）／清掃可能（eligible_for_cleanup）／不明（unknown） | 作業→データ用途→保持判断→清掃→不存在確認 |
| [UX-000022](../../Analysis/UX-000022/ia_analysis.md) | 実行環境の導入・運用者／失敗後または保守時に残存を見つけた時 | 残存物（Residue）、回復対象の識別子（Recovery Identity）、作用状態（Effect State）、処置（Disposition）、清掃根拠（Cleanup Evidence） | 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | 停止→残存観測→同一の回復対象識別子→回復・清掃→不存在確認 |

この表は入力UXごとの意味保持先である。共有定義へ統合しても、各行の対象・状態・導線を共通語だけへ丸めない。

## 対象・識別・関係

### 分析ObjectからCanonical Objectへの対応

| Source Analysis Object | Canonical Object | 処置 | 判断理由 |
|---|---|---|---|
| UX-000017: 実行データ | 実行データ | Same | 通常時と失敗後の同じData Itemとして扱う |
| UX-000017: 基点フォルダ | 実行データの基点 | Rename | 同じRuntime領域を識別・回復する基点として表示を明確にする |
| UX-000017: 永続性 | 永続性 | Same | 再生成可否と回復要否を保持する |
| UX-000017: 保持期間 | 保持条件 | Rename | 期間だけでなく参照・回復条件を含める |
| UX-000017: 清掃根拠 | 清掃根拠 | Same | 削除許可と終了後不存在のEvidenceを保持する |
| UX-000022: 実行データ | 実行データ | Same | 通常時と失敗後の同じData Itemを保持する |
| UX-000022: 回復義務 | 回復義務 | Same | 清掃前に閉じるべき義務を保持する |
| UX-000022: 実行データの基点 | 実行データの基点 | Same | 同じRuntime領域を識別・回復する基点を保持する |
| UX-000022: 清掃根拠 | 清掃根拠 | Same | 削除許可と終了後不存在のEvidenceを保持する |

`Same`は意味を維持した名称統一、`Rename`は意味を変えないCanonical表示、`Merge`は同一の利用者成果を支える情報の統合、`Split`は一つの分析候補に含まれていた別Identityの分離を表す。正式入力から導けない`New`はここで追加せず、該当IA分析を再開する。

### Identity／Relationの変換

| Source Analysis Object | AnalysisのIdentity／Relation | Canonical Object | CanonicalのIdentity／Relation | 処置と理由 |
|---|---|---|---|---|
| UX-000017: 実行データ | 責任者（Owner）＋目的（Purpose）＋識別子（Identity） | 実行データ | 責任者（Owner）＋目的（Purpose）＋識別子（Identity） | Same。通常時と失敗後の同じData Itemとして扱う |
| UX-000017: 基点フォルダ | 検証済みRootで識別する | 実行データの基点 | 検証済みRootで識別する | Rename。同じRuntime領域を識別・回復する基点として表示を明確にする |
| UX-000017: 永続性 | 一時（temporary）／保持必要（durable） | 永続性 | 一時（temporary）／保持必要（durable） | Same。再生成可否と回復要否を保持する |
| UX-000017: 保持期間 | 実行データ（Data Item）へ結ぶ | 保持条件 | 実行データ（Data Item）へ結ぶ | Rename。期間だけでなく参照・回復条件を含む表示へ揃える |
| UX-000017: 清掃根拠 | 対象と観測へ結合 | 清掃根拠 | 対象と観測へ結合 | Same。削除許可と終了後不存在のEvidenceを保持する |
| UX-000022: 実行データ | Data Identity＋Ownerで識別する | 実行データ | Data Identity＋Ownerで識別し、目的（Purpose）を保持する | Same。通常時と失敗後の同じData Itemを保持する |
| UX-000022: 回復義務 | 回復対象識別子（Recovery Identity） | 回復義務 | 回復対象識別子（Recovery Identity）で識別する | Same。清掃前に閉じるべき義務を保持する |
| UX-000022: 実行データの基点 | 検証済みRepository Root＋用途で識別する | 実行データの基点 | 検証済みRepository Root＋用途で識別する | Same。同じRuntime領域を識別・回復する基点を保持する |
| UX-000022: 清掃根拠 | Data Identity＋確認時点へ結ぶ | 清掃根拠 | Data Identity＋確認時点へ結ぶ | Same。削除許可と終了後不存在のEvidenceを保持する |

Object名だけでなく、同じものと別のものを区別するIdentity、およびObject間のRelationがAnalysisからどう変換されたかを明示する。CanonicalなIdentityまたはRelationを利用側で再解釈しない。

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| 実行データの基点（Runtime Root） | 実行時データの管理基点 | 検証済みRepository Root＋用途で識別する |
| 実行データ（Data Item） | 用途を持つ実行時情報 | Data Identity＋Ownerで識別し、目的（Purpose）を保持する |
| 永続性（Durability） | 再起動後も必要か | 一時（temporary）／保持必要（durable） |
| 保持条件（Retention） | 保持する条件と上限 | 実行データ（Data Item）へ結合 |
| 回復義務（Recovery Obligation） | 回復に必要な耐久情報 | 回復対象識別子（Recovery Identity）で識別する |
| 清掃根拠（Cleanup Evidence） | 終了後の不存在根拠 | Data Identity＋確認時点へ結ぶ |

```text
[O: 実行データの基点（Runtime Root）] --含む--> [O: 実行データ（Data Item）]
[O: 実行データ（Data Item）] --持つ--> [O: 永続性（Durability）]
[O: 実行データ（Data Item）] --管理される--> [O: 保持条件（Retention）]
[O: 実行データ（Data Item）] --支える場合がある--> [O: 回復義務（Recovery Obligation）]
[O: 実行データ（Data Item）] --完了根拠を持つ--> [O: 清掃根拠（Cleanup Evidence）]
```

上表は複数の入力UXを横断して利用する中心対象を示す。入力固有の対象は「利用場面」の対応表にも保持し、中心対象へ統合できない意味を欠落として扱う。

## 状態・可視性・時間的な意味

入力UXで必要とされた状態は次のとおりである。状態実値を採用する場合は、下流工程で対応関係を定義し、この利用者向け区分を上書きしない。

- `UX-000017`: 一時（temporary）／保持必要（durable）／回復必要（recovery_required）／清掃可能（eligible_for_cleanup）／不明（unknown）
- `UX-000022`: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible）

重要な状態、不足、判断要否は次の行動と同じ文脈で示す。観測不能を不存在や正常へ丸めない。

現在値、古い値、履歴、不明および利用不能を、入力UXが要求する区別のまま保持する。観測不能を不存在や正常へ丸めず、状態実値を採用する場合も利用者向けの意味との対応を失わない。

## 情報の優先度・まとまり・見つけ方・責任

| 観点 | 定義 |
|---|---|
| 情報の優先度 | 最初に利用者の判断対象、状態、判断要否を示し、識別情報と根拠は必要時に辿れるようにする。 |
| 情報のまとまり | 「利用場面」の各行にある対象・状態・根拠・次の行動を、入力UX固有の文脈として保持する。 |
| 見つけ方 | 「利用場面」の根拠・判断への導線を正とし、結果なし、判断待ち、失敗または状態不明からも根拠か安全な戻り先へ到達できるようにする。 |


### 責任と判断権限

| 入力UX | 情報を作成・更新・提供する責任 | 意味・状態・次の行動を決める権限 |
|---|---|---|
| UX-000017 | 実行データを管理する主体がData Item・Durability・Retentionを記録し、回復・清掃を実行する主体が義務と清掃根拠を更新する | Repository／実行基盤を管理する主体が保持方針を、回復完了と削除可否を確定する主体が回復完了と削除可否を確定する |
| UX-000022 | 実行データを管理する主体がData Item・Durability・Retentionを記録し、回復・清掃を実行する主体が義務と清掃根拠を更新する | Repository／実行基盤を管理する主体が保持方針を、回復完了と削除可否を確定する主体が回復完了と削除可否を確定する |

責任と判断権限が同じ主体に属する場合も、情報を正確に保つ責任と、意味・状態・次の行動を確定する権限を同一視しない。各利用場面の導線は「利用場面」の対応表を正とし、結果なし、判断待ち、失敗、状態不明の場合も、根拠または安全な戻り先へ接続する。

ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。後続工程は、この責任境界を保ったまま実際の主体へ割り当てる。

## 失敗・制約・未確認事項

### 重要な失敗

- `UX-000017`: subdirectoryや別基点フォルダへ同名データを作る
- `UX-000022`: 名前や経過時間だけで由来不明物を削除する

### 制約・対象外


具体的な画面、UI部品、API、Schema、保存方式、Process構成は本定義で確定しない。正式な識別子や状態実値を用いる場合は平易な表示と対応付け、利用者が内部構造を知らなくても判断できるようにする。

## 検証意図

| 入力UX | 重要場面 | 避ける失敗 | 品質期待 |
|---|---|---|---|
| UX-000017 | 永続化または削除の直前 | subdirectoryや別基点フォルダへ同名データを作る | 用途別領域とcleanup条件を明示する |
| UX-000022 | 削除または回復を選ぶ場面 | 名前や経過時間だけで由来不明物を削除する | 残存・観測不能・不存在を区別する |

各利用場面で、重要な失敗を避けながら品質期待を満たせることを確認する。具体的な試験項目と実行方法はQuality工程で設計する。

### 人間判断・未確認事項・戻り条件

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000017 | REQ-000015: 実行環境の導入・運用者が「実行時データの所有場所と一連の状態変化を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000022: 実行環境の導入・運用者が「残存資源の由来・保持・清掃・回復を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 実行環境の導入・運用者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |
| UX-000022 | REQ-000022: 実行環境の導入・運用者が「残存資源の由来・保持・清掃・回復を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 実行環境の導入・運用者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |

IA固有の追加人間判断はない。これは入力UXの未確認事項が解消済みという意味ではない。正式入力にないObject、情報境界、所有責任または状態を追加する必要が生じた場合は人間の決定権限者へ戻す。UI／SPEC分析またはQuality Analysis / IAで対象・同一性・関係・状態・可視性・時間的な意味の不足または競合が判明した場合はIAを再開する。

## 後続工程との関係

| 接続先 | 保持する意味 |
|---|---|
| UI（UX＋IAの正式入力） | 情報の優先度、可視性、状態差、まとまり、見つけ方および関係の理解を保持する。 |
| SPEC（UX＋IAの正式入力） | 対象の識別、関係、状態、可視条件、責任および時間的な意味を保持する。 |
| Quality Analysis / IA（伴走） | 「保存場所の内部構造を推測せず、保持すべき状態、一時物、回復義務を安全に扱う。」の成立条件、重要な失敗および検証意図を保持する。 |

ArchitectureやSourceへ直接引き渡さない。UI／SPECはUX DefinitionとIA Definitionの双方を正式入力として分析し、「利用場面」の各行を受入単位として扱う。

## 情報源

- [UX-000017のIA分析](../../Analysis/UX-000017/ia_analysis.md)
- [UX-000022のIA分析](../../Analysis/UX-000022/ia_analysis.md)

## 補足分析

なし。必須情報は前節までに保持する。

## Checklist

- [x] IA定義だけで情報契約を理解できる
- [x] 全入力UXの利用者成果・場面・対象・状態・導線を保持した
- [x] 情報Objectと利用者にとっての意味を定義した
- [x] IdentityとRelationを定義した
- [x] Source Identity／RelationからCanonical Identity／Relationへの変換を明示した
- [x] 全Canonical ObjectをSource Analysis Objectへ対応付け、暗黙の改名・分離・統合を残していない
- [x] StateとVisibilityを定義した
- [x] Temporal Meaningを定義した
- [x] Priority・Grouping・Findabilityを定義した
- [x] ResponsibilityとAuthorityを分けて定義した
- [x] 機能責任と実際の人物・組織・Componentへの割当を区別した
- [x] Failure・Risk・Constraintを定義した
- [x] Human Inputの必要性を評価した
- [x] UXから継承するOpen・GapとIA固有事項を区別し、IAへ戻す条件を明示した
- [x] UI・SPEC・Quality Analysis / IAへの接続を区別した
- [x] Verification Intentを明示した
- [x] 画面・Component・DB・API・Classを先取りしていない
- [x] 現行UI・Architecture・Sourceを正本としていない
- [x] 補足分析へ必須情報を退避していない
