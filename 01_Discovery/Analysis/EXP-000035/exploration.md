# Project横断には二つの異なる見方がある

成果物種別: Discovery分析
探索ID: `EXP-000035`
状態: 既存要求を維持・UX引き渡し可能
主な情報源・根拠: v0.22 Scope確認、複数Repository構想、Portfolio構想、EXP-000024／EXP-000027／EXP-000029
判断する人: Qual-Lab
記録の性質: v0.22再Discoveryで行った人間理解の確認
下流の主要CHG: [CHG-000081](../../../99_Roadmap/Changes/CHG-000081/change.md)

> 「横断」を一つの巨大な一覧にしない。同じProjectを構成するRepositoryを束ねる仕事と、複数Projectを比較する仕事を分ける。

## 事前入力の理解確認

AIは、v0.22の「Project横断」を次の二つを含むものとして人間へ返した。

```text
1. 同じLogical Projectの複数Repositoryを束ねる
   PRJ-001-DEV + PRJ-001-MGMT
                ↓
              PRJ-001

2. 複数Logical Projectを読み取り専用で比較する
   PRJ-001 + PRJ-002 + PRJ-003
                ↓
             Portfolio
```

Qual-Labは、この理解が意図と一致すると確認した。Project間の優先順位変更、Capacity配分および自動操作は含めない。

## 本当の問題

複数Repositoryを読めないことと、複数Projectを比べられないことは別の問題である。

- 同じProject内のRepositoryを束ねられないと、Development、Managementその他の分離したContextからProject全体を理解できない。
- 複数Projectを比べられないと、どのProjectに注意が必要かを見つけるために、ProjectごとのContextを人間が再集計する必要がある。

両者を一つの汎用Dashboardとして設計すると、Repositoryの開示境界とProject間比較の判断軸が混ざり、見えない情報を「問題なし」へ畳む危険がある。

## 維持する二段階

| 段階 | 入力 | 利用者が得る結果 | 書込み | 守る境界 |
|---|---|---|---|---|
| Logical Project Federation | 同じProject IDを持つ、現在の主体が参照可能なRepository Projection | RepositoryごとのCoverage、競合および不足を保った一つのProject Context | Owner Artifact以外へ新しい正本を書かない | 非開示RepositoryやContextの存在を漏らさない |
| Portfolio Projection | 現在の主体が参照可能な複数Logical Project Context | 注意が必要なProjectを見つけ、Projectと根拠へ降りられる比較 | 読み取り専用 | 欠測・古さ・制限を単一Scoreや正常値へ丸めない |

```text
Repository Projection
        ↓ 同じProject IDで束ねる
Logical Project Context
        ↓ 許可されたProjectだけ比較する
Portfolio Projection
```

PortfolioはRepository Projectionを直接混ぜず、一度Logical Projectとして不足と競合を保った結果を比較する。これにより、Repository数が多いProjectを進捗が多いProjectと誤認しない。

Repository分離はLogical Project Federationの前提ではない。一つのRepositoryだけで成立するProjectは、そのRepository ProjectionをそのままLogical Project Contextとして利用できる。複数Repositoryを使う場合も、DEV／MGMT等が同じTopic／Meeting契約を使うことと、内容を共有することは別である。各Topic／MeetingはOwner Repositoryに残し、Federationは現在の主体が参照できる項目をOwner付きで投影するだけとする。

## 反証と代替

| 代替 | 利点 | 採用しない理由 |
|---|---|---|
| 全Repositoryを一つの一覧へ並べる | 実装が単純 | RepositoryとProjectの単位が混ざり、同じProjectの分割構造を利用者へ露出する |
| 全Projectを中央Databaseへ複製する | 比較しやすい | Current Projectionと正本が二重化する |
| 一つの進捗率・色で比較する | 一目で並べられる | 根拠、欠測、Riskの種類および判断待ちを失う |
| Project間の自動優先順位を出す | 次の行動を直接示せる | 投資、Capacity、組織Authorityを読み取りProjectionが引き受ける |

Front AIは、利用可能なProject Contextから比較観点や次の確認候補を提案できる。ただし、その場の推論をPortfolioの事実または組織判断へ自動昇格しない。

## 既存要求との関係

新しい要求は発行しない。次の既存要求で必要な意味を保持できる。

- `REQ-000013`: 許可された複数Projectの読み取り専用Portfolio Projection。
- `REQ-000017`: 出典、利用範囲および欠測を保つCROSの情報解決。
- `REQ-000024`: 境界を越える仕事のIdentity、許可範囲、出所および帰還先。
- `REQ-000038`: Consumerに依存しないRepository Project Context Projection。

後工程は、一つの画面やAPIへ両段階を畳まず、同じProjectを束ねる体験と、複数Projectを比べる体験を区別して具体化する。

## 現在地と次への引き渡し

Discoveryとして、二つのProject横断の目的、順序、書込み境界および対象外は確認できた。Remote利用の接続資格情報、Role、Repository Exposure、回復および情報開示は[EXP-000036](../EXP-000036/exploration.md)で確認済みであり、Federation／PortfolioとRemote認可を区別したままUXへ引き渡す。

PortfolioがProject間の状態正本を持つ、Repositoryを直接比較単位にする、非開示対象の存在を漏らす、またはAI提案を組織判断として表示する場合はDiscoveryへ戻す。

## Checklist

- [x] 情報源と、情報源から確認できる範囲を示した。
- [x] 事前入力からAIが意味を再構成した場合、AIの事前理解、人間の修正および確認後の現在理解を区別した。
- [x] 現在案を変え得る有力な代替または反証を人間と突き合わせるか、該当する案がない理由を示した。
- [x] 人間理解の確認と、要求・方針の採用判断を分けた。
- [x] 人間が抽象的な問題や要求を言語化できることを前提にせず、具体的な出来事、行動、迷い、回避策または比較から問題仮説を引き出した。
- N/A: 発言の少なさ、回答不能または沈黙は観測されず、Project横断の二つの意味を明示確認できたため — 発言の少なさ、回答不能または沈黙を、同意、問題不存在または要求採用へ読み替えていない。
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
- N/A: 補足分析を使用していないため — 補足分析へ必須情報を退避していない。
