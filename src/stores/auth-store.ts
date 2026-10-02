import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

const browserProfilesKey = "my-personal-affairs:browser-profiles";
const passwordIterations = 210_000;

interface PasswordRecord {
  salt: string;
  hash: string;
}

export interface ProfileCredentials {
  username: string;
  password: string;
  legacyPassword?: string;
  recoveryKey?: string;
}

export interface ProfileAuthResult {
  accountId: string;
  username: string;
  cloudConnected: boolean;
  cloudError: string | null;
  recoveryKey: string | null;
  migratedLegacy: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  currentUser: string | null;
  accountId: string | null;
  cloudWarning: string | null;
  sessionGeneration: number;
  login: (input: ProfileCredentials) => Promise<ProfileAuthResult>;
  register: (input: ProfileCredentials) => Promise<ProfileAuthResult>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
}

const isTauri = () => "__TAURI_INTERNALS__" in window;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return window.btoa(binary);
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

function browserProfiles(): Record<string, PasswordRecord> {
  try {
    return JSON.parse(window.localStorage.getItem(browserProfilesKey) ?? "{}") as Record<string, PasswordRecord>;
  } catch {
    return {};
  }
}

async function browserAuthenticate(input: ProfileCredentials, register: boolean): Promise<ProfileAuthResult> {
  const username = input.username.trim().toLowerCase();
  const profiles = browserProfiles();
  const existing = profiles[username];
  if (register && existing) throw new Error("该账号已注册，请直接登录");
  if (!register && !existing) throw new Error("账号或密码不正确");
  if (register) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    profiles[username] = { salt: bytesToBase64(salt), hash: await derivePassword(input.password, salt) };
    window.localStorage.setItem(browserProfilesKey, JSON.stringify(profiles));
  } else {
    const salt = Uint8Array.from(window.atob(existing.salt), (value) => value.charCodeAt(0));
    if ((await derivePassword(input.password, salt)) !== existing.hash) throw new Error("账号或密码不正确");
  }
  return {
    accountId: username,
    username,
    cloudConnected: false,
    cloudError: "浏览器预览不连接云端",
    recoveryKey: null,
    migratedLegacy: false,
  };
}

function authenticatedState(result: ProfileAuthResult) {
  return {
    isAuthenticated: true,
    currentUser: result.username,
    accountId: result.accountId,
    cloudWarning: result.cloudConnected ? null : result.cloudError,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  currentUser: null,
  accountId: null,
  cloudWarning: null,
  sessionGeneration: 0,
  login: async (input) => {
    const result = isTauri()
      ? await invoke<ProfileAuthResult>("login_profile", { input })
      : await browserAuthenticate(input, false);
    window.sessionStorage.removeItem("my-personal-affairs:login-notice");
    set({ ...authenticatedState(result), sessionGeneration: get().sessionGeneration + 1 });
    return result;
  },
  register: async (input) => {
    const result = isTauri()
      ? await invoke<ProfileAuthResult>("register_profile", { input })
      : await browserAuthenticate(input, true);
    window.sessionStorage.removeItem("my-personal-affairs:login-notice");
    set({ ...authenticatedState(result), sessionGeneration: get().sessionGeneration + 1 });
    return result;
  },
  logout: async () => {
    if (isTauri()) {
      await invoke("logout_profile");
    }
    set({
      isAuthenticated: false,
      currentUser: null,
      accountId: null,
      cloudWarning: null,
      sessionGeneration: get().sessionGeneration + 1,
    });
  },
  changePassword: async (currentPassword, newPassword) => {
    if (!isTauri()) return false;
    return invoke<boolean>("change_profile_password", { currentPassword, newPassword });
  },
}));
