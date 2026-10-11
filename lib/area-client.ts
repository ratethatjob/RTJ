"use client";

import { AREA_COOKIE, type AreaChoice, isAreaId, TZ_COOKIE } from "./search-areas";

// The visitor's area choice in the browser: a cookie (so the server sees it too), shared by
// the map search's "Near" select and the home page's city picker.

const YEAR = 365 * 24 * 3600;
const listeners = new Set<() => void>();

const valid = (v: string | undefined): v is AreaChoice =>
  Boolean(v && (v === "auto" || v === "any" || isAreaId(v) || /^geo:-?[\d.]+,-?[\d.]+$/.test(v)));

function readCookie(name: string) {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : undefined;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${YEAR}; SameSite=Lax${
    location.protocol === "https:" ? "; Secure" : ""
  }`;
}

export function readArea(): AreaChoice {
  const value = readCookie(AREA_COOKIE);
  if (valid(value)) return value;
  // Earlier versions kept it in localStorage: move it over once.
  try {
    const old = localStorage.getItem("rtj:area") ?? undefined;
    if (valid(old)) {
      writeCookie(AREA_COOKIE, old);
      localStorage.removeItem("rtj:area");
      return old;
    }
  } catch {}
  return "auto";
}

export function saveArea(value: AreaChoice) {
  writeCookie(AREA_COOKIE, value);
  listeners.forEach((l) => l());
}

export function subscribeArea(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Lets the server guess the city from the time zone when there is no IP location. */
export function rememberTimeZone() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone && readCookie(TZ_COOKIE) !== zone) writeCookie(TZ_COOKIE, zone);
  } catch {}
}

/** Browser location (only after the visitor picks "My location"), rounded to about 1 km. */
export function locate(): Promise<AreaChoice> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("no geolocation"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(`geo:${pos.coords.latitude.toFixed(2)},${pos.coords.longitude.toFixed(2)}`),
      reject,
      { maximumAge: 600_000, timeout: 10_000 },
    );
  });
}
