# IA-XXXXXX [定義名]

成果物種別: IA定義
IA ID: `IA-XXXXXX`
状態: [レビュー候補／Canonical]
維持責任者: [owner]

## 意味と利用者成果

[何を別の情報単位として見分けるか、どのUX成果を支えるか。]

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-XXXXXX](../../Analysis/UX-XXXXXX/ia_analysis.md) | [利用者／場面] | [対象] | [状態] | [導線] |

複数UXを統合する場合も、各入力固有の対象・状態・導線を失わずに記録する。

## 対象・識別・関係

### 分析ObjectからCanonical Objectへの対応

| Source Analysis Object | Canonical Object | 処置 | 判断理由 |
|---|---|---|---|
| UX-XXXXXX: [分析Object] | [Canonical Object] | Same／Rename／Merge／Split | [正式入力から同じ定義を再構築できる理由] |

正式入力から導けない`New`は追加せず、該当IA分析を再開する。

### Identity／Relationの変換

| Source Analysis Object | AnalysisのIdentity／Relation | Canonical Object | CanonicalのIdentity／Relation | 処置と理由 |
|---|---|---|---|---|
| UX-XXXXXX: [分析Object] | [Source分析の同一性と関係の基準] | [Canonical Object] | [Canonical定義の識別・関係] | [Same／Rename／Merge／Splitと、Identity／Relationをどう維持・統合・分離したか] |

Object名だけでなく、同じものと別のものを区別するIdentity、およびObject間のRelationがAnalysisからどう変換されたかを明示する。CanonicalなIdentityまたはRelationを利用側で再解釈しない。

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| [object] | [meaning] | [identity／relation] |

```text
[O: object] --関係--> [O: object]
```

`[O:]`は上のCanonical Object表に存在する情報Objectだけを表す。状態は`[状態:]`、行動は`[行動:]`、Objectではない外部参照・補助情報は`[補足:]`で区別し、これらをObjectとして見せない。

## 状態・可視性・時間的な意味

[利用者が見分ける状態、誰が何を知れるか、current／stale／historical／unknown等の区別を定義する。]

## 情報の優先度・まとまり・見つけ方・責任

| 観点 | 定義 |
|---|---|
| 情報の優先度 | [最初に理解する情報／必要時に辿る情報] |
| 情報のまとまり | [同じ文脈で扱う情報] |
| 見つけ方 | [起点→対象→根拠／判断／次の行動] |

### 責任と判断権限

| 入力UX | 情報を作成・更新・提供する責任 | 意味・状態・次の行動を決める権限 |
|---|---|---|
| UX-XXXXXX | [Objectの同一性・関係・欠損を正確に保つ主体と責任] | [利用者が決めることと、正本の決定権限者が確定すること] |

同じ主体が両方を担う場合も、情報を正確に保つ責任と、意味・状態・次の行動を確定する権限を同一視しない。

ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。後続工程は、この責任境界を保ったまま実際の主体へ割り当てる。

## 失敗・制約・未確認事項

### 重要な失敗

- `UX-XXXXXX`: [欠損／誤認／古さ／競合／曖昧性等]

### 制約・対象外

[IAが確定しないUI・SPEC・Architecture上の詳細。]

## 検証意図

| 入力UX | 重要場面 | 避ける失敗 | 品質期待 |
|---|---|---|---|
| UX-XXXXXX | [critical moment] | [failure] | [quality] |

[各利用場面で、重要な失敗を避けながら品質期待を満たせることを確認する。具体的な試験項目はQuality工程で設計する。]

### 人間判断・未確認事項・戻り条件

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-XXXXXX | [確認事項] | [判断者] | [現在判定] | [未確認時の影響] |

[IA固有の追加判断の有無、IAへ戻す条件を記す。「追加判断なし」を入力UXの未確認事項が解消済みという意味にしない。]

## 後続工程との関係

| 接続先 | 保持する意味 |
|---|---|
| UI（UX＋IAの正式入力） | [優先度、可視性、状態差、まとまり、見つけ方、関係の理解] |
| SPEC（UX＋IAの正式入力） | [識別、関係、状態、可視条件、責任、時間的な意味] |
| Quality Analysis / IA（伴走） | [成立条件、失敗、検証意図] |

ArchitectureやSourceへ直接引き渡さない。

## 情報源

- [UX-XXXXXXのIA分析](../../Analysis/UX-XXXXXX/ia_analysis.md)

## 補足分析

[必須章で保持できない対象固有の分析だけを記す。不要な場合は「なし」とする。]

## Checklist

ひな型では`[ ]`を未評価として残す。完成時は、処置済みを`[x]`、未完了を`OPEN: 理由 — 項目`、不適合を`FAIL: 理由 — 項目`、非該当を`N/A: 理由 — 項目`として評価する。

- [ ] IA定義だけで情報契約を理解できる
- [ ] 全入力UXの利用者成果・場面・対象・状態・導線を保持した
- [ ] 情報Objectと利用者にとっての意味を定義した
- [ ] IdentityとRelationを定義した
- [ ] Source Identity／RelationからCanonical Identity／Relationへの変換を明示した
- [ ] 全Canonical ObjectをSource Analysis Objectへ対応付け、暗黙の改名・分離・統合を残していない
- [ ] StateとVisibilityを定義した
- [ ] Temporal Meaningを定義した
- [ ] Priority・Grouping・Findabilityを定義した
- [ ] ResponsibilityとAuthorityを分けて定義した
- [ ] 機能責任と実際の人物・組織・Componentへの割当を区別した
- [ ] Failure・Risk・Constraintを定義した
- [ ] Human Inputの必要性を評価した
- [ ] UXから継承するOpen・GapとIA固有事項を区別し、IAへ戻す条件を明示した
- [ ] UI・SPEC・Quality Analysis / IAへの接続を区別した
- [ ] Verification Intentを明示した
- [ ] 画面・Component・DB・API・Classを先取りしていない
- [ ] 現行UI・Architecture・Sourceを正本としていない
- [ ] 補足分析へ必須情報を退避していない
