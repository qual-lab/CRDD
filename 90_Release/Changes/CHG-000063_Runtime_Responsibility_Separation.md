# 変更トレース: Runtime責務分離

変更ID: `CHG-000063`
状態: `Final Audit Pending`
担当責任者: Qual-Lab
対象版: `v0.20.0`
変更分類: `refactoring`
最終更新日: 2026-09-11

## 1. 結論と現在状態

| 項目 | 現在状態 |
|---|---|
| 責務分離 | Project Runtime、Coordinator、MCP、実行知、Platform Accessへ分離済み |
| 責務分離の実装 | 完了。現行契約は各Architecture正本が所有する |
| 前の署名候補 | `f76b73af81c43e25f28037caa72d71a898a2f9fb`。Release sequence `2026091102`、Runtime実行Identity `b0f81d356343e535254a12358624ca9f7f0df8f75e6f6e4dd513feafd01d6067` |
| 前候補のEvidence | 正式4経路4/4、Recovery Matrix 7/7、技術独立監査0件。現在候補へ流用しない |
| 文書監査の前候補 | `8536965`。独立監査でMajor 3件、Moderate 2件が残り、不採用 |
| 現在候補 | Runtime Source `2e4a467cc1364b88d6008604f649da8d840903e7`、manifest carrier `523202123c1ffa33fd39d1ede93357028585c4af`。Release sequence `2026091104` |
| 現行Gate | [Quality Center](../../07_Quality/01_Quality_Center.md)が所有する。正式4経路4/4とRecovery Matrix 7/7は成立し、最終Evidence反映後の一括監査と人間のRelease判断を残す |

本書は変更理由、責務・契約差、現在も有効な構造是正を所有する。固定候補の実行値は[検証結果](../../07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md)、現在のRelease Gateは[Quality Center](../../07_Quality/01_Quality_Center.md)を参照する。

v0.19で成立したProject Runtime、MCP stdioおよびCoordinatorは、意味上の責務を分けていた一方、実装と公開入口の多くをCoordinator package内部へ集約している。この状態では、Coordinator固有のProvider実行、Windows／Docker、Project lifecycle、MCP Transportおよび公開契約の変更が同じpackage境界へ伝播し、後続の限定分散実行、Project State投影およびMCP Streamable HTTPで変更理由と回帰範囲を分離しにくい。

本変更はProject RuntimeをProject-level execution lifecycleのApplication Core、Coordinatorを実行編成、MCPをTransport、実行知を観測・分析、Platform AccessをOS／Platform境界として分ける。物理移動を完成とせず、公開契約、依存方向、実装Adapter、利用側および自動回帰が同時に成立した場合だけ分離完了とする。


### 基準版Capabilityの移行照合

v0.20の実Docker結合試験で、検証付き再起動が正常な停止・起動だけを置換し、v0.19で成立していた既知socket障害からの復帰を新経路へ接続していないことを確認した。新しいComponentや状態機械の存在だけを置換完了とせず、基準版の成立済みCapabilityから次の対応を固定する。

| 基準版のCapability | 基準版の根拠 | v0.20の所有者／実装 | 必要な実境界確認 | 現在状態 |
|---|---|---|---|---|
| 正常Engine上で未確定Taskを回復するための検証付き再起動 | v0.19のTask Recovery契約とv0.20で追加した再起動記録試験 | 検証付き再起動、再起動記録、Task Recovery | 正常停止、正常起動、freshな資源不存在、Task回復 | Source接続済み、実機未完了 |
| Docker Desktopの既知socket障害から復帰する | [v0.18のHost復旧記録](Evidence/CHG-000015_Verification_Run_Record_1531092.md)、v0.19修復契約 | 障害修復。正常再起動とは別責務のまま、現行DockerのTrust境界と接続する | 既知障害分類、公式停止、残存ProcessとWSLの停止、run世代退避、起動、Engine観測 | v0.20の新再起動へ未接続。現在のDocker更新後は旧版固定Policyが修復Capabilityを取得できない |
| 障害修復後も元のexact Task回復義務を保持する | v0.19の修復記録、Recovery IDおよびTask Recovery試験 | 障害修復記録とTask Recoveryの再起動Fence | 修復終了記録、現在Engine、対象資源のfreshな不存在、元Recovery IDによる再入場 | 既存契約あり。現行Trust境界による修復完走後の再確認が必要 |
| 復旧処理の途中結果を再発行せず、物理残存を無断削除しない | v0.19の耐久修復Recordと回復試験 | 障害修復Record、再起動Record、Runtime State | 各Effect前Intent、結果不明時の停止、保持物のexact Identity、終了後cleanup | 保持。5回の盲目的再試行は採用しない |

