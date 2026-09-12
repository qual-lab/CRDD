# CHG-000070 Work LifecycleとEvidence所有の再編

変更ID: `CHG-000070`
状態: Completed（v0.21.0）
決定権限: Qual-Lab
基準版: v0.20.1

## 1. 変更の目的

Roadmap、Change、ReleaseおよびEvidenceの配置を、ファイル種別ではなく「何の作業状態を示し、何の成立を証明するか」で再編する。人間が使う`Roadmap`というNavigation Anchorは維持し、個別Evidenceを`07_Quality`へ集約する構造は廃止する。

## 2. 現在状態と問題

| 対象 | 現在状態 | 問題 |
|---|---|---|
| Roadmap | `99_Roadmap/01_Roadmap.md` | Product以外の標準、Runtime、CROS、Tool、研究を含み、名称が所有範囲より狭い |
| Change | `90_Release/Changes`にCHG本文と共通Evidence置場がある | Changeと直接Evidenceの探索経路が分かれる |
| Release | `90_Release`がChange置場を兼ねる | ChangeとReleaseが別Entityである一方、Work Lifecycle上の接続が見えにくい |
| Verification Result | `07_Quality/Verification_Results`とChange Evidenceへ分散 | EvidenceのOwnerが「Quality成果物か」で決まり、証明対象から離れる |
| Quality Center | 個別Evidenceを横断参照する | 現在品質の投影とEvidence倉庫の責務が混在する |

## 3. 採用する責務

```text
99_Roadmap
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
01_Roadmap.md              未完了作業の現在入口
02_Changes.md              Change一覧・統合履歴の入口
03_Releases.md             公開対象・状態・判断の現在入口

Changes/CHG-xxxxxx/
├ change.md                変更理由・判断・経緯・結果
└ Evidence/                そのChangeを直接証明する根拠

Releases/vX.Y.Z/Evidence/  Release全体を直接証明する根拠


07_Quality
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Strategy／Verification Design／Test Catalog／Traceability
Quality Center             上記Evidenceを読む現在品質の投影
```

`99_Roadmap`全体を未完了作業だけに限定しない。未完了登録簿の責務は`01_Roadmap.md`、Change Navigationは`02_Changes.md`、Release Navigationは`03_Releases.md`へ限定し、Directory全体はWork LifecycleのNavigation Rootとする。

## 4. Evidenceの配置判断

| 直接証明する対象 | Owner | 配置 |
|---|---|---|
| 一つのChange | 当該CHG | `99_Roadmap/Changes/<CHG-ID>/Evidence/` |
| 複数Changeを含む一つのRelease | 当該Release | `99_Roadmap/Releases/<version>/Evidence/` |
| Repository全体の現在品質 | Quality Center | 元Evidenceを複製せず参照・評価する |

Execution／Observation EvidenceとVerification Assessmentは、Metadataまたは名称で区別できる。同じ証明対象に属する限り、この違いだけで別Top-levelへ分離しない。

## 5. 名称とIdentity

| 要素 | 責務 | 規則 |
|---|---|---|
| CHG Directory | 安定したChange ID | `CHG-000070/`。表題は`change.md`と一覧が所有する |
| CHG本文 | 当該Directory内の唯一のChange Narrative | `change.md` |
| 新規Evidence名 | 観測順と局所的な種別 | `<YYMMDD-HHmm>_<type>.<ext>`を基本とする |
| 正確な意味 | 対象、改訂版、時刻、状態 | 必要な値だけをEvidence内のMetadataに持つ |
| 現在採用するEvidence | 最新Fileと現在有効の分離 | CHGまたはRelease本文が参照する |

Filenameの時刻基準はCRDD公式RepositoryではJSTとし、正式時刻を持つ場合はISO 8601で記録する。既存Evidenceも新Canonical Namingへ移行し、旧命名を恒久例外として残さない。

| 移行時の精度 | Canonical名 | 時刻の根拠 |
|---|---|---|
| 観測分まで確定 | `YYMMDD-HHmm_<type>` | Evidenceの明示時刻 |
| 観測日だけ確定 | `YYMMDD_<type>` | Evidenceまたは既存Filenameの明示日 |
| 観測日が未確定 | `YYMMDD-HHmm_<type>` | Gitの初回収載時刻。Evidence観測時刻とは扱わない |
| 同一時刻粒度と種別が衝突 | `..._<type>-01` | 連番は衝突回避にだけ用いる |

