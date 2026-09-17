import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";

const idleMilliseconds = 15 * 60 * 1000;

export function SessionLock() {
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  useEffect(() => {
    if (!authenticated) return;
    let deadline = Date.now() + idleMilliseconds;
    let timer: number;
    const lock = () => {
      window.sessionStorage.setItem("my-personal-affairs:login-notice", "长时间未操作，工作空间已锁定，请重新输入密码。");
      void logout();
    };
    const check = () => {
      window.clearTimeout(timer);
      if (Date.now() >= deadline) lock();
      else timer = window.setTimeout(check, deadline - Date.now());
    };
    const activity = () => {
      if (Date.now() >= deadline) { lock(); return; }
      deadline = Date.now() + idleMilliseconds;
      check();
    };
    const events = ["pointerdown", "keydown", "wheel"] as const;
    events.forEach((name) => window.addEventListener(name, activity, { passive: true }));
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    check();
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, activity));
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [authenticated, logout]);
  return null;
}