### v0.20で得た共通学習の還元

| 学習 | 共通化した処置 | 正本・機械確認への接続 |
|---|---|---|
| 主機能の移行だけでは署名、Release、Recovery等の副次成立条件を保持できない | 変更した意味からProducer、全Consumer、派生物、署名、公開、回復まで閉じる | [保守](../../19_Maintenance.md)、利用側閉包の契約試験 |
| CanonicalなPath、Identity、Stateを利用側で再構成すると意味が分岐する | Canonical Producerが解決済み値を渡し、Consumerの再解釈を禁止する | [アーキテクチャ](../../27_Architecture.md)、限定グラフの反証試験 |
| 宣言一覧だけでは登録漏れを検出できない | 実source・公開入口・Release経路から導出した集合と宣言集合を双方向照合する | Checker、Capability Graph、Runtime Trace |
| 外部境界の単発成功だけでは終了、取消、回復、再入場を保証できない | 外部境界をブロック化し、隣接1～2ブロックと完全Lifecycleを段階的に結合試験する | [品質保証](../../16_Quality_Assurance.md)、試験カタログ |
| 外部CLIやOS APIを推測で扱うと高価な再試行になる | 要求、受理、Effect、完了、観測、耐久確定を分け、診断可能な観測を設計時に置く | [アーキテクチャ](../../27_Architecture.md)、実境界結合試験 |
| 大規模Refactorは前版の副次Capabilityを失い得る | 前版Capability、過去Evidence、置換Owner、利用側、実境界検証を着手前に対応付ける | [保守](../../19_Maintenance.md)、基準版Capability表 |
| テスト追加後の件数や期待値も利用側である | 実在試験、台帳、runner、期待値を同じ変更単位で同期する | [試験体系CHG](CHG-000061_Test_Levels_and_Automated_Regression.md)、Checker契約試験 |
| 環境のVersion／Hash変化だけを危険とすると正当な更新を拒否する | 環境は柔軟に扱い、発行者、必要Capability、Operation中の同一性を確認できない場合に停止する | Docker CLI Trust契約、実署名観測試験 |
| 状態機械や部品関係を文章だけで追うと遷移・接続漏れを見逃す | ブロック図、状態遷移図、Sequence図、Class図、DFDの意味記法と視覚的表現を設計へ要求する | [アーキテクチャ](../../27_Architecture.md)、設計対応検査 |
| 承認済み目標を内部工程ごとに再確認するとHuman Active Timeが増える | 範囲変更や新Authorityがない限り、一つの目標として自走し、秘密入力・不可逆判断だけを人間へ戻す | [エージェント](../../10_Agent.md)、`template/AGENTS.md` |

共通規範への昇格は、今回のRuntime固有手順をそのまま一般化するものではない。上表の意味契約だけを正本へ置き、Docker固有の実装・試験結果・固定Identityは本CHGと検証結果に保持する。

削除・置換対象の判断では、Git tag `v0.19.0`、当時の変更トレース、検証結果および公開契約を確認する。上表が新しい根拠で閉じる前に、旧修復を不要、検証付き再起動へ置換済み、または回帰不要と扱わない。一方、同じCapabilityが現行Trust境界と実Lifecycleで成立した後は、版固定された旧Policyや重複実装を互換目的で残さない。

## 2. 人間が決定した範囲

- Project Runtimeは独立packageへ分ける。
- Project RuntimeはObjectiveをProject-level execution stateへ変換し、そのlifecycleを管理するApplication Coreとする。
- Project RuntimeはProvider、Coordinator、MCPまたはOS固有実装を直接参照せず、必要能力をPortとして要求する。
- Coordinatorは実行編成とProvider実行を所有し、Project RuntimeのExecution Portを実装するAdapterとなる。
- MCP stdioと後続のMCP Streamable HTTPは独立したTransport packageへ分け、Project Runtimeの公開アプリケーション契約だけを利用する。利用者向けMCP起動入口は`template/tools/crdd-mcp.ts`とし、Coordinator CLIのsubcommandにしない。
- 公開ProcessのLauncherはpackageごとに機械的に作らず、独立した利用目的を持つChecker、CoordinatorおよびMCP Serverだけを`template/tools/`へ置く。Project Runtime、実行知およびPlatform Accessは内部能力として接続する。
- 公開アプリケーション契約は、独立した版管理の必要性が実証されるまでProject Runtimeが所有する。便利な共有箱として別packageを先に作らない。
- 実行知とPlatform Accessの既存独立境界を維持し、Project RuntimeまたはMCPへ再集約しない。

