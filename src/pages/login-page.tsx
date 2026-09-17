import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

export function LoginPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate replace to="/modules" />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      if (!(await login(password))) {
        setError("密码不正确，请重新输入");
        setPassword("");
        return;
      }
      navigate("/modules", { replace: true });
    } catch {
      setError("无法验证密码，请检查本地数据库后重试");
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
          你的个人事务管理中心。输入密码后进入工作空间。
        </p>

        <form className="mt-8" onSubmit={handleSubmit}>
          {window.sessionStorage.getItem("my-personal-affairs:login-notice") ? <p role="status" className="mb-4 text-sm text-[var(--text-secondary)]">{window.sessionStorage.getItem("my-personal-affairs:login-notice")}</p> : null}
          <label className="form-label" htmlFor="app-password">密码</label>
          <div className={`password-field ${error ? "password-field-error" : ""}`}>
            <LockKeyhole className="size-[18px] shrink-0 text-[var(--text-tertiary)]" />
            <input
              id="app-password"
              autoFocus
              autoComplete="current-password"
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
          <div className="min-h-7 pt-2">
            {error ? <p id="password-error" className="text-sm text-[var(--danger)]">{error}</p> : null}
          </div>
          <Button className="mt-2 w-full" type="submit" disabled={!password || isSubmitting}>
            {isSubmitting ? "正在验证…" : "进入工作空间"}
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
