# Phase 5 — Workbench 15画面 Reality Audit

検証日時: 2026-09-27 22:57 JST
対象変更: `CHG-000082`
対象設計: `04_UI/Details/02_Workbench_Screen_Architecture.md`
対象実装: `40_Develop/workbench/src/**`

## 1. 結論

15の論理画面候補に対し、現在のProduction Workbenchは3件を成立、10件を部分成立、2件を未成立として観測した。

```text
15 Logical Screens
├─ Covered  3
├─ Partial 10
└─ Missing  2
```

一つのHTML Shell内にPanelとして配置したこと自体は不一致ではない。論理画面はRoute数ではなく、利用者が独立した目的と終了条件を満たせる表示・操作単位で判定した。Project Context内に短い参照が存在するだけの対象を、独立画面成立とは数えていない。

## 2. 全数対応

| 候補 | 論理画面 | 現在判定 | Production上の入口 | 未成立または残る差 |
|---|---|---|---|---|
| 01 | Project Portfolio | Partial | `#portfolio` | Repository単体／CROS Federationの区別とProject列挙は成立。検索、絞込み、並び順、継続読込およびProject選択後のContext切替は未成立 |
| 02 | Project Workspace | Covered | `#overview`と五場面Panel | 五場面、Repository Identity、次の入口を同じShellで確認できる。詳細画面の不足は各候補で別判定 |
| 03 | Project Plan | Missing | Project Context内のRoadmap Relationだけ | Version、Milestone、Scope、期限、依存、判断待ちを一つの計画面として確認できない |
| 04 | Topic List | Partial | `#topics` | 一覧、登録、Cursor継続読込は成立。検索、状態・Owner・Relation絞込みと並び順指定は未成立 |
| 05 | Topic Detail | Partial | Topic行内の展開領域 | 現在Recordの閲覧・更新・確認付き削除は成立。Relation遷移、Owner Artifactへの昇格および独立した詳細Navigationは未成立 |
| 06 | Meeting List | Partial | `#meetings` | 一覧、登録、Cursor継続読込は成立。期間・未処置Outcome・Relation絞込みは未成立 |
| 07 | Meeting Detail | Partial | Meeting行内の展開領域 | Record更新、Outcome処置、条件付きClose、確認付き削除は成立。Relation遷移と独立した詳細Navigationは未成立 |
| 08 | Quality and Evidence | Partial | 五場面の品質行とOwner Relation | 現在の品質主張とQuality Center参照は見える。Local Item、Evidence、Gap、未観測および次GateのGroup表示は未成立 |
| 09 | Documentation and Relations | Partial | 五場面各表のOwner Relation文字列 | 正本Relationは表示される。正本を開く導線、検索、Relation段階展開、循環・欠落・部分観測の表示は未成立 |
| 10 | Runtime Activity | Missing | なし | Objective、Task、Event、判断待ち、失敗およびRecoveryを読むApplication Adapterが未接続 |
| 11 | AIへの依頼 | Partial | `#ai-request` | 現在Session限定Port、Profile選択、開始・観測・取消および意味区分表示は成立。実Coordinator Adapterと実Provider E2Eは未成立 |
| 12 | Repository Worktree | Partial | `#repository` | Staged／Working／Untracked／Conflict、Stage／Unstage、Commit、確認付き通常Pushは成立。Directory Tree、File／Chunk Diffおよび遅延展開は未成立 |
| 13 | Connection Setup | Covered | `#connection` | Repository単体、Remote接続、CredentialのProcess内保持、更新、切断および失敗表示が成立 |
| 14 | Access Administration | Covered | `#credential-administration` | `systemAdmin`限定の一覧、発行、失効、ローテーションとSecret一回表示が成立。Recoveryは意図どおりCLI限定 |
| 15 | AI Profiles | Partial | `#ai-profiles`、`#ai-profile-administration` | Repository／CROS Owner別表示・管理と四軸Availabilityは成立。任意Catalog Profileを実Provider Authorityへ接続するSigned Runtime Closureは未成立 |

## 3. 優先是正順

| 順序 | 対象 | 理由 |
|---|---|---|
| 1 | Project Plan、Quality、Documentation | 既存Owner Artifactを第二の正本にせず読取り投影でき、Project Workspaceから次の判断へ進む基本導線になる |
| 2 | Runtime Activity | 公開済みProject Runtime状態契約をWorkbenchへ接続し、未構成・観測不能・空を分ける必要がある |
| 3 | Topic／Meeting詳細と一覧条件 | CRUDの安全境界は成立済みで、発見性とRelation Navigationを補う段階にある |
| 4 | Repository Tree／Diff | Version Control公開契約で不足している読取り能力を先に明示し、Git CLI出力を画面側で独自解釈しない必要がある |
| 5 | 実AI Provider | Catalog登録を実行Authorityと同一視せず、CoordinatorのSigned Runtime、Docker Plan、Provider AdapterおよびE2Eを同時に閉じる必要がある |

## 4. 不変条件

- Workbench独自のRoadmap、Quality、Document、Runtime正本を作らない。
- Project Contextの短い要約を、Owner Artifact全体の成立根拠へ読み替えない。
- ProfileがCatalogに存在することを、Provider実行可能またはAuthority発行済みと表示しない。
- 未構成、0件、観測不能、権限外および部分観測を同じ表示へ畳まない。
- 画面数を満たすためだけにRouteまたは空Panelを増やさない。

## 5. Phase判定

Phase 4 GateはPassedとする。User Accountを追加せず、Role CredentialからSession Accessを構成し、Repository単体利用とRemote CROS利用、Repository／CROS Profile Ownerおよび非管理者へのCatalog非開示を分離できた。

Phase 5はIn Progressとする。本監査で見つかったPartial／Missingを処置し、実Browser、全回帰、実Provider境界および独立レビューを閉じるまでProduction Closureを主張しない。

## Checklist

- [x] 15候補を全件評価した。
- [x] Route数ではなく利用者目的と終了条件で評価した。
- [x] Project Context内の参照だけを独立画面成立へ数えていない。
- [x] Covered、Partial、Missingを分けた。
- [x] 実Provider CapabilityとCatalog設定を分けた。
- [x] 第二の正本を作らない是正順を定めた。
- [x] Phase 4とPhase 5のGateを分離した。
