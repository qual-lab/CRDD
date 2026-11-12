/**
 * 工程成果物の既存Checklist期待項目を所有する。
 *
 * @responsibility 工程・成果物ごとの必須項目列を元の順序と表記で提供する。
 * @trace ARCH-000008
 */
/**
 * 一回の検査で使用する工程Checklist項目を構築する。
 *
 * @responsibility 固定項目とDetail向け派生列を同じ定義から構成する。
 * @trace ARCH-000008
 * @input N/A: 正式な固定項目だけを扱う。
 * @returns 工程・成果物別の文字列配列を持つ局所Object。
 * @precondition 適用対象・版・Template別の選択は呼出し元が行う。
 * @postcondition 項目の綴り・順序と呼出し間の独立性を維持する。
 * @effect N/A: 局所配列だけを構築し、登録や保存は行わない。
 * @failure N/A: 外部入力・外部I/Oを扱わない。
 * @invariant Checklist構造検査のnullを品質Passへ換算しない。
 * @boundary N/A: 同一Process内の固定モデル。
 * @security 認可・正式採用の判断を行わない。
 * @concurrency N/A: 共有可変配列を公開しない。
 */
export function createPhaseChecklistItems() {
  const discoveryRootChecklistItemTexts = [
    "すべての探索記録と採用要求を台帳から一意に辿れる。",
    "採用済みの判断、探索中の候補、保留、棄却および未確認事項を区別した。",
    "複数探索の関係、競合または合流候補を、個別記録の第二の正本を作らず示した。",
    "Version別の作業予定や未完了TaskをDiscoveryの判断として複製していない。",
    "基本図を現行図、既存参照、理由付き非該当または作成不能として処置した。",
    "UXその他へ渡す現在の判断、保持条件およびDiscoveryへ戻す条件が分かる。",
    "人間理解の確認が必要な探索について、理解確認と要求採用を区別した。",
    "発火した理解確認について、AIの事前理解、人間の修正、有力な代替または反証、および確認後の現在理解を個別探索から辿れる。",
    "補足情報や台帳が個別探索・要求定義の第二の正本になっていない。",
  ];

  const discoveryExplorationChecklistItemTexts = [
    "情報源と、情報源から確認できる範囲を示した。",
    "事前入力からAIが意味を再構成した場合、AIの事前理解、人間の修正および確認後の現在理解を区別した。",
    "現在案を変え得る有力な代替または反証を人間と突き合わせるか、該当する案がない理由を示した。",
    "人間理解の確認と、要求・方針の採用判断を分けた。",
    "人間が抽象的な問題や要求を言語化できることを前提にせず、具体的な出来事、行動、迷い、回避策または比較から問題仮説を引き出した。",
    "発言の少なさ、回答不能または沈黙を、同意、問題不存在または要求採用へ読み替えていない。",
    "確認できた事実と、そこから導いた解釈・仮説を区別した。",
    "解決策ではなく、本質的な問題を説明した。",
    "技術名称を除いても、誰が何に困っているか理解できる。",
    "影響を受ける人または判断する人を特定した。",
    "どのような変化を期待するか説明した。",
    "原因と解決に関する仮説を、事実として扱っていない。",
    "未確認事項と不確実性を明示した。",
    "人間による確認または判断が必要かを評価した。",
    "情報不足をAIの推測だけで補っていない。",
    "失敗、リスク、制約および対象外を評価した。",
    "採用、不採用、保留を区別した。",
    "次工程が保持すべき問題、変化および条件を示した。",
    "情報不足時にDiscoveryへ戻す条件を示した。",
    "因果、比較または時系列を図示する必要性を判定し、作成または理由付きN/Aとして処置した。",
    "補足分析へ必須情報を退避していない。",
  ];

  const discoveryRequirementChecklistItemTexts = [
    "要求だけを読んでも、必要な変化を理解できる。",
    "探索元と採用判断を一意に辿れる。",
    "対象、利用状況、問題および望ましい変化を説明した。",
    "特定の画面、実装または技術方式へ不要に固定していない。",
    "要求として採用した理由と主要な代替を示した。",
    "正常時の成立条件を判定可能な形で示した。",
    "不完全・異常・境界時にも守る条件を示した。",
    "成立主張を破る反証条件を示した。",
    "失敗、リスクおよび制約を評価した。",
    "対象外を明示した。",
    "未確認事項と人間確認の必要性を評価した。",
    "情報不足をAIの推測だけで補っていない。",
    "検証意図を、具体的な試験項目を先取りせず説明した。",
    "UXが探索記録を直接読まず、この定義だけから分析を開始できる。",
    "下流工程の結論をDiscoveryへ逆輸入していない。",
    "補足分析へ必須情報を退避していない。",
  ];

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

  const iaIndexChecklistItemTexts = [
    "全UX DefinitionをIA Analysisへ一件ずつ対応付けた",
    "全IA AnalysisをIA Definitionへ処置した",
    "IA台帳とAnalysis／Definitionsの関係が一致する",
    "全体の情報構造を個別定義の第二の正本にしていない",
    "基本図を作成・既存参照・非該当・作成不能のいずれかへ処置した",
    "未確認事項、人間判断、IAへ戻す条件を明示した",
    "UI／SPECとQuality Analysis / IAへの接続を区別した",
    "Architecture／Sourceへの直接Handoffを作っていない",
    "補足分析へ必須情報を退避していない",
  ];

  const iaObjectRelationChecklistItemTexts = [
    "全IA Definitionを一件ずつ処置した",
    "Object、Identity、Relationを混同していない",
    "DB、API、Classを情報Objectとして逆輸入していない",
    "個別IA Definitionの意味を再定義していない",
    "孤立Object、循環、関係の欠落を確認した",
    "非該当には理由を記録した",
    "補足分析へ必須情報を退避していない",
  ];

  const iaStructureNavigationChecklistItemTexts = [
    "全IA Definitionを一件ずつ処置した",
    "Priority、Grouping、Findabilityを区別した",
    "単一の画面やTreeを情報構造として先取りしていない",
    "根拠、判断、失敗時の戻り先へ到達できる",
    "個別IA Definitionの意味を再定義していない",
    "非該当には理由を記録した",
    "補足分析へ必須情報を退避していない",
  ];

  const iaStateVisibilityChecklistItemTexts = [
    "全IA Definitionを一件ずつ処置した",
    "State、Visibility、Temporal Meaningを区別した",
    "不明を正常または不存在へ丸めていない",
    "ResponsibilityとAuthorityを区別した",
    "非開示情報の存在を無断で露出していない",
    "個別IA Definitionの意味を再定義していない",
    "非該当には理由を記録した",
    "補足分析へ必須情報を退避していない",
  ];

  const iaAnalysisChecklistItemTexts = [
    "正式入力となるUX Definitionを一件だけ特定した",
    "UXの利用者成果と重要な失敗を保持した",
    "情報候補と利用者にとっての意味を特定した",
    "同じ情報と異なる情報を識別する条件を処置した",
    "情報同士の関係を処置した",
    "全Canonical Object候補を分析Objectへ対応付け、暗黙の改名・分離・統合を残していない",
    "Identity／RelationをCanonical側で再解釈させない変換根拠を残した",
    "状態と可視性を処置した",
    "時間的な意味を処置した",
    "情報の優先度・まとまり・見つけ方を評価した",
    "情報の責任者と判断権限を分けて評価した",
    "機能責任と実際の人物・組織・Componentへの割当を区別した",
    "欠損・誤認・古さ・競合・曖昧性を評価した",
    "人間判断の必要性を評価した",
    "UXから継承する未確認事項・判断者・影響とIA固有事項を区別した",
    "UI・SPEC・Quality Analysis / IAへの接続を区別した",
    "情報構造の検証意図を評価した",
    "画面・Component・DB・API・Classを先取りしていない",
    "現行UI・Architecture・Sourceから意味を逆輸入していない",
    "補足分析へ必須情報を退避していない",
  ];

  const iaDefinitionChecklistItemTexts = [
    "IA定義だけで情報契約を理解できる",
    "全入力UXの利用者成果・場面・対象・状態・導線を保持した",
    "情報Objectと利用者にとっての意味を定義した",
    "IdentityとRelationを定義した",
    "Source Identity／RelationからCanonical Identity／Relationへの変換を明示した",
    "全Canonical ObjectをSource Analysis Objectへ対応付け、暗黙の改名・分離・統合を残していない",
    "StateとVisibilityを定義した",
    "Temporal Meaningを定義した",
    "Priority・Grouping・Findabilityを定義した",
    "ResponsibilityとAuthorityを分けて定義した",
    "機能責任と実際の人物・組織・Componentへの割当を区別した",
    "Failure・Risk・Constraintを定義した",
    "Human Inputの必要性を評価した",
    "UXから継承するOpen・GapとIA固有事項を区別し、IAへ戻す条件を明示した",
    "UI・SPEC・Quality Analysis / IAへの接続を区別した",
    "Verification Intentを明示した",
    "画面・Component・DB・API・Classを先取りしていない",
    "現行UI・Architecture・Sourceを正本としていない",
    "補足分析へ必須情報を退避していない",
  ];

  const uiAnalysisUxChecklistItemTexts = [
    "正式入力となるUX Definitionを一件だけ特定した",
    "UXの利用者、状況、目的、成果、重要場面および失敗を保持した",
    "必要な認識・操作・Feedbackを評価した",
    "状況による体験差を評価した",
    "UI候補への処置と理由を明示した",
    "IA観点と統合するときの確認事項を明示した",
    "Human Inputの必要性を評価した",
    "Open・GapとUIまたはUXへ戻す条件を明示した",
    "Verification Intentを評価した",
    "IA、REQ、ArchitectureまたはSourceから意味を補完していない",
    "Behavior Ruleを先取りしていない",
    "補足分析へ必須情報を退避していない",
  ];

  const uiAnalysisIaChecklistItemTexts = [
    "正式入力となるIA Definitionを一件だけ特定した",
    "IAのObject、Identity、Relation、State、Visibilityおよび導線を保持した",
    "表示の優先順位とNavigationを評価した",
    "表示差と開示境界を評価した",
    "UI候補への処置と理由を明示した",
    "UX観点と統合するときの確認事項を明示した",
    "Human Inputの必要性を評価した",
    "Open・GapとUIまたはIAへ戻す条件を明示した",
    "Verification Intentを評価した",
    "UX、REQ、ArchitectureまたはSourceから意味を補完していない",
    "Behavior Ruleを先取りしていない",
    "補足分析へ必須情報を退避していない",
  ];

  const uiDefinitionChecklistItemTexts = [
    "UX DefinitionとIA Definitionを正式入力とし、各分析記録を変換根拠として処置した",
    "UX OutcomeとIA Information Contractを保持した",
    "Surface ResponsibilityとInformation Priorityを定義した",
    "Presentation、Interaction、Visible StateおよびFeedbackを定義した",
    "Error・Recovery Presentationを評価した",
    "AccessibilityとVariantの必要性を評価した",
    "Failure・Risk、ConstraintおよびNon-goalを評価した",
    "Human Inputの必要性を評価した",
    "Open・GapとOwner工程へ戻す条件を明示した",
    "Verification Intentを明示した",
    "対応するSPECとのRelationを明示した",
    "Behavior Rule、Architecture方式またはSource実装を先取りしていない",
    "Visual ArtifactだけでContractを代替していない",
    "補足定義へ必須情報を退避していない",
  ];

  const specAnalysisUxChecklistItemTexts = [
    "正式入力となるUX Definitionを一件だけ特定した",
    "UXの利用者、状況、成果、重要場面、失敗および品質を保持した",
    "契機、結果、失敗および判断不能を観測可能な意味で評価した",
    "受入条件と適用範囲を評価した",
    "SPEC候補への処置と理由を明示した",
    "IA観点と統合するときの確認事項を明示した",
    "Human Inputの必要性を評価した",
    "Open・GapとSPECまたはUXへ戻す条件を明示した",
    "Verification Intentを評価した",
    "IA、UI、REQ、ArchitectureまたはSourceから意味を補完していない",
    "UI Presentationを先取りしていない",
    "補足分析へ必須情報を退避していない",
  ];

  const specAnalysisIaChecklistItemTexts = [
    "正式入力となるIA Definitionを一件だけ特定した",
    "利用場面、Object、Identity、Relation、State、Visibilityおよび時間的意味を保持した",
    "入力、条件、状態、結果および開示境界を区別した",
    "導線、責任、Authorityおよび失敗時に保持する意味を評価した",
    "SPEC候補への処置と理由を明示した",
    "UX観点と統合するときの確認事項を明示した",
    "Human Inputの必要性を評価した",
    "Open・GapとSPECまたはIAへ戻す条件を明示した",
    "Verification Intentを評価した",
    "UX、UI、REQ、ArchitectureまたはSourceから意味を補完していない",
    "実装StateまたはUI Presentationを先取りしていない",
    "補足分析へ必須情報を退避していない",
  ];

  const specDefinitionChecklistItemTexts = [
    "UX DefinitionとIA Definitionを正式入力とし、各分析記録を変換根拠として処置した",
    "UX OutcomeとIA Information Contractを保持した",
    "Actor・Authority、Trigger、PreconditionおよびInput Validationを評価した",
    "Current State、Behavior、ResultおよびState Transitionを定義した",
    "Failure・Error、Retry・Recovery、Cancel・UndoおよびSide Effectを評価した",
    "ConstraintとNon-goalを評価した",
    "Human Inputの必要性を評価した",
    "Open・GapとOwner工程へ戻す条件を明示した",
    "Verification Intentを明示した",
    "対応するUIとのRelationを明示した",
    "UI Presentation、Architecture方式またはSource実装を先取りしていない",
    "結果を観測可能な契約として定義した",
    "補足定義へ必須情報を退避していない",
  ];

  const uiDetailIndexChecklistItemTexts = [
    "対象UI Definitionを全件処置した",
    "UI Areaごとの目的とArea Design Guideを示した",
    "Logical ScreenをRouteやFigma Frameと混同していない",
    "Screen PartをHTML要素やLayout wrapperへ過剰発行していない",
    "Interaction、StateおよびVariantを評価した",
    "G1: 対象範囲のScreen Inventoryと正常・分岐・失敗・回復Flowを全件処置した",
    "G1: 大量化し得る一覧・Tree・履歴を全件評価し、全件取得・全件描画を暗黙の前提にしていない",
    "G1: 検索・絞り込み・並び順・継続読込・遅延展開・仮想表示・内容分割の適用を処置した",
    "G1: 取得上限、Continuation、整合、権限境界および部分失敗をSPEC Detailへ引き渡した",
    "G2: G1通過後にHero候補を比較し、代表性と偏りを記録した",
    "G3: Heroについて2案以上のRendered View、Intent、Trade-offおよび保持するUX／IAを比較した",
    "G4: AI提案と人間の方向性判断を分け、採用理由と再探索条件を記録した",
    "Visual SourceとRendered Viewを区別した",
    "G5: 採用DirectionをSecondary Screenへ展開してからPatternを評価した",
    "G5: CMPへの昇格または理由付き非昇格を記録した",
    "視覚的UIがある対象でG1〜G5をN/Aにしていない",
    "未通過Gateより後の成果物をCanonical、完了または下流引き渡し可能と表示していない",
    "SCR／PRT／InteractionとBHVの双方向Coverageを評価した",
    "N/Aに理由、OPENにOwner・影響・戻り条件を記録した",
    "Detailで上流の意味やSystem Behaviorを創作していない",
  ];

  const uiAreaChecklistItemTexts = [
    "Areaの目的、利用者成果、対象UI Definitionを説明できる",
    "情報構造と優先順位を示した",
    "Screen InventoryとFlowを示した",
    "Area共通のCompositionを示した",
    "Interaction、State、FailureおよびRecoveryの原則を示した",
    "Product Visual Baselineを複製せず、適用と例外を分けた",
    "Pattern／CMPの利用規則と非適用条件を評価した",
    "Accessibilityを全項目評価した",
    "避ける表現を明示した",
    "N/Aに理由、OPENにOwner・影響・戻り条件を記録した",
  ];

  const uiScreenChecklistItemTexts = [
    "ScreenをRoute、URLまたはFigma Frameだけで定義していない",
    "利用者の目的、入口、終了条件を明示した",
    "対象UI DefinitionとAreaへ接続した",
    "意味あるPRTを全件示した",
    "Interaction、Feedback、StateおよびVariantを評価した",
    "System Behaviorを伴うInteractionをBHVへ接続した",
    "Failure、Unknown、PendingおよびRecoveryの表示を評価した",
    "Visual BaselineとArea Design Guideの適用を示した",
    "Accessibilityを評価した",
    "Pattern／CMP昇格を反復根拠から判断した",
    "N/Aに理由、OPENにOwner・影響・戻り条件を記録した",
  ];

  const uiComponentChecklistItemTexts = [
    "複数Screen／Areaで反復した根拠がある",
    "共通責務と個別差分を分けた",
    "Input、State、Interaction、Feedbackを定義した",
    "Failure／RecoveryとAccessibilityを評価した",
    "利用規則と非適用条件を示した",
    "BHV対応を評価した",
    "実装FrameworkやClassをComponent Identityにしていない",
    "N/Aに理由、OPENにOwner・影響・戻り条件を記録した",
  ];

  const uiVisualBaselineChecklistItemTexts = [
    "Screen Inventory／Flowの後にHeroを選定した",
    "同じHeroと表示条件で2案以上のRendered Viewを比較した",
    "各DirectionのIntent、Trade-offおよび保持するUX／IAを比較した",
    "AI提案とHuman Direction Decisionを区別した",
    "採用理由と再探索条件を示した",
    "Baselineの全観点を評価した",
    "主要Font Family、Fallback順およびFont未導入時の成立を評価した",
    "見出し、本文、ID／Codeで異なる書体を使う場合は理由を示した",
    "Font Binary同梱をApplicable／N/A／OPENへ処置した",
    "Direction比較前に各案のVisual Design Principleを評価した",
    "本文14px、補助情報12pxを原則下限として例外を理由付き処置した",
    "Type ScaleとSpacingをToken化し、偶発的な値の増殖を避けた",
    "Contrastを測定値または測定可能なTokenで評価した",
    "Pointer／Touch Targetの寸法と間隔を評価した",
    "色だけに依存せず状態を識別できるようにした",
    "長文、大量情報、200%拡大、狭幅およびKeyboard Focusを評価した",
    "汎用Webでは全必須Adaptive Profileを評価し、対象を限定した場合は決定権限者と影響を記録した",
    "全Breakpointの直前／一致／直後と各Layout区間の代表点を評価した",
    "実Browser Zoomと狭幅Viewportの結果を同一視していない",
    "Profileの技術結果と人間の例外受容を分け、FAILをPASSへ書き換えていない",
    "Visual SourceとRendered Viewを区別した",
    "Secondary Screenへ展開して成立を確認した",
    "Human Direction Decision前にBaselineをCanonical化していない",
    "Secondary Screen検証前にPattern／CMPを確定していない",
    "Screenshotだけを正本にしていない",
    "N/Aに理由、OPENにOwner・影響・戻り条件を記録した",
  ];

  const specDetailIndexChecklistItemTexts = [
    "対象SPEC Definitionを全件処置した",
    "BHVの発行基準を満たすDetailed Behaviorだけを採番した",
    "各BHVからSource SPECへ逆引きできる",
    "Trigger、Result、FailureおよびRecoveryのCoverageを確認した",
    "UI Detailとの双方向Coverageを評価した",
    "Architecture方式やSource実装を先取りしていない",
    "N/Aに理由、OPENにOwner・影響・戻り条件を記録した",
  ];

  const specBehaviorChecklistItemTexts = [
    "独立したTriggerまたはResultを持つ",
    "Source SPECへ接続した",
    "TriggerからRecoveryまで全観点を評価した",
    "N/Aに理由、OPENにOwner・影響・戻り条件を記録した",
    "Normal、Boundary、Failure、UnknownおよびRecoveryを評価した",
    "UI認識が必要な結果をUI Detailへ接続した",
    "Architecture方式やSource実装を先取りしていない",
    "新しいUX Outcome、IA Object、UI PresentationまたはAuthorityを創作していない",
  ];

  const uiSpecDetailCorrespondenceChecklistItemTexts = [
    "Definition対応とDetail対応を分けた",
    "UIからBHVへのCoverageを全件評価した",
    "BHVからUIへのCoverageを全件評価した",
    "直接UIを持たないBHVを理由付きN/Aへ処置した",
    "Detail Gapを対応表だけで補完せずOwner工程へ戻した",
    "N/Aに理由、OPENにOwner・影響・戻り条件を記録した",
    "Architecture／Qualityへ未解決事項を含めて引き渡した",
  ];

  const uiSpecHandoffChecklistItemTexts = [
    "UIとSPECの共通正式入力を明示した",
    "UIとSPECの責任境界を区別した",
    "UI別に渡す操作・状態・Feedbackを明示した",
    "Definition対応とDetail対応を区別した",
    "SCR／PRT／InteractionとBHVのCoverageを明示した",
    "既存のDefinition引き渡し結果と新Detail移行結果を区別した",
    "対象改訂版で発行済みのSCR／PRT／BHVとDetail Relationを全件確認した",
    "共通Variantを全UIへ一律適用していない",
    "UI側の引き渡し完了条件を明示した",
    "対応レビュー結果の正本をSPEC側の対応文書へ一本化した",
    "Open・GapとOwner工程へ戻す条件を明示した",
    "UI／SPEC独自の第三仕様を作っていない",
    "補足分析へ必須情報を退避していない",
  ];

  const uiSpecCorrespondenceChecklistItemTexts = [
    "UIとSPECが同じUX・IA Contextを保持している",
    "Shared Stateの意味が一致する",
    "InteractionとTriggerが矛盾しない",
    "ResultとFeedbackが矛盾しない",
    "FailureとError Presentationが矛盾しない",
    "Recoveryが両側で成立する",
    "Authorityが矛盾しない",
    "Visibilityが矛盾しない",
    "Constraintが片側で欠落していない",
    "UI-only Responsibilityを識別した",
    "SPEC-only Responsibilityを識別した",
    "Shared Responsibilityを識別した",
    "GapのOwner工程を特定した",
    "UI／SPEC独自の第三仕様を作っていない",
    "対象Definition集合のSHA-256を固定し、再レビュー入力を再構成できる",
    "組別Evidenceの理由を対象UI／SPECの具体的契約事実で説明した",
    "Definition対応とDetail対応を区別した",
    "対象Detail RelationをDefinition対応のPassで代替せず独立確認した",
    "未決事項をAI推測で補完していない",
  ];

  const architectureUiAnalysisChecklistItemTexts = [
    "自分自身のUI定義だけを正式入力として処置した",
    "利用者が得る結果、認識、操作、Feedbackおよび状態差を保持した",
    "Architectureが担う責務と担わない責務を評価した",
    "Boundary、主要ComponentおよびInterfaceの必要性を評価した",
    "Data／State Ownershipを評価した",
    "Authority、Effectおよび開示境界を評価した",
    "Failure BoundaryとRecovery責任を評価した",
    "Security／TrustとQuality Constraintを評価した",
    "Human Inputの必要性を評価した",
    "Open／GapとOwner工程へ戻す条件を明示した",
    "Verification Intentを評価した",
    "現行Sourceや実装構造から意味を逆輸入していない",
    "SPEC観点との統合時に確認する事項を明示した",
  ];

  const architectureSpecAnalysisChecklistItemTexts = [
    "自分自身のSPEC定義だけを正式入力として処置した",
    "契機、事前条件、Authority、状態、結果およびEffectを保持した",
    "Architectureが担う責務と担わない責務を評価した",
    "Boundary、主要ComponentおよびInterfaceの必要性を評価した",
    "Data／State Ownershipを評価した",
    "External Boundaryと終了後観測を評価した",
    "Failure BoundaryとRecovery責任を評価した",
    "Security／TrustとQuality Constraintを評価した",
    "Human Inputの必要性を評価した",
    "Open／GapとOwner工程へ戻す条件を明示した",
    "Verification Intentを評価した",
    "現行Sourceや実装構造から意味を逆輸入していない",
    "UI観点との統合時に確認する事項を明示した",
  ];

  const architectureDefinitionChecklistItemTexts = [
    "UI分析とSPEC分析だけを正式入力として統合した",
    "UI ContractとSPEC Contractを入力別に保持した",
    "独立したArchitecture Responsibilityを説明できる",
    "所有する責務、所有しない責務およびBoundaryを明示した",
    "Major Component、Interfaceおよび依存方向を明示した",
    "Data／State Ownershipを明示した",
    "Authority、EffectおよびLifecycleを入力別に評価した",
    "Failure Boundary、Recovery責任および観測を明示した",
    "Security／TrustとQuality Constraintを評価した",
    "Human Inputの必要性とOpen／Gapを評価した",
    "DetailsへのHandoffを明示した",
    "Qualityへ渡すVerification Intentを明示した",
    "現行Sourceや実装構造から意味を逆輸入していない",
    "上流の観測可能な振る舞いをArchitectureで変更していない",
  ];

  const architectureDefinitionTemplateChecklistItemTexts = [
    "UI／SPEC Definitionの意味統合と、適用するUI／SPEC Detailの配置制約を区別した",
    "UI ContractとSPEC Contractを入力別に保持した",
    "SCR／PRT／Interaction／BHVのN:N Relation、CoverageおよびGapを保持した",
    ...architectureDefinitionChecklistItemTexts.slice(2),
  ];

  const architectureDetailChecklistItemTexts = [
    "関連するARCH-IDと担当する責務断面を明示した",
    "10種類の詳細成果物を全数Applicability判定した",
    "Requiredを実在する節または成果物へ接続した",
    "N/AにArchitecture上の理由を記録した",
    "8種類のEngineering Concernを全数評価した",
    "PASSを設計済みの意味に限定した",
    "Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した",
    "Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した",
    "7種類のImplementation Structure観点を全数Applicability判定した",
    "二つ目の具象実装がある責務で、共通契約への昇格または非昇格理由を評価した",
    "Qualityへ渡す設計項目を局所的な導出キーまたは同等に一意な参照へ接続した",
    "Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した",
    "Human Inputの必要性とOpen／Gapを評価した",
    "現行実装との照合をReality Auditとして分離した",
    "Source構造をCanonical詳細設計へ逆輸入していない",
  ];

  const architectureDetailTemplateChecklistItemTexts = [
    architectureDetailChecklistItemTexts[0],
    "適用するUI／SPEC Detailと担当構造の逆引きを保持した",
    ...architectureDetailChecklistItemTexts.slice(1),
  ];

  const qualityCenterChecklistItemTexts = [
    "現在の品質状態と結論を履歴より先に示した",
    "Canonical入力、検証目標およびLocal Itemの現在数を説明できる",
    "既存Canonical入力CoverageとUI／SPEC Detail由来の具体的観測条件を区別して全数接続した",
    "Designed、Implemented、Executed、PassedおよびEvidenceの状態を区別した",
    "未成立、停止、要再確認および観測不能を正常へ畳んでいない",
    "Quality ReadyとReality Audit開始条件を過大表示していない",
    "重大な問題、残存Riskおよび人間判断の必要性を評価した",
    "現在状態から分析、定義、実行結果およびEvidenceへ辿れる",
    "過去版の詳細を第二の現在正本として複製していない",
  ];

  const qualityStrategyChecklistItemTexts = [
    "Productと利用者にとって守る品質を説明した",
    "主要な品質Riskと成立主張を破る失敗を示した",
    "各工程が所有するQuality Analysis責任を区別した",
    "UT／IT／ST／UATをSource種別へ固定せず検証義務から選ぶ方針を示した",
    "外部境界をlifecycle全体と段階的な結合で検証する方針を示した",
    "RT／PT／LTの適用を評価し、PT／LTは人間の明示指定なしに実行しない",
    "根拠、停止条件、再評価条件および完了境界を示した",
    "例外またはRisk受容を人間の決定権限から分離していない",
  ];

  const qualityVerificationDesignChecklistItemTexts = [
    "検証対象、正式入力および実行入口を区別した",
    "UT／IT／ST／UATの適用判断を検証義務ごとに行える",
    "外部境界の直接、隣接1 block、関連2 blocks、System／E2Eおよび利用者受入の段階を扱える",
    "正常、境界、準正常、異常および回復を検証設計へ含めた",
    "観測、Oracle、Evidenceおよび終了後条件を区別した",
    "実行、停止、取消および再入場条件を示した",
    "RT／PT／LTの適用を評価し、PT／LTは人間の明示指定なしに実行しない",
    "網羅、未評価範囲、完了条件およびReality Auditへの接続を示した",
  ];

  const qualityIntegrationChecklistItemTexts = [
    "全Canonical IDを一件以上のQuality Analysis行で処置した",
    "Source固有の成功、失敗、Riskおよび未確認事項を保持した",
    "UI／SPEC Definition由来とDetail由来の検証義務を区別して統合した",
    "Source ID、検証目標、試験段階およびLocal Itemを一意に接続した",
    "5横断モデルと全Architecture詳細設計領域を処置した",
    "Quality Integrationだけで第三の要求・設計・検証契約を作っていない",
    "上流の未確認事項をUAT、OPEN義務または上流再開のいずれかへ処置した",
    "検証目標とLocal Itemの重複、孤立および未接続を残していない",
    "現行Source、TestまたはEvidenceからCanonical検証義務を逆算していない",
  ];

  const qualityRealityAuditChecklistItemTexts = [
    "Canonical Quality設計の固定後にだけReality Auditを開始した",
    "基準版Capabilityと過去Evidenceを比較入力として特定した",
    "現行Source、TestおよびRegistryをCanonical設計の正解として扱っていない",
    "必要な検証をCovered、Partial、Missing、LegacyまたはGapへ分類した",
    "未Commit状態とVersion Control Adapterの交換可能性を検証対象へ含めた",
    "照合対象のRevision、実行条件および観測限界を固定した",
    "不足Test、未実行項目およびEvidence Gapを追跡した",
    "PT／LTの適用と実行Authorityを評価し、明示指定がない場合は実行していない",
  ];

  const qualityVerificationResultChecklistItemTexts = [
    "対象改訂版と実行条件を固定した",
    "実際の結果と期待結果を区別した",
    "検証項目結果と検証義務評価を接続した",
    "未確認範囲と残存Riskを示した",
    "適用関係、無効化条件および再検証条件を示した",
    "Quality Centerへの反映要否を評価した",
    "保存するEvidenceと保存しない機密情報・生データを区別した",
    "11項目の必須適用判断を全数処置した",
    "N/Aに理由を、OPENに理由・影響・確認先・再評価契機を記録した",
    "PT／LTを人間の指定なく実行していない",
  ];

  const qualityAnalysisTemplateChecklistItemTexts = [
    "対象工程の全Canonical IDを一件以上処置した",
    "各Source固有の成功、境界、失敗、Riskおよび観測不能を分析した",
    "表題や共通定型句ではなくSource固有の検証義務を記録した",
    "意味の近い義務を統合してもSource固有条件を失っていない",
    "各Sourceと検証目標、試験段階およびLocal Itemを接続した",
    "必要検証義務を既存Local ItemやTestから逆算していない",
    "Required／Definedの集合差、Level不一致およびRelation不明を評価した",
    "上流の未確認事項をUAT、OPEN義務または上流再開へ処置した",
    "現行Source、TestまたはEvidenceから検証義務を逆算していない",
    "未解決事項、判断者および再評価契機を明示した",
  ];

  const qualityAnalysisDetailTemplateChecklistItemTexts = [
    qualityAnalysisTemplateChecklistItemTexts[0] as string,
    qualityAnalysisTemplateChecklistItemTexts[1] as string,
    "Definition由来の成立条件とDetail由来の具体的観測条件を区別した",
    ...qualityAnalysisTemplateChecklistItemTexts.slice(2),
  ];

  const qualityDefinitionTemplateChecklistItemTexts = [
    "Quality ID、検証目標およびSource固有条件を自己完結して示した",
    "各Local ItemをRequired Verification Obligationの局所参照と導出元へ接続した",
    "UT／IT／ST／UATの適用または理由付きN/Aを記録した",
    "外部境界の直接、隣接1 block、関連2 blocks、System／E2Eおよび利用者受入を適用判定した",
    "正常、境界、準正常、異常および回復をLocal Itemで処置した",
    "各Local Itemで観測とOracleを分けた",
    "各Local ItemのEvidence要件を示した",
    "事前条件、刺激、終了後条件、cleanupおよびRecoveryを必要な範囲で示した",
    "RT／PT／LTの適用または理由付きN/Aを記録し、PT／LTは人間の明示指定なしに実行しない",
    "自動化、手動確認および人間判断の境界を示した",
    "現行Source、TestおよびEvidenceとの照合をReality Auditへ分離した",
  ];

  return {
    discoveryRootChecklistItemTexts,
    discoveryExplorationChecklistItemTexts,
    discoveryRequirementChecklistItemTexts,
    uxIndexChecklistItemTexts,
    uxPersonasChecklistItemTexts,
    uxExperienceMapChecklistItemTexts,
    uxServiceBlueprintChecklistItemTexts,
    uxQualityExpectationsChecklistItemTexts,
    uxAnalysisChecklistItemTexts,
    uxDefinitionChecklistItemTexts,
    iaIndexChecklistItemTexts,
    iaObjectRelationChecklistItemTexts,
    iaStructureNavigationChecklistItemTexts,
    iaStateVisibilityChecklistItemTexts,
    iaAnalysisChecklistItemTexts,
    iaDefinitionChecklistItemTexts,
    uiAnalysisUxChecklistItemTexts,
    uiAnalysisIaChecklistItemTexts,
    uiDefinitionChecklistItemTexts,
    specAnalysisUxChecklistItemTexts,
    specAnalysisIaChecklistItemTexts,
    specDefinitionChecklistItemTexts,
    uiDetailIndexChecklistItemTexts,
    uiAreaChecklistItemTexts,
    uiScreenChecklistItemTexts,
    uiComponentChecklistItemTexts,
    uiVisualBaselineChecklistItemTexts,
    specDetailIndexChecklistItemTexts,
    specBehaviorChecklistItemTexts,
    uiSpecDetailCorrespondenceChecklistItemTexts,
    uiSpecHandoffChecklistItemTexts,
    uiSpecCorrespondenceChecklistItemTexts,
    architectureUiAnalysisChecklistItemTexts,
    architectureSpecAnalysisChecklistItemTexts,
    architectureDefinitionChecklistItemTexts,
    architectureDefinitionTemplateChecklistItemTexts,
    architectureDetailChecklistItemTexts,
    architectureDetailTemplateChecklistItemTexts,
    qualityCenterChecklistItemTexts,
    qualityStrategyChecklistItemTexts,
    qualityVerificationDesignChecklistItemTexts,
    qualityIntegrationChecklistItemTexts,
    qualityRealityAuditChecklistItemTexts,
    qualityVerificationResultChecklistItemTexts,
    qualityAnalysisTemplateChecklistItemTexts,
    qualityAnalysisDetailTemplateChecklistItemTexts,
    qualityDefinitionTemplateChecklistItemTexts,
  };
}
