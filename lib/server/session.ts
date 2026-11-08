import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "kn_session";
export const FLOW_COOKIE = "kn_login_flow";
export const SESSION_SECONDS = 86400;
export type Session = {
  accessToken: string;
  refreshToken: string;
  backendSession?: string;
  expiresAt: number;
};

export function cookieOptions(maxAge = SESSION_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

function key() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error("AUTH_SESSION_SECRETに32バイトの16進数を設定してください");
  }
  return Buffer.from(secret, "hex");
}

export function sealSession(session: Session): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(SESSION_COOKIE));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);
  const value = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
  if (value.length > 3800)
    throw new Error("認証Cookieのサイズが上限を超えています");
  return value;
}

export function openSession(value?: string): Session | undefined {
  const secret = key();
  if (!value || value.length > 3800) return;
  try {
    const bytes = Buffer.from(value, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      secret,
      bytes.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(SESSION_COOKIE));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const data = JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    );
    if (
      typeof data.accessToken !== "string" ||
      !data.accessToken ||
      typeof data.refreshToken !== "string" ||
      !data.refreshToken ||
      (data.backendSession !== undefined &&
        typeof data.backendSession !== "string") ||
      typeof data.expiresAt !== "number" ||
      data.expiresAt <= Date.now()
    )
      return;
    return data;
  } catch {
    return;
  }
}
