export type ParsedSsoRequest = {
  issuer: string;
  audience: string;
  employeeId: string;
  nonce: string;
  timestamp: number;
  signature: string;
};

export type SsoFailure = {
  ok: false;
  reason:
    | "malformed"
    | "protocol-unconfirmed"
    | "expired"
    | "replayed"
    | "invalid-signature"
    | "invalid-issuer"
    | "invalid-audience"
    | "unknown-user";
};

export type LocalUser = {
  employeeId: string;
  active: boolean;
  role: "member";
};

export type SessionRecord = {
  id: string;
  employeeId: string;
  expiresAt: number;
};

export type SessionCookie = {
  name: "it_pm_session";
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};
