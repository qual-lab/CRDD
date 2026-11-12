/**
 * Artifact解析と関係Graphが共有する値契約を定義する。
 *
 * @responsibility Source位置、Canonical Identity、Relationと解析結果の型だけを所有する。
 * @trace ARCH-000008
 */
/**
 * artifact-modelで使用するSource Locationの値契約を定義する。
 *
 * @responsibility Source LocationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape SourceLocationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SourceLocationで宣言した値と責務の対応を維持する。
 * @boundary N/A: SourceLocationの宣言は外部境界を開かない。
 * @security N/A: SourceLocationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SourceLocationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SourceLocation = Readonly<{
  path: string;
  line: number;
}>;

/**
 * artifact-modelで使用するArtifact Sectionの値契約を定義する。
 *
 * @responsibility Artifact SectionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ArtifactSectionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ArtifactSectionで宣言した値と責務の対応を維持する。
 * @boundary N/A: ArtifactSectionの宣言は外部境界を開かない。
 * @security N/A: ArtifactSectionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ArtifactSectionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ArtifactSection = Readonly<{
  level: number;
  title: string;
  body: string;
  location: SourceLocation;
}>;

/**
 * artifact-modelで使用するArtifact Relationの値契約を定義する。
 *
 * @responsibility Artifact RelationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ArtifactRelationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ArtifactRelationで宣言した値と責務の対応を維持する。
 * @boundary N/A: ArtifactRelationの宣言は外部境界を開かない。
 * @security N/A: ArtifactRelationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ArtifactRelationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ArtifactRelation = Readonly<{
  type: string;
  target: string;
  location: SourceLocation;
}>;

/**
 * artifact-modelで使用するChecklist 結果の値契約を定義する。
 *
 * @responsibility Checklist 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ChecklistResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ChecklistResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ChecklistResultの宣言は外部境界を開かない。
 * @security N/A: ChecklistResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ChecklistResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ChecklistResult = Readonly<{
  result: "passed" | "unchecked" | "open" | "failed" | "not_applicable";
  text: string;
  reason: string | null;
  location: SourceLocation;
}>;

/**
 * artifact-modelで使用するArtifact Modelの値契約を定義する。
 *
 * @responsibility Artifact ModelのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ArtifactModelが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ArtifactModelで宣言した値と責務の対応を維持する。
 * @boundary N/A: ArtifactModelの宣言は外部境界を開かない。
 * @security N/A: ArtifactModelはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ArtifactModelの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ArtifactModel = Readonly<{
  artifactType: string | null;
  canonicalId: string | null;
  status: string | null;
  formalInputs: readonly string[];
  provenance: readonly string[];
  sections: readonly ArtifactSection[];
  relations: readonly ArtifactRelation[];
  checklist: readonly ChecklistResult[];
  sourceLocation: SourceLocation;
}>;

/**
 * artifact-modelで使用するArtifact Sourceの値契約を定義する。
 *
 * @responsibility Artifact SourceのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ArtifactSourceが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ArtifactSourceで宣言した値と責務の対応を維持する。
 * @boundary N/A: ArtifactSourceの宣言は外部境界を開かない。
 * @security N/A: ArtifactSourceはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ArtifactSourceの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ArtifactSource = Readonly<{
  path: string;
  content: string;
}>;

/**
 * Markdown参照文字列をtargetとAnchorに分けた値契約。
 *
 * @responsibility 参照先文字列とDecode失敗の有無を、存在・安全性の判断と分離する。
 * @trace ARCH-000008
 * @shape target、anchorは一度URI Decodeした文字列、decodeErrorは片方以上のDecode失敗を表す。
 * @invariant targetは解決済みFilesystem Pathや認可済み対象ではない。
 * @boundary N/A: 文字列の値契約だけを定義し外部観測を行わない。
 * @security decodeError=falseを参照の存在・Root内・安全性の保証に使わない。
 * @compatibility 不正Encodingでは元文字列を保持し、他方が成功した結果を捨てない。
 */
export type MarkdownLinkReference = Readonly<{
  target: string;
  anchor: string;
  decodeError: boolean;
}>;

/**
 * UX分析本文から得た正式入力の参照候補。
 *
 * @responsibility 参照文字列とDiscovery形状に関するEntity異常flagを、存在・認可の判断と分離する。
 * @trace ARCH-000008
 * @shape targetは候補参照文字列、invalidEntityは既存のDiscovery形状条件に基づくEntity異常を表す。
 * @invariant targetは観測済みFilesystem Pathではなく、invalidEntity=falseは妥当性全体を保証しない。
 * @boundary N/A: 本文解析の値契約だけを定義する。
 * @security 参照の存在・安全性・Root内外・認可を意味しない。
 * @compatibility 同じDecode後targetの候補は挿入順を保ち、異常flagを論理和で引き継ぐ。
 */
export type UxFormalInputTarget = Readonly<{
  target: string;
  invalidEntity: boolean;
}>;

/**
 * 可視Checklistの構造検査が返す最初の失敗理由。
 *
 * @responsibility 評価済み成果物とひな型の既存理由値を閉じた集合で表す。
 * @trace ARCH-000008
 * @shape 構造・項目一致・案内の不備を示す文字列union。
 * @invariant 理由の優先順は各検査関数が所有する。
 * @boundary N/A: 純粋検査の値契約である。
 * @security 評価結果のPass・採用・認可を表さない。
 * @compatibility 既存Checkerが診断文言へ使用する理由値を維持する。
 */
export type ChecklistFailure =
  | "missing_or_duplicate"
  | "content_after_or_between_items"
  | "empty"
  | "unevaluated"
  | "invalid_result"
  | "item_set_mismatch"
  | "unevaluated_item_missing"
  | "result_guidance_missing"
  | "nested_or_following_heading";

/**
 * Fenceとの所属関係を持つMarkdownの一行。
 * @responsibility 元の0始まり位置・本文・Fence内外を同じ値へ結合する。
 * @trace ARCH-000008
 * @shape index、text、outside、fenceId。
 * @invariant Fence外だけoutside:trueかつfenceId:nullとなる。
 * @boundary N/A: 解析結果の値契約。
 * @security 宣言・採用・認可を表さない。
 * @compatibility 既存の行位置と内容行Object共有を維持する。
 */
export type MarkdownFenceLine = {
  index: number;
  text: string;
  outside: boolean;
  fenceId: number | null;
};

/**
 * MarkdownのコードFenceと閉鎖状態。
 * @responsibility 開始条件・言語・終端と内容行の所属を保持する。
 * @trace ARCH-000008
 * @shape id、marker、length、language、start、end、closed、contents。
 * @invariant 未閉鎖はend:null／closed:false。contentsは開始・終了行を含まない。
 * @boundary N/A: 解析結果の値契約。
 * @security 内容の意味や安全性を判定しない。
 * @compatibility 新しいfreeze・複製を加えず既存shapeを維持する。
 */
export type MarkdownFence = {
  id: number;
  marker: string;
  length: number;
  language: string;
  start: number;
  end: number | null;
  closed: boolean;
  contents: MarkdownFenceLine[];
};
