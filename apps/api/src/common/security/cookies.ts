import type { CookieOptions } from 'express';

export const sessionCookieName = 'liminalis_session';
export const trustedDeviceCookieName = 'liminalis_trusted_device';

function envFlag(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return null;
}

function urlIsHttps(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function secureCookiesEnabled() {
  const override = envFlag(process.env.COOKIE_SECURE);
  if (override !== null) {
    return override;
  }

  return [
    process.env.PUBLIC_APP_URL,
    process.env.PUBLIC_ADMIN_URL,
    process.env.PUBLIC_API_URL,
  ].some(urlIsHttps);
}

export function liminalisCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookiesEnabled(),
    path: '/',
  };
}

export function liminalisCookieClearOptions(): CookieOptions {
  return liminalisCookieOptions();
}
