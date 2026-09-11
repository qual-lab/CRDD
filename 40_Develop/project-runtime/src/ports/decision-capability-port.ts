export type ProjectRuntimeDecisionCapability = Readonly<{
  secret: string;
  hash: string;
}>;

/** Host-owned cryptographic operations for one-time human decision capabilities. */
export type ProjectRuntimeDecisionCapabilityPort = Readonly<{
  issue: () => ProjectRuntimeDecisionCapability;
  hash: (value: string) => string;
}>;