## 3. 目指さないこと

- v0.19の状態機械、Authority、Recovery、受入条件または公開結果の意味を変更すること。
- Folder移動だけで責務分離済みと表示すること。
- Project RuntimeへProvider orchestration、MCP Protocol、Windows／Docker実装、実行知Store、WBS、Topic、Risk、ForecastまたはProject Management正本を集約すること。
- 公開契約、domain、application、runtime core等の未実証packageを細分化すること。
- Linux、macOS、Remote Runtime、LAN／Internet公開または複数Repository対応を本変更から推定すること。

## 4. 設計と依存方向

- [Project Runtimeアーキテクチャ](../../06_Architecture/project-runtime/01_Architecture.md): Application Core、公開契約、Port、上位状態、依存規則および移行順序。
- [Project Runtime詳細設計](../../06_Architecture/project-runtime/02_Detailed_Design.md): exactな状態遷移、資源、Lock、Authority、Effect、不変条件および失敗注入点。
- [MCP Transportアーキテクチャ](../../06_Architecture/mcp/01_Architecture.md): MCP Protocol、stdio Transport、将来HTTPとの共通境界およびAuthority非生成。
- [Coordinator参照アーキテクチャ](../../06_Architecture/coordinator/01_Architecture.md): v0.19の実行編成、Provider、SecurityおよびRecoveryの既存保証。
- [機械可読なProject Runtime設計対応](../../07_Quality/06_Project_Runtime_Design_Traceability.json): 現行設計とCoordinator実装・検証項目を結ぶ検証用投影。設計の第二正本にはしない。

許可する上位依存方向は次とする。

```text
MCP / CLI Transport
        ↓
Project Runtime public contract
        ↓
Project Runtime application / core
        ↓
Ports
        ↑
Coordinator / persistence / platform / telemetry adapters
```

Project RuntimeからCoordinator、MCP、ProviderまたはOS固有moduleへの依存は禁止する。CoordinatorとMCPはProject Runtimeの内部Pathを使わず、packageの公開入口だけを使用する。

## 5. 移行単位

1. 現在のProject Runtime、MCP、Coordinator、Platformおよび実行知のmoduleと利用側を全数分類する。
2. `40_Develop/project-runtime/`へpackage、Core、Application、Portおよび公開契約を作る。
3. Project Runtimeが直接利用しているCoordinator／Repository／Windows／Docker／実行知機能をPortへ置き換え、既存実装をCoordinator側Adapterとして接続する。
4. `40_Develop/mcp/`へProtocolとstdio Transportを移し、Project Runtimeの公開入口だけを利用する。
5. `template/tools/crdd-coordinator.ts`をCLIの構成Root、`template/tools/crdd-mcp.ts`をMCP Serverの構成Rootとする。各入口は公開indexだけを使ってProject Runtime、Coordinator Adapter、Platform／Persistence／実行知Adapterを結合し、MCP packageやCoordinator CLIへ別入口の責務を集約しない。
6. source、test、fixture、script、traceability、package設定、試験カタログ、文書参照およびRuntime実行Identityの依存閉包を同じ変更で更新する。

Runtime実行IdentityはCoordinator Directoryだけを固定の閉包とせず、`template/tools/crdd-coordinator.ts`と`template/tools/crdd-mcp.ts`を公開Processの起点に含める。Coordinatorのproduction sourceは明示された実行集合として、参照の有無にかかわらず含める。公開Launcherからcanonicalな静的importで到達するMCP、Project Runtimeおよび実行知については、到達したsourceと、そのNode module解釈を決める各componentの`package.json`を実体から推移的に導出する。文書、試験、到達しない兄弟Componentのsourceおよび許可されていない兄弟Componentは含めない。公開Launcher、到達したpackage metadataまたは実際の依存が欠落する、package名・版・`private`・module種別が契約外である、もしくは宣言済み実行集合から外れた場合は、開発候補と正式候補の双方をEffect 0で拒否する。
7. 内部Path参照、逆向き依存、二重定義および旧入口を機械検出し、CLI／MCP stdio／回復経路の意味回帰を実行する。

