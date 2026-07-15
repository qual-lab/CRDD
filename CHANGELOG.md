# CRDD Changelog

All notable changes to CRDD itself (the methodology documents in this folder) are recorded here.
CRDD自身（このフォルダ内のメソドロジー文書）の変更履歴を記録する。

**[English](#english)** | **[日本語](#日本語)**

---

## English

### v0.1.0 — Initial Public Release (2026-07-15)

First public release of CRDD, organized into four layers by numbering band.

#### Overview (`00_00`–`00_03`)

- CRDD Overview, Principles
- Terminology (Experimental — glossary skeleton, definitions pending)
- Conformance (Experimental — conformance model pending)

#### Core Standard (`00_10`–`00_15`)

- Context Repository Standard
- Information Type and Provenance
- Decision Record Standard
- Human and AI Responsibility
- AI Change Control
- Document Standard

#### Operational (`00_20`–`00_22`)

- Context Feedback Loop
- Context Repository Audit
- CRDD Change and Versioning (Experimental — versioning policy pending)

#### Practice Guide (`00_30`–`00_35`, optional)

- Product Documentation Guide
- Subagent Practice Guide (reference agent model)
- Testing and Quality Guide
- AI Governance and Security Guide
- Compatibility and Evolution Guide
- Architecture and Integration Guide

#### Also included

- [LICENSE](LICENSE) — CC BY-NC-SA 4.0 for CRDD documentation and other copyrightable materials
- [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) — what counts as commercial use, and how to obtain a commercial license
- [TRADEMARK.md](TRADEMARK.md) — separate policy for the CRDD / Qual-Lab names and marks
- [README.md](README.md) — entry point for this folder

#### Known gaps (tracked for future releases)

- `00_02_CRDD_Terminology.md` and `00_03_CRDD_Conformance.md` are outlines, not finished definitions
- `00_22_CRDD_Change_and_Versioning.md` is an outline
- Folder-system provisions not yet written: mandatory/optional folder rules, cross-cutting document placement, document split/merge criteria, temporary-information lifecycle, external (non-Markdown) file reference metadata, repository-level secret/PII handling
- No consistent MUST/SHOULD/MAY normative-strength vocabulary applied across documents yet

---

## 日本語

### v0.1.0 — 初回公開（2026-07-15）

CRDDの初回公開版。採番帯によって4層に構成されている。

#### Overview（`00_00`〜`00_03`）

- CRDD Overview、Principles
- Terminology（Experimental — Glossary骨子のみ、定義は未確定）
- Conformance（Experimental — 準拠モデルは未確定）

#### Core標準（`00_10`〜`00_15`）

- Context Repository Standard
- Information Type and Provenance
- Decision Record Standard
- Human and AI Responsibility
- AI Change Control
- Document Standard

#### Operational（`00_20`〜`00_22`）

- Context Feedback Loop
- Context Repository Audit
- CRDD Change and Versioning（Experimental — バージョニング方針は未確定）

#### Practice Guide（`00_30`〜`00_35`、任意）

- Product Documentation Guide
- Subagent Practice Guide（参考Agent構成モデル）
- Testing and Quality Guide
- AI Governance and Security Guide
- Compatibility and Evolution Guide
- Architecture and Integration Guide

#### あわせて含まれるもの

- [LICENSE](LICENSE) — CRDD文書等の著作物に対するCC BY-NC-SA 4.0
- [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) — 商用利用の定義と商用ライセンスの取得方法
- [TRADEMARK.md](TRADEMARK.md) — CRDD / Qual-Lab名称・商標の別ポリシー
- [README.md](README.md) — このフォルダの入口

#### 既知の未対応事項（今後のリリースへ持ち越し）

- `00_02_CRDD_Terminology.md`・`00_03_CRDD_Conformance.md`は骨子のみで、定義未確定
- `00_22_CRDD_Change_and_Versioning.md`は骨子のみ
- フォルダ体系側の条項が未執筆: 必須/任意フォルダのルール、Cross-cutting文書の置き場所、文書分割・統合基準、一時情報の寿命、外部ファイル（非Markdown）参照メタデータ、Repository自体のSecret/PII取扱い
- 文書全体への一貫したMUST/SHOULD/MAY規範強度語彙の適用は未実施