移行対応表に旧Path、新Path、移行前後HashおよびTimestampの根拠を残す。Path自体を不変Identityとは扱わず、Git Historyと移行対応表から追跡可能にする。

## 6. 変更禁止範囲

- `fixed_history`に分類された過去CHGとEvidenceは、配置だけを変更し、本文を1 byteも書き換えない。旧Pathも当時の観測値または歴史参照として保持する。
- `current`に分類された文書だけ、移行元の固定Dispositionと閉じた変換契約に基づくCanonical Path更新を許可する。現在導線は一覧または現在文書が提供する。
- CHG本文と履歴を別Artifactへ分割しない。
- Quality Centerを個別Evidenceの第二正本にしない。
- Evidenceを日付、拡張子または`Verification`という語だけでOwnerへ分類しない。
- 旧Pathの互換stubを恒久配置しない。

## 6.1 CHGを作らない通常データ操作

Work Lifecycleは、管理対象の全Markdown更新へCHGを要求する仕組みではない。Communication、Topic、Meeting、Commercial等では、成立済み契約に従うデータの追加・編集・削除を通常Operationとして扱う。CHGが追跡するのは、構造、Schema、関係、Lifecycle、Authority、Tool／Runtime挙動または移行規則の変更である。

| 対象 | 通常Operation | CHG対象 |
|---|---|---|
| Communication | 記事・案内・測定記録の追加や編集 | 公開状態契約、成果物構造、自動公開処理の変更 |
| Topic | Topic itemの追加、更新、終了 | Topic Schema、関係、状態遷移の変更 |
| Meeting | 議事録、決定候補、Actionの追加や更新 | Meeting契約、Promotion規則の変更 |
| Commercial | 成立済み項目への値の追加や更新 | Commercialの責務境界、Schema、Authorityの変更 |

データ操作と契約変更が同時に起きる場合も、CHGへ通常データの内容を複製せず、契約変更とその代表検証だけを追跡する。

## 7. 移行単位

| 順序 | 処置 | 完了条件 |
|---|---|---|
| 1 | 現行CHG、Change Evidence、Verification Result、Release Evidence候補を棚卸し | 全ファイルが一つの証明対象または判断待ちに分類される |
| 2 | 正本規則、ひな型、Checkerの新Path契約を固定 | 旧Pathを新規正本として許可しない反証を持つ |
| 3 | Roadmap、CHG Aggregate、Evidenceを一括移行 | 固定履歴の本文byteを維持し、現在文書だけ許可したPath変換を行う |
| 4 | Consumer Closure | Checker、Inventory、Workflow、Template、Tool、MCP／Runtime固定Pathを全数照合する |
| 5 | 独立確認 | 文書Owner、履歴Identity、リンク、正本一意性、移行漏れがMajor 0になる |

## 8. 現在の棚卸し

| 母集団 | 現在数 | 初期分類 |
|---|---:|---|
| CHG本文 | 33 | 各CHG Aggregateへ移行 |
| `90_Release/Changes/Evidence` | 343 | filenameのCHG IDだけで確定せず、CHG本文・統合台帳のOwner接続と照合 |
| `07_Quality/Verification_Results` | 28 | Change固有またはRelease全体へ分類 |
| 旧Path参照を持つ追跡File | 116 | Contract単位で自動導出し、移行後0件を確認 |

数は2026-09-12の着手時観測であり、完了判定は固定数ではなく移行対象集合と移行後集合の完全一致で行う。

## 9. 現在のGate

| Gate | 状態 |
|---|---|
| 目標責務と最終構造 | 採用済み |
| Evidence Owner全数分類 | 完了。移行元固定CommitのDispositionと旧配置契約から独立導出 |
| 正本・Template・Checker変更 | 完了。旧Path再作成、案内欠落、移行集合差を機械拒否 |
| 物理移行とConsumer Closure | 完了。408件を移行し、固定履歴392件はsource byteを完全保持 |
| 独立レビュー／監査 | 完了。最終再レビューはCritical 0／Major 0／Moderate 0 |