移行中の一時的な互換exportは作らない。旧Pathと新Pathを同時に正規入口として残すと、利用側閉包とRuntime実行Identityが二重化するため、移動単位ごとに全利用側を同じ変更で切り替える。

## 6. 正常・準正常・異常

| 区分 | 代表例 | 期待する処置 |
|---|---|---|
| 正常 | CLIまたはMCP stdioからObjectiveを受付け、Coordinator AdapterがTaskを実行 | v0.19と同じProject結果、Identity、cleanupおよびRecoveryを返す |
| 準正常 | Taskが人間判断、再計画またはRecoveryを要求 | TransportとCoordinatorを越えて同じProject状態を保持し、成功へ補正しない |
| 準正常 | 実行知の記録が利用不能 | Project結果を変更せず、非Authorityの観測不能として分離する |
| 異常 | Project RuntimeがCoordinatorまたはOS固有moduleをimport | 静的な依存検査で拒否する |
| 異常 | MCPがProject Authority、成功またはRepository Effectを生成 | 契約試験で拒否し、Project Runtimeを呼び出さない |
| 異常 | 旧内部Pathを利用側が参照 | 利用側閉包検査で拒否する |
| 異常 | Adapterの応答が欠落、未知またはIdentity不一致 | Project Runtimeは値を補完せずEffect不明またはRecovery義務を保持する |
| 異常 | 移行後の公開入口が旧結果Schemaと不一致 | CLI／MCPの総合試験で停止し、上位完成を主張しない |

## 7. 検証方針

- 単体試験: Project Runtimeの状態、計画、再計画、統合、公開投影およびPort結果の正常・準正常・異常。
- 結合試験: Project RuntimeとCoordinator／Persistence／Platform／実行知Adapterの接続、Identity、資源、Lock、取消、cleanupおよびRecovery。
- 総合試験: 公開CLIとMCP stdioから同じObjective／Decisionを搬送し、公開結果と終了後状態がv0.19契約を保持すること。
- 回帰選択: `project-runtime`、`mcp`または公開契約の変更から、Coordinator、CLI、MCP、traceability、署名依存閉包および文書利用側を逆向きに選択すること。
- 静的検査: Project RuntimeからCoordinator／MCP／Provider／OS固有実装への推移的依存0、公開入口を越えた内部Path参照0、移動前Path残存0。

実Provider、公式署名、性能試験および長時間試験は設計・移行中に自動発火しない。Runtime実行Identityを構成するsourceが変わるため、v0.20の正式候補では再署名と影響する正式E2Eが必要である。

## 8. 完成条件

- Project Runtime、Coordinator、MCP、実行知およびPlatform Accessの所有責務を文書と公開入口から一意に再構成できる。
- Project Runtime packageからCoordinator、Provider、MCPまたはOS固有実装への直接・推移的依存が0である。
- CoordinatorとMCPのProject Runtime内部Path参照が0である。
- 公開アプリケーション契約の意味定義が一つで、MCP Schemaが同じ意味を独立再定義しない。
- v0.19の状態、Authority、Identity、Effect、cleanup、RecoveryおよびAcceptanceの必須保証を移行後も保持する。
- CLIとMCP stdioの正常・準正常・異常の自動回帰が成功する。
- 試験カタログと変更影響型runnerが新packageと全利用側を選択する。
- Repository全体Checker、決定論的試験および独立レビューで未解決の必須指摘事項がない。

## 9. 公開済み文書の現行案内補正

責務分離で試験、Architectureおよび検証投影の所有Componentが変わったため、v0.19.0で公開したCHG-000057の現在案内5件を現行Pathへ補正し、当時の設計件数を支える歴史的述語1件を同じ公開tag上のexact pathへ接続する。公開時の本文、判断、結果および主張は変更しない。Checkerは公開tag上の原文Hash、置換前・途中・置換後の完全一致、置換数、現行参照先の実在、および歴史的参照が元の参照先と同じtag objectであることを検証し、それ以外の本文差を拒否する。

