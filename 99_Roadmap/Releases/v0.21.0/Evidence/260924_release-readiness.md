# v0.21.0 Release準備記録

状態: Stable最終候補。Release判断、main統合、tag付与は未実施

## 1. 対象と目的

| 項目 | 固定値 |
|---|---|
| 対象版 | `v0.21.0` |
| 公開済みBaseline | `v0.20.1` |
| 対象branch | `codex/feature/v0.21` |
| 統合先 | `main` |
| Stable遷移前の候補Commit | `9663764a0b52a40e2eed4f80d9fdb680de36d054` |
| Stable遷移前の候補Tree | `d7dae5bf54685a7f8d80ae5ee6df2f0a43433aee` |
| Stable遷移計画Commit | `6b448617` |
| Stable最終候補Identity | 本Evidenceを含むbranch tipのCommit／TreeをPRで固定する |
| Source A | `01eb00a63dcab09b4b32a41bf142bab70897cd8c` |
| Manifest carrier B | `7362268eecbbc744fc08f809a3a0976fe16ac805` |
| Runtime Execution Identity | `9850722655b50fcf3d9e70064801729280ab1d0202a6f0472af590535df26f54` |

本計画は、検証済みCandidateを最終Release候補へ機械的に遷移させる対象を、編集前に固定する。Stable表示は内容とRelease metadataが確認可能な最終候補であることを示すだけで、Release済み、公開済み、main統合済みまたはtag作成済みを意味しない。

## 2. Release範囲

v0.21.0はRoadmapのGroup Aだけを対象とする。工程成果物Repository Pattern、基本図と可視Checklist、Runtime Data Contract、Version Control境界、成果物署名境界、Checker安定化、Reality Traceability、Semantic Coverage、CRDD Domain Library責務分離、Source責務命名、およびEngineering Design／Implementation／Verification完全性を含む。

Project Operation、Workbench、CROSの新Capability、Remote MCP、複数Project Federation、AI Runtime Registry、自律Operation実証およびLinux常設運用はv0.22.0以降へ移管し、v0.21.0の成立主張へ含めない。

収載するChange Traceは[Change一覧](../../../02_Changes.md)のv0.21.0集合を正本とする。対象版を`v0.21.0`と宣言するChange Traceは、最終候補で`Ready for Release Handoff`へ揃える。公開後だけ`Released`へ遷移できる。

## 3. 宣言済みの機械的遷移

### 3.1 CRDD正本文書

次の文書は`Version: v0.21.0`を維持し、`Status: Candidate`を`Status: Stable`へ変更して`Released Baseline`を削除する。本文の規範、判断、設計または移行内容は変更しない。

```text
00_Overview.md
01_Principles.md
02_Terminology.md
03_Documentation.md
04_Agent_Organization.md
05_Autonomous_Operation.md
10_Agent.md
11_Skill.md
12_Change.md
13_Release.md
14_Workflow.md
15_Progress.md
16_Quality_Assurance.md
17_Communication.md
18_Context_Dependency.md
19_Maintenance.md
21_Discovery.md
22_UX.md
23_IA.md
24_UI_Behavior_Specification.md
25_UI.md
26_Behavior_Specification.md
27_Architecture.md
28_Implementation.md
29_Verification.md
51_Document_Audit.md
52_Conformance_Audit.md
53_Gap_Impact_Audit.md
```

### 3.2 現行成果物入口

次の現行成果物は、v0.21.0のCandidate表示または`Released Baseline`だけを最終候補表示へ変更する。`Quality Center`は`Quality Ready`へ昇格せず、未観測22件を維持する。

```text
04_UI/06_Current_Interface_Reference.md
05_SPEC/07_Current_Behavior_Reference.md
06_Architecture/01_Architecture.md
06_Architecture/02_Component_and_Responsibility_Model.md
06_Architecture/03_Boundary_and_Interface_Model.md
06_Architecture/04_Runtime_and_Data_Flow_Model.md
06_Architecture/05_Failure_Recovery_and_Resilience_Model.md
06_Architecture/06_Deployment_and_Execution_Model.md
06_Architecture/99_Coding_Standards.md
06_Architecture/Details/coordinator/02_Threat_Model.md
06_Architecture/Details/crdd-domain-library/01_Architecture.md
06_Architecture/Details/runtime-data/02_Current_Path_Reality_Audit.md
07_Quality/01_Quality_Center.md
07_Quality/03_Verification_Design.md
19_Workflows/01_Coordinator_Runtime.md
19_Workflows/04_MCP_Server.md
```

### 3.3 Release metadataとChange状態

次をRelease準備の閉集合とする。

```text
README.md
CHANGELOG.md
99_Roadmap/03_Releases.md
99_Roadmap/Changes/CHG-000078/change.md
99_Roadmap/Changes/CHG-000079/change.md
99_Roadmap/Changes/CHG-000080/change.md
99_Roadmap/Releases/v0.21.0/Evidence/260924_release-readiness.md
```

- READMEは`v0.21.0`を表示し、Candidate／Released Baseline表示を除去する。
- CHANGELOG英日見出しは同じ日付`2026-09-24`の`v0.21.0`最終節へ変換する。
- Releases ProjectionはStable最終候補、PR待ち、Release判断未実施を表示する。
- CHG-000078／079／080は`Ready for Release Handoff`へ揃える。
- 最終候補Commit／Tree、Checker結果および独立監査結果は、PRまたは同等の不変な外部記録へ固定する。本Evidence自身を含むCommit／Treeを本文へ自己参照させない。

上記以外のSource、Test、Manifest、Native Artifact、Schema、Policy、Runtime Dataまたは過去Evidenceを変更しない。Template内の`Candidate`は個別成果物のLifecycle例であり、v0.21.0のRelease状態ではないため機械置換しない。

