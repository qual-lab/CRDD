export type SourceLocation = Readonly<{
  path: string;
  line: number;
}>;

export type ArtifactSection = Readonly<{
  level: number;
  title: string;
  body: string;
  location: SourceLocation;
}>;

export type ArtifactRelation = Readonly<{
  type: string;
  target: string;
  location: SourceLocation;
}>;

export type ChecklistResult = Readonly<{
  result: "passed" | "unchecked" | "open" | "failed" | "not_applicable";
  text: string;
  reason: string | null;
  location: SourceLocation;
}>;

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

export type ArtifactSource = Readonly<{
  path: string;
  content: string;
}>;
