export type SsoConfig = {
  enabled: boolean;
  protocolConfirmed: boolean;
  testMode: boolean;
  issuer: string;
  audience: string;
  secret: string;
  maxAgeSeconds: number;
};

export function readSsoConfig(
  env: Record<string, string | undefined> = process.env,
): SsoConfig {
  const testModeRequested = env.HRIS_SSO_TEST_MODE === "true";
  if (testModeRequested && env.NODE_ENV === "production") {
    throw new Error("HRIS SSO test mode cannot run in production");
  }

  const protocolConfirmed = env.HRIS_SSO_PROTOCOL === "confirmed";
  const maxAgeSeconds = Number(env.HRIS_SSO_MAX_AGE_SECONDS ?? "120");

  return {
    enabled: env.HRIS_SSO_ENABLED === "true" && protocolConfirmed,
    protocolConfirmed,
    testMode: testModeRequested && env.NODE_ENV !== "production",
    issuer: env.HRIS_SSO_ISSUER ?? "",
    audience: env.HRIS_SSO_AUDIENCE ?? "",
    secret: env.HRIS_SSO_SECRET ?? "",
    maxAgeSeconds: Number.isFinite(maxAgeSeconds) ? maxAgeSeconds : 120,
  };
}