## 4. 検証済み基盤

| 対象 | 現在結果 |
|---|---|
| Coordinator Portable回帰 | 2,041件中2,033件Pass、失敗0、明示Skip 8 |
| Host Windows Profile | 10／10 Pass |
| Checker package | 363／363 Pass |
| Repository Checker | error 0、warning 0 |
| 最終署名Recovery Matrix | 7シナリオ完了。記録ID `8a651704-41ca-4290-948b-521f63008253` |
| 最終署名4経路E2E | 4／4完了。記録ID `d7aa9851-0054-4d47-b021-1afb5d65b14d` |
| Release Identity | Source A、carrier B、Package Root、Runtime Execution Identity一致 |

詳細は[CHG-000080最終署名Evidence](../../../Changes/CHG-000080/Evidence/260924-1930_signed-e2e.md)を参照する。

## 5. 残存事項と判断境界

Quality Centerではv0.21対象130件のうち108件が観測済み、Hybrid 12件・Manual 10件が未観測である。最終署名E2Eは`AIT-ST-010`と`ERB-IT-014`の限定範囲へ接続し、未観測22件を一括してPassへ変更しない。したがってQuality Readyへ昇格していない。

Release決定権限者は、対象範囲がGroup Aへ限定されること、未観測22件、PT／LT未実施、Windows以外の実環境非対応、v0.22移管範囲、およびv0.20.1へ配布物単位で戻すRollbackを確認して、統合・Release・延期を判断する。本計画はそのリスク受容またはRelease承認を代替しない。

### 5.1. 人間の最終Release判断へ渡す明示例外候補

未観測22件を残してReleaseする場合は、次の`propagation_exception`候補を、人間の決定権限者がmain統合後のexact Commit／Treeに対して承認する必要がある。未承認の候補を例外成立またはRelease承認として扱わない。

| 項目 | 候補内容 |
|---|---|
| 状態 | `Pending Human Decision` |
| 対象改訂版 | main統合後に再固定し、Checker・必須CI・文書監査・不足／影響監査・準拠影響確認が合格したexact Commit／Tree |
| 対象 | v0.21対象130件のうち未観測のHybrid 12件・Manual 10件。PT／LTとWindows以外の実環境も未確認 |
| 理由 | Group AのCanonical設計、実装、Automated Gap、Host Windows、署名済みRecovery Matrixおよび4経路E2Eは完了したが、人間確認または追加実境界を要する義務を自動結果から推定できないため |
| 緩和策 | Quality Centerを`Quality Design Ready — Reality Audit Pending`のまま維持し、未観測をPassへ畳まない。v0.22移管26件をv0.21の成立主張へ含めず、利用者へ既知制限とv0.20.1への配布物単位Rollbackを示す |
| 再確認条件 | v0.22.0のGroup B開始時、該当Capabilityの実利用前、または未観測義務に関係する不具合・設計変更を検出した時点で再開する |
| 残存リスク | 人間中心の受入、追加実境界、性能・長時間、および非Windows環境に固有の欠陥は未検出のまま残り得る |
| 判断選択肢 | 未観測を実施して閉じる／Releaseを延期する／上記例外を承認してReleaseする |

## 6. Stable遷移後のGate

1. 宣言済みPath以外の差分がないことを確認し、Stable最終候補をCommit／Treeへ固定する。
2. 同じ固定IdentityへRepository全体Checker、文書監査、準拠影響確認および不足／影響監査を実行する。
3. PR head SHA／Treeを不変な外部記録へ固定し、branch protection、必須CIおよび統合権限を確認する。
4. PRを`main`へ統合し、統合前後のCommit／Tree、公開済みv0.20.1からの全Release差分、対象CHGおよび宣言外差分を再固定する。
5. CommitとTreeが不変でもbranch protection、必須CIおよび統合状態を確認する。Identityが変化した場合は新候補へCheckerと必要な監査を再実行する。
6. すべてのGateが成立したmain上のexact Commit／Treeに対して、人間の決定権限者が未観測22件を含む残存リスクを確認し、Release／延期／例外承認を一度だけ判断する。
7. 判断後からtag付与までにHEADまたはIdentityが変化した場合は停止し、再固定と必要な確認へ戻る。
8. Release承認済みの同じIdentityへ`v0.21.0`tagを付け、tagが承認済みIdentityを指すことを軽量確認する。
9. tag後はtagged Commitを変更せず、CHG-000066～080の対象tag／公開日付き`Released`遷移、Releases Projectionの公開済みBaseline、実際の時刻・対象環境・結果、Roadmapのv0.22以降の残件を、公開後状態の新しい改訂版へ反映する。
10. 公開後状態の改訂版をtagged Identityと混同せず、Release結果から一意に辿れるようにする。

## Checklist

- [x] Release対象版、Baseline、Source A、carrier BおよびRuntime Identityを固定した。
- [x] Group Aとv0.22移管範囲を区別した。
- [x] Stable遷移の変更Pathを事前に列挙した。
- [x] 本文・Runtime・Manifestへ意味変更を加えない境界を固定した。
- [x] 未観測22件をQuality Readyへ畳まないことを固定した。
- [ ] Stable遷移後の候補をCommit／Treeへ固定し、PRで外部固定する。
- [ ] Repository Checkerと独立監査を最終候補へ実行する。
- [ ] PR、main統合、統合後Identityおよび必須CIを確認する。
- [ ] 未観測22件を含む残存リスクについて、人間の最終Release判断または明示例外を記録する。
- [ ] 承認済みexact Identityへのtag付与とtag結果確認を完了する。
- [ ] tag後のCHG、Release Projection、Roadmapおよび実Release結果を公開後状態の改訂版へ閉じる。
