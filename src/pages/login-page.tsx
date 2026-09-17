import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

export function LoginPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const login = useAuthStore((state) => state.login);
  const setupPassword = useAuthStore((state) => state.setupPassword);
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let active = true;
    void invoke<boolean>("app_password_setup_required").then((required) => { if (active) setSetupRequired(required); })
      .catch(() => { if (active) setError("无法读取安全配置，请检查本地数据库"); });
    return () => { active = false; };
  }, []);

  if (isAuthenticated) return <Navigate replace to="/modules" />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      if (setupRequired) {
        if (password.length < 12) { setError("软件密码至少需要 12 位"); return; }
        if (password !== confirmation) { setError("两次输入的密码不一致"); return; }
        await setupPassword(password);
        navigate("/modules", { replace: true });
        return;
      }
      if (!(await login(password))) {
        setError("密码不正确，请重新输入");
        setPassword("");
        return;
      }
      navigate("/modules", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "无法验证密码，请检查本地数据库后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="entry-screen">
      <div className="entry-orb entry-orb-one" />
      <div className="entry-orb entry-orb-two" />
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-mark" aria-hidden="true">P</div>
        <p className="entry-eyebrow">PERSONAL WORKSPACE</p>
        <h1 id="login-title" className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--text)]">
          My Personal Affairs
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          {setupRequired ? "首次使用，请设置软件密码。请妥善保管，遗失后无法解开私密数据。" : "你的个人事务管理中心。输入密码后进入工作空间。"}
        </p>

        <form className="mt-8" onSubmit={handleSubmit}>
          {window.sessionStorage.getItem("my-personal-affairs:login-notice") ? <p role="status" className="mb-4 text-sm text-[var(--text-secondary)]">{window.sessionStorage.getItem("my-personal-affairs:login-notice")}</p> : null}
          <label className="form-label" htmlFor="app-password">{setupRequired ? "设置软件密码" : "密码"}</label>
          <div className={`password-field ${error ? "password-field-error" : ""}`}>
            <LockKeyhole className="size-[18px] shrink-0 text-[var(--text-tertiary)]" />
            <input
              id="app-password"
              autoFocus
              autoComplete={setupRequired ? "new-password" : "current-password"}
              aria-describedby={error ? "password-error" : undefined}
              aria-invalid={Boolean(error)}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError(null);
              }}
              placeholder="请输入密码"
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          </div>
          {setupRequired && <label className="form-label mt-4">再次输入密码<input className="form-control" type="password" autoComplete="new-password" required minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>}
          <div className="min-h-7 pt-2">
            {error ? <p id="password-error" className="text-sm text-[var(--danger)]">{error}</p> : null}
          </div>
          <Button className="mt-2 w-full" type="submit" disabled={!password || isSubmitting || ("__TAURI_INTERNALS__" in window && setupRequired === null)}>
            {isSubmitting ? "正在验证…" : setupRequired ? "设置并进入" : "进入工作空间"}
          </Button>
        </form>

        <div className="mt-7 flex items-center justify-center gap-2 text-xs text-[var(--text-tertiary)]">
          <ShieldCheck className="size-4" />
          <span>当前会话将在软件关闭后自动锁定</span>
        </div>
      </section>
    </main>
  );
}
