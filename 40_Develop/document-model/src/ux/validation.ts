/**
 * UXの固定Checklistと局所診断の構文を所有する。
 * @responsibility 固定定義と捕捉済み結果の変換を文書解析から分離する。
 * @trace ARCH-000008
 */
import type { DocumentIssue } from "../artifact/types.ts";
import type { UxChecklistRequest, UxDocument } from "./types.ts";
/**
 * UXが所有する七種類の期待項目を選択する。
 * @responsibility 旧項目・順序と受付間の独立性を維持する。
 * @trace ARCH-000008
 * @input kind: 明示されたUX文書の種別。
 * @returns 今回の受付が所有する期待項目配列。
 * @precondition Pathから種別を推定しない。
 * @postcondition 固定定義・別呼出しと配列を共有しない。
 * @effect N/A: 固定値の局所構築のみ。
 * @failure 未知kindを拒否する。
 * @invariant 旧七種類の項目文言・順序を変更しない。
 * @boundary UXの固定条件選択。
 * @security 期待列を品質成立やAuthorityへ変換しない。
 * @concurrency N/A: 共有可変値を持たない。
 */
export function uxChecklistItems(kind: UxChecklistRequest["kind"]): string[] {
  const uxIndexChecklistItemTexts = [
    "誰の何をなぜ良くする製品かを冒頭から短時間で理解できる",
    "全REQに個別分析とUX処置があり全UX定義へ到達できる",
    "UX成果と入力REQの関係および網羅状況を説明できる",
    "個別分析と横断合成の詳細を複製せず関係と現在状態を示した",
    "想定利用者、利用の流れ、提供責務および品質期待の横断成果物へ到達できる",
    "未確認事項、戻り先および工程移行判断を区別した",
    "IAへの正式な引き渡しを明示した",
    "Quality Analysis / UXへの伴走入力を明示した",
    "UIとSPECが後続で保持するUX ContractをIAへの工程移行と区別した",
    "基本図を作成、既存参照、非該当または作成不能として理由付きで処置した",
    "横断成果物が個別Definitionの第二の正本になっていない",
    "補足へ台帳、網羅状況または必須の引き渡しを退避していない",
  ];

  const uxPersonasChecklistItemTexts = [
    "利用者像を個別UX分析から横断合成した",
    "全UX IDの主要な利用者を処置した",
    "役割と利用者の目的を混同していない",
    "目的、困りごと、利用状況および判断責任に意味のある差で分けた",
    "架空の属性、根拠のない能力差または役職だけで利用者像を作っていない",
    "共通性と要求固有の差を混同していない",
    "根拠、確信度および未確認範囲を示した",
    "利用者分類をUIの権限設計へ先取りしていない",
    "個別UX Definitionと矛盾していない",
    "補足へ利用者一覧や必須の差を退避していない",
  ];

  const uxExperienceMapChecklistItemTexts = [
    "個別UX分析から仕事の起点、理解、判断および継続を横断合成した",
    "全UX IDを利用の流れへ処置した",
    "画面遷移や内部処理ではなく利用者の時間軸と得られる結果を主語にした",
    "各段階の目的と得られる結果を追跡できる",
    "利用者、目的または結果が変わる主要分岐を示した",
    "重要場面、失敗および回復を必要な範囲で処置した",
    "各流れから関係するREQ、UXおよび個別分析へ戻れる",
    "未確認範囲を確認済みの流れへ混ぜていない",
    "UI Navigationを先取りしていない",
    "補足へ主要な流れまたは分岐を退避していない",
  ];

  const uxServiceBlueprintChecklistItemTexts = [
    "個別UX分析の利用者接点、提供責務、失敗および回復を横断合成した",
    "全UX IDについてサービス提供の流れの適用を処置した",
    "利用者成果とサービス側の責任の対応を追跡できる",
    "利用者、接点、提供側、運用・根拠の責任と可視境界を区別した",
    "人間、AIおよびシステムの責任を必要な範囲で区別した",
    "完了時と失敗時に誰へ何が返るかを示した",
    "返却後に誰が何を判断できるかを示した",
    "Architecture Componentへ提供責務を固定していない",
    "UI部品、Protocol、Class等の下流方式を先取りしていない",
    "未確認の責任境界を確定した提供責務へ混ぜていない",
    "補足へ主要な責任境界を退避していない",
  ];

  const uxQualityExpectationsChecklistItemTexts = [
    "個別UX分析で見つかった品質期待を製品全体で横断合成した",
    "全UX IDの品質期待を処置した",
    "品質を内部特性でなく利用者や運用者に現れる状態として示した",
    "各品質が利用者成果の成立に必要な理由を説明できる",
    "重要場面、避ける失敗および関係REQ／UXを接続した",
    "Quality Analysis / UXへ渡す検証義務を識別した",
    "両立が難しい品質と現在の優先判断を隠していない",
    "数値条件、状態Schema、Protocolまたは実現方式を先取りしていない",
    "未確認範囲を確認済みの品質期待へ混ぜていない",
    "補足へ主要な品質期待を退避していない",
  ];

  const uxAnalysisChecklistItemTexts = [
    "同じREQのDiscovery定義を正式入力として一意に特定した",
    "REQの問題、望ましい変化、制約および未確認事項を保持した",
    "REQにない意味をAIの推測だけで追加していない",
    "利用者、判断する人および関係する利用者を必要な範囲で特定した",
    "利用場面と前後の状況を特定した",
    "現在の体験、困りごとまたは回避方法を説明した",
    "目的を解決策の操作ではなく利用者の目的として表現した",
    "利用前後の仕事、理解、判断または行動の変化を説明した",
    "得られる結果を独立した利用者成果として定義した",
    "重要場面を評価した",
    "避ける失敗を評価した",
    "体験品質への期待を評価した",
    "人間による評価または確認が必要な事項を評価した",
    "IA、UI、SPECまたはArchitectureの結論を先取りしていない",
    "New、SameまたはNot Applicableを利用者成果の同一性から判断した",
    "統合判断の理由を追跡できる",
    "未確認事項と影響を明示した",
    "IAへの正式な引き渡しを明示した",
    "Quality Analysis / UXへの伴走入力を明示した",
    "UIとSPECが後続で保持するUX ContractをIAへの工程移行と区別した",
    "DiscoveryまたはUXへ戻す条件を明示した",
    "補足分析へ必須情報を退避していない",
  ];

  const uxDefinitionChecklistItemTexts = [
    "UX IDと表題から独立した利用者成果を識別できる",
    "定義単独で利用者、利用場面および前後の状況を理解できる",
    "利用者の目的を理解できる",
    "得られる結果をUI操作ではなく独立した利用者成果として表現した",
    "利用前後の変化を必要な範囲で説明した",
    "成立条件を観察可能な意味で説明した",
    "重要場面を処置した",
    "重要な失敗を処置した",
    "体験品質への期待と必要性を処置した",
    "必要な情報をIAへ引き渡せる",
    "UXが所有する責任と下流へ残す判断を区別した",
    "制約と対象外を保持した",
    "未確認事項と影響を明示した",
    "人間による評価または確認の必要性を評価した",
    "検証意図を具体的なTest Caseへ先取りせず定義した",
    "IAへの正式な引き渡しを明示した",
    "Quality Analysis / UXへの伴走入力を明示した",
    "UIとSPECが後続で保持するUX ContractをIAへの工程移行と区別した",
    "IAがUX Analysisを読み直さずDefinitionから開始できる",
    "下流成果物、Architectureまたは現行実装をUXへ逆輸入していない",
    "DiscoveryまたはUX分析へ戻す条件を明示した",
    "補足定義へ必須情報を退避していない",
  ];
  const items = {
    index: uxIndexChecklistItemTexts,
    personas: uxPersonasChecklistItemTexts,
    experience_map: uxExperienceMapChecklistItemTexts,
    service_blueprint: uxServiceBlueprintChecklistItemTexts,
    quality_expectations: uxQualityExpectationsChecklistItemTexts,
    analysis: uxAnalysisChecklistItemTexts,
    definition: uxDefinitionChecklistItemTexts,
  };
  if (!Object.hasOwn(items, kind)) throw new Error("unknown_ux_checklist_kind");
  return items[kind];
}
/**
 * UxのChecklist不備を文書別診断へ変換する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export function uxChecklistIssues(
  document: UxDocument,
  targetIdentity = document.source.path,
): DocumentIssue[] {
  const { failure, kind, mode } = document.checklistContract;
  if (!failure) return [];
  const reason =
    mode === "template"
      ? "template-checklist-invalid"
      : `${kind}-checklist-invalid`;
  return [
    {
      kind: `artifact.ux.${reason}`,
      reason,
      targetIdentity,
      location: { path: document.source.path },
      details: { checklistFailure: failure },
    },
  ];
}
