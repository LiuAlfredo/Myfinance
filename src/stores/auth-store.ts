import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

const sessionKey = "my-personal-affairs:authenticated";
const passwordKey = "my-personal-affairs:password";
const initialPassword = "123456";
const passwordIterations = 210_000;

interface PasswordRecord {
  salt: string;
  hash: string;
}

interface AuthState {
  isAuthenticated: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
}

const isTauri = () => "__TAURI_INTERNALS__" in window;

function hasActiveSession() {
  return !isTauri() && window.sessionStorage.getItem(sessionKey) === "true";
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePassword(password: string, salt: Uint8Array) {
  const material = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await window.crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: passwordIterations },
    material,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

function readPasswordRecord(): PasswordRecord | null {
  const stored = window.localStorage.getItem(passwordKey);
  if (!stored) return null;
  try {
    const record = JSON.parse(stored) as Partial<PasswordRecord>;
    return typeof record.salt === "string" && typeof record.hash === "string"
      ? { salt: record.salt, hash: record.hash }
      : null;
  } catch {
    return null;
  }
}

async function passwordMatches(password: string) {
  const record = readPasswordRecord();
  if (!record) return password === initialPassword;
  const hash = await derivePassword(password, base64ToBytes(record.salt));
  return hash === record.hash;
}

async function savePassword(password: string) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const record: PasswordRecord = {
    salt: bytesToBase64(salt),
    hash: await derivePassword(password, salt),
  };
  window.localStorage.setItem(passwordKey, JSON.stringify(record));
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: hasActiveSession(),
  login: async (password) => {
    const valid = isTauri()
      ? await invoke<boolean>("verify_app_password", { password })
      : await passwordMatches(password);
    if (!valid) return false;
    window.sessionStorage.removeItem("my-personal-affairs:login-notice");
    window.sessionStorage.setItem(sessionKey, "true");
    set({ isAuthenticated: true });
    return true;
  },
  logout: async () => {
    window.sessionStorage.removeItem(sessionKey);
    set({ isAuthenticated: false });
    if (isTauri()) {
      try { await invoke("lock_private_data"); } catch { /* Session is still cleared locally. */ }
    }
  },
  changePassword: async (currentPassword, newPassword) => {
    if (isTauri()) {
      return invoke<boolean>("change_app_password", { currentPassword, newPassword });
    }
    if (!(await passwordMatches(currentPassword))) return false;
    await savePassword(newPassword);
    return true;
  },
}));
