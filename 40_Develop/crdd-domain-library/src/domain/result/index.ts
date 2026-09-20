export type DomainStatus = "complete" | "partial" | "invalid" | "unobservable";

export type DomainLocation = Readonly<{
  path: string;
  line?: number;
}>;

export type DomainIssue = Readonly<{
  kind: string;
  targetIdentity: string;
  location: DomainLocation;
  reason: string;
  details: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type DomainOutcome<T> = Readonly<{
  status: DomainStatus;
  result: T | null;
  issues: readonly DomainIssue[];
}>;
