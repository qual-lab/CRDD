export type CheckerFinding = Readonly<{
  severity: "error" | "warning";
  code: string;
  path: string;
  rule: string;
  message: string;
  evidence?: readonly string[];
}>;

export type FindingSink = (finding: CheckerFinding) => void;

export function createFindingCollector(): Readonly<{
  findings: CheckerFinding[];
  add: FindingSink;
}> {
  const findings: CheckerFinding[] = [];
  return {
    findings,
    add: (finding) => findings.push(finding),
  };
}
