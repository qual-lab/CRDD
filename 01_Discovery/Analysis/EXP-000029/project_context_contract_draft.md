# Project Context最小Formatと更新契約の試行記録

成果物種別: Discovery補足分析
探索ID: `EXP-000029`
状態: 採用済み。正式契約へ移行

> 本書はREQ-000038の成立可能性を確認した試行記録である。正式契約は[進捗管理](../../../15_Progress.md#repository-project-context)、正式ひな型は[`template/PROJECT_CONTEXT.md`](../../../template/PROJECT_CONTEXT.md)を参照する。本書を現在投影または第二の正本として更新しない。

## 1. 最小Format

Project Context Markdownは、Identityと五つの確認場面だけを固定する。Owner Artifactの詳細を複製せず、結論、必要最小限の理由およびRelationを置く。

````md
# Project Context

Project ID: `<project-id>`
Repository ID: `<repository-id>`
Repository Role: `<repository-role>`

> この文書は、このRepository Roleが扱う範囲のCurrent Contextである。
> 表示されていないContextまたはRepositoryの存在・不存在は、この文書から判断しない。

## 1. 今どうなっているか

### 結論

<現在地を数文で示す。>

| 種別 | 項目 | 現在状態 | Owner Relation |
|---|---|---|---|
| 現在事実 | <項目> | <状態> | [<Owner IDまたは名称>](<path>) |

## 2. 何が危ない、または止まっているか

### 結論

<重要なRiskと停止を数文で示す。>

| 種別 | 結論 | 影響 | 根拠 |
|---|---|---|---|
| 現在事実 | <Ownerが管理するRisk> | <影響> | [<Owner ID>](<path>) |
| 共有分析 | <複数正本から導いた分析> | <影響> | [<Source A>](<path>)、[<Source B>](<path>) |

## 3. 今、人間が決めることは何か

### 結論

<現在必要な判断の有無を示す。>

| 判断 | 判断する人 | 選択肢・影響 | Owner Relation |
|---|---|---|---|
| <判断> | <Authority> | <必要最小限の説明> | [<Owner>](<path>) |

## 4. なぜこの状態・判断になったか

### 結論

<主要な理由を数文で示す。>

| 現在の結論 | 理由 | Owner Relation |
|---|---|---|
| <結論> | <必要最小限の理由> | [<Owner>](<path>) |

## 5. 次に何をすべきか

### 保存済みの次候補

| 候補 | 理由・成立条件 | Owner Relation |
|---|---|---|
| <候補> | <理由または再評価条件> | [<Owner>](<path>) |
````

Front AIがこのMarkdownからさらに推論した提案は、Markdown内の`保存済みの次候補`へ混ぜず、回答上で`今回の追加提案`として分ける。採用された場合は適切なOwner Artifactへ反映し、その後にProject Contextを再投影する。

## 2. 固定する構造

| 対象 | 固定すること | 固定しないこと |
|---|---|---|
| Identity | Project ID、Repository ID、Repository Role | Repository名の命名規則、権限Role階層 |
| 五場面 | H2見出しと順序 | 表示媒体ごとの見せ方 |
| 情報分類 | `現在事実`、`共有分析` | AI内部推論全文 |
| Relation | Owner Artifactへ戻れるLink | Project Context独自ID |
| 空状態 | `なし（確認済み）`、`不明: 理由`を区別 | 空欄を非該当と解釈すること |
| 詳細 | 結論と必要最小限の理由 | Owner Artifact本文の複製 |

Owner Artifact固有の状態値は無理に共通語彙へ変換しない。Project ContextはOwnerの状態を要約できるが、異なる状態を同じ値へ丸めない。

## 3. 空状態の扱い

五場面のSectionは省略しない。該当項目がない場合も、確認済みか不明かを区別する。

```text
なし（確認済み）
→ Repository Role内の必要なOwnerを確認し、現在該当がない

不明: <理由>
→ Owner不足、競合または確認不能が残る

Repository Role外
→ 項目やContextの存在・不存在を列挙しない
```

## 4. 更新契約

更新対象はファイル差分ではなく、五場面が伝える意味で判断する。

| 変化 | 再投影 | 理由 |
|---|---|---|
| 現在Version、節目またはScopeが変わる | 必要 | 現在地が変わる |
| 重要な作業が開始、完了、停止または再開する | 必要 | 現在地または停止状態が変わる |
| 重要Risk、依存または品質判断が変わる | 必要 | Risk回答が変わる |
| 人間の判断事項、選択肢、Authorityまたは結果が変わる | 必要 | 判断待ちが変わる |
| 現在有効な理由またはOwner Relationが変わる | 必要 | 根拠が変わる |
| 保存済みの次候補または再評価条件が変わる | 必要 | 次の一手が変わる |
| Project ID、Repository IDまたはRepository Roleが変わる | 必要 | Repository Contextの境界が変わる |
| 誤字、整形、意味を変えないLink表記修正 | 不要 | 五場面の意味が変わらない |
| 内部実装だけが変わりProject状態の結論が変わらない | 不要 | Project Contextの責務外 |
| 既存結論を変えないEvidenceが追加される | 不要 | Evidence Ownerだけで閉じる |
| Commitが作られただけ | 不要 | Commit発生自体は意味変更ではない |

少なくともChange、工程またはReleaseのGateを閉じる前に再投影要否を評価する。必要と判定した場合は、同じ変更範囲でOwner Artifact更新後にProject Contextを再投影する。

## 5. 競合時の扱い

Project ContextとOwner Artifactが競合する場合、Owner Artifactを優先する。

```text
競合を検出
    ↓
Project Contextを現在値として使用しない
    ↓
再投影できる
├ Yes → Owner Artifactから再投影
└ No  → 競合とOwnerへの導線を利用者へ示す
```

AIは古いProject Contextを根拠に追加提案を行わない。競合が一部に限定される場合も、その部分を正常値へ畳まず、影響する結論を特定する。

## 6. 対象外

- Project Context独自の安定ID。
- 同一Repository内の項目別閲覧権限。
- CI、Runtime、Deploy先またはInfrastructureのLive状態。
- Owner Artifactの状態や履歴の複製。
- Workbench、MCPまたはCROS固有の表示形式。
- Markdownから生成するJSON Schemaまたは内部Project Context Modelの確定。

## 7. この試行で見つかったGapと処置

試行時の[Repository Manifest](../../../.crdd/config/repository-manifest.json)には`projectId`と`repositoryRole`があったが、Project IDと分離した`repositoryId`がなかった。このGapはManifest v2で`projectId`と異なる`repositoryId`を必須化し、Repository Roleを固定Role階層ではなくProject固有の投影責任として宣言できるように処置した。

これはProject Contextの独自Identityではない。CRDD標準Repositoryでは、人間の確認により`qual-lab.crdd-standard`をv0.22の試行値として暫定採用した。正式固定は契約固定時に再評価し、AIは別の値への置換や恒久固定を推測しない。

## Checklist

- [x] 五場面を固定し、一括回答できる構造にした。
- [x] 現在事実と共有分析を区別した。
- [x] Owner Artifactへ戻れるRelationを必須にした。
- [x] Project Context独自IDを追加していない。
- [x] 空欄、確認済みの該当なし、不明を区別した。
- [x] 更新要否をCommit数やファイル数で決めていない。
- [x] Gateを閉じる前の再投影要否確認を定めた。
- [x] Owner Artifactとの競合時に古い投影を現在値として使わない。
- [x] Live状態、Deploy管理および項目別権限を対象外にした。
- [x] 現行ManifestのRepository ID不足を推測で補っていない。
