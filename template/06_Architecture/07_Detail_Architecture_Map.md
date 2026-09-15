# Architecture詳細設計の対応表

成果物種別: Architecture詳細設計の統合投影
状態: Candidate
維持責任者: （記入）

## 1. 目的

Architecture定義と詳細設計領域の多対多Relation、およびQualityへの引渡し状態を示す。個別領域の設計内容は複製しない。

## 2. 詳細設計領域

| 詳細設計領域 | 対応Architecture定義 | 責務 | 状態 |
|---|---|---|---|
| [area](Details/area/01_Architecture.md) | ARCH-XXXXXX | | Candidate |

## 3. Architecture定義の閉包

| Architecture定義 | 基本設計 | 接続する詳細設計領域 |
|---|---|---|
| ARCH-XXXXXX | [設計名](Definitions/ARCH-XXXXXX/architecture_definition.md) | area |

## 4. Qualityへの引渡し

Qualityが読む詳細設計上の検証対象、未確認範囲および次のGateを示す。

## 5. Reality Audit境界

現行Sourceと既存試験はCanonical詳細設計を固定した後に照合し、正式入力へ逆輸入しない。