<!-- crdd-released-navigation-correction: 1 -->
```json
{
  "schemaRevision": 1,
  "sourceRelease": "v0.19.0",
  "sourcePath": "90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md",
  "sourceSha256": "e3ab9e61c2ab5b115438fab731937907452ab10b6153805895bebebbbc29f226",
  "replacements": [
    {
      "before": "[Project状態契約試験](../../40_Develop/coordinator/tests/project-runtime-state.contract.test.ts)",
      "via": "[Project状態契約試験](../../40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts)",
      "after": "[Project状態契約試験](../../40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts)",
      "count": 1
    },
    {
      "before": "[MCP Adapter契約試験](../../40_Develop/coordinator/tests/mcp-project-runtime-adapter.contract.test.ts)",
      "via": "[MCP Adapter契約試験](../../40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts)",
      "after": "[MCP Adapter契約試験](../../40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts)",
      "count": 1
    },
    {
      "before": "[参照アーキテクチャ](../../06_Architecture/coordinator/01_Architecture.md#project-runtime-reference-architecture)",
      "via": "[参照アーキテクチャ](../../06_Architecture/coordinator/01_Architecture.md#project-runtime-reference-architecture)",
      "after": "[参照アーキテクチャ](../../06_Architecture/project-runtime/01_Architecture.md)",
      "count": 1
    },
    {
      "before": "[Project Runtime詳細設計](../../06_Architecture/coordinator/03_Project_Runtime_Design.md)",
      "via": "[Project Runtime詳細設計](../../06_Architecture/coordinator/03_Project_Runtime_Design.md)",
      "after": "Git tag `v0.19.0` のexact path `06_Architecture/coordinator/03_Project_Runtime_Design.md`",
      "count": 1
    },
    {
      "before": "[参照アーキテクチャ](../../06_Architecture/coordinator/01_Architecture.md#project-runtime-platform-boundary)",
      "via": "[参照アーキテクチャ](../../06_Architecture/coordinator/01_Architecture.md#project-runtime-platform-boundary)",
      "after": "[参照アーキテクチャ](../../06_Architecture/project-runtime/01_Architecture.md)",
      "count": 1
    },
    {
      "before": "[機械可読な設計対応](../../40_Develop/coordinator/runtime/project-runtime-design-traceability.json)",
      "via": "[機械可読な設計対応](../../40_Develop/coordinator/runtime/project-runtime-design-traceability.json)",
      "after": "[機械可読な設計対応](../../07_Quality/06_Project_Runtime_Design_Traceability.json)",
      "count": 1
    }
  ]
}
```

## 10. 改訂経過

| 段階 | 観測 | 構造是正 | 現在の適用 | Evidence |
|---|---|---|---|---|
| 責務分離 | Coordinator packageへProject lifecycle、Transport、実行知、Platform境界が集約されていた | Project Runtime、Coordinator、MCP、実行知、Platform Accessへ所有範囲を分離 | 現行契約は各Architecture正本が所有する | [設計と依存方向](#4-設計と依存方向) |
| 署名依存閉包 | 主機能の移行後も、署名だけが旧package境界と再解釈したPathを使用した | 配布全体の正規観測と解決済み成果物へ署名利用側を統一 | CanonicalなPath／Identityを利用側で再構成しない | [検証結果](../../07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md) |
| Process／Worker入口 | 宣言、実利用、起動target、Authorityおよび公開結果が別々に確認され、迂回を残した | 実sourceから導出する限定グラフと独立Expectedグラフを完全一致させた | package、署名、回復を含む全利用側を同じ変更単位で確認する | [有効な学び](#11-有効な学びと構造是正) |
| Docker lifecycle | 新しい再起動処理がv0.19の三値観測、socket障害復帰、exact回復Identityを置換し切れていなかった | 正常再起動、障害修復、Task回復を分離し、追記型状態から再入場する | 中間状態や一部成功を全体完成へ流用しない | [基準版Capabilityの移行照合](#基準版capabilityの移行照合) |
| 外部境界の結合 | 副次lifecycleを最終E2Eまで実測せず、切り分けが遅れた | ブロック内部、隣接一段、意味伝播を伴う二段の結合試験をSystem Test前へ配置 | ArchitectureとTest Catalogが再利用可能な規則を所有する | [検証方針](#7-検証方針) |
| Provider境界 | 終了理由を相関できず、Codex隔離Executorのseccomp不整合を推測で追った | phase診断とProvider別実境界試験を追加し、必要なLinux syscallだけを許可 | 限定2経路成功を正式4経路E2Eの代替にしない | [検証結果](../../07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md) |
| 前の署名候補 | `f76b73af`で正式4経路とRecovery Matrixが成立した後、検証投影配置と文書を変更した | 前候補を固定Evidenceとして保持し、現在候補へ署名結果を流用しない | Quality Centerの現在Gateに従う | [Quality Center](../../07_Quality/01_Quality_Center.md) |

## 11. 有効な学びと構造是正

| 指摘クラスタ | 根本原因 | 保持する構造 |
|---|---|---|
| PowerShellの署名検査初期化 | Docker CLI用の中立環境を別の利用側へ流用した | 署名検査に検証済みの最小OS環境を与え、ambient環境継承やDockerの過去Version／Hash固定を行わない |
| 多段利用側の未確認 | 直接起動の成功から中立化子Process内の成立を推定した | 実際の多段Consumer境界を結合試験で確認する |
| 正常再起動後のTask回復 | 障害修復、検証済み再起動、Task回復の結果を結合した | 3つの結果を分離し、一つの成功から次を推定しない |
| 再起動状態の収束 | 要求、観測、確定を同一視した | 5段階の追記型状態列を保持し、不明Effectを再発行せず最後の耐久状態から再入場する |
| Engine ready／WSL stopped | Backend詳細を上位の起動成立条件へ追加した | 起動はEngine ready、停止はWSL stoppedを含む。`ready / known_unavailable / unknown`を維持する |
| 旧修復履歴との循環 | 旧履歴終了と新修復開始が互いを前提にした | 旧Effect不明を保存し、exactなfresh観測下だけEffect 0で世代交代終了し、新しいOperationを分ける |
| Process利用側の移行 | 実呼出しだけ移行し、署名・package・宣言・期待値が残った | 呼出し、由来、宣言集合、件数、派生Consumer、試験を一つの意味変更として移行する |
| Submission sidecar誤分類 | 検証後にDirectoryを生読取りして再解釈した | 検証済みCanonical inventoryを現在・旧Recovery Consumerへそのまま渡す |
| 引継ぎ件数 | 5件で完走する状態列をParserだけ4件に制限した | 命名、履歴解決、Parserで同じ上限を共有し、Identity循環拒否を維持する |
| 再ログオン後の主体 | 過去記録を現在Session Hashで再解釈した | 発行時の耐久Operation Principalを保持し、現在Session Authorityを署名済みRuntime、保護Root、Lock、追記型引継ぎで別に確認する |
| 外部境界の遅い発見 | Docker／Providerの付随lifecycleを最終E2Eまで実測しなかった | 設計時に診断契約を持ち、内部・隣接・二段結合をSystem Test前に確認する |

詳細な失敗時系列、実行値、試験件数および固定候補の結果は[検証結果](../../07_Quality/Verification_Results/2026-09-06_V020_Public_Runtime_and_Bounded_Integration_Verification.md)が所有する。CHGは現在も有効な変更理由と構造差だけを保持する。

## 12. Evidenceと残るGate

| 区分 | 状態・参照 |
|---|---|
| 前の署名候補 | 固定改訂版`f76b73af81c43e25f28037caa72d71a898a2f9fb`、Release sequence `2026091102`、Runtime実行Identity `b0f81d356343e535254a12358624ca9f7f0df8f75e6f6e4dd513feafd01d6067`。4経路4/4、Recovery Matrix 7/7、技術監査0件 |
| 文書監査の前候補 | `8536965`。独立監査でMajor 3件、Moderate 2件が残り、不採用 |
| 現在候補 | Runtime Source `2e4a467cc1364b88d6008604f649da8d840903e7`、manifest carrier `523202123c1ffa33fd39d1ede93357028585c4af`、Runtime実行Identity `7e82dbaee1bb2dd30f8baa4ebb52ac7e5ce5edf794c6ea977de37bf38c0ed137` |
| 現行Gate正本 | [Quality Center](../../07_Quality/01_Quality_Center.md) |
| 正式E2E | 4経路4/4、再試行0、cleanup成立、手動回復不要。記録ID `b549b78e-84f2-434b-b2f4-7adcce238bd7` |
| Recovery Matrix | 7シナリオ完了、top-level cleanup成立、手動回復不要。記録ID `4fad4a80-a254-40cd-bf74-f07c58d96da3` |
| 残るGate | 最終Evidence反映後のRepository全体Checkerと一括独立監査、人間のRelease判断 |
