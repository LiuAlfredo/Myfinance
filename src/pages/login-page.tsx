import { Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

interface ProfileAuthStatus {
  knownUsernames: string[];
  legacyDataAvailable: boolean;
}

export function LoginPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [legacyPassword, setLegacyPassword] = useState("");
  const [importedRecoveryKey, setImportedRecoveryKey] = useState("");
  const [status, setStatus] = useState<ProfileAuthStatus>({ knownUsernames: [], legacyDataAvailable: false });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let active = true;
    void invoke<ProfileAuthStatus>("get_profile_auth_status")
      .then((value) => {
        if (!active) return;
        setStatus(value);
        if (value.knownUsernames[0]) setUsername((current) => current || value.knownUsernames[0]);
      })
      .catch(() => { if (active) setError("无法读取本机账号索引"); });
    return () => { active = false; };
  }, []);

  if (isAuthenticated && !recoveryKey) return <Navigate replace to="/today" />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username.trim())) {
      setError("账号须为 3–32 位字母、数字、点、横线或下划线");
      return;
    }
    if (password.length < 12) {
      setError("密码至少需要 12 位");
      return;
    }
    if (mode === "register" && password !== confirmation) {
      setError("两次输入的密码不一致");
      return;
    }
    setIsSubmitting(true);
    try {
      const authenticate = mode === "register" ? register : login;
      const result = await authenticate({
        username: username.trim(),
        password,
        legacyPassword: legacyPassword || undefined,
        recoveryKey: importedRecoveryKey || undefined,
      });
      setPassword("");
      setConfirmation("");
      setLegacyPassword("");
      setImportedRecoveryKey("");
      if (result.recoveryKey) {
        setRecoveryKey(result.recoveryKey);
      } else {
        navigate("/today", { replace: true });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "账号验证失败，请稍后重试");
      setPassword("");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (recoveryKey) {
    return (
      <main className="entry-screen">
        <section className="login-panel" aria-labelledby="recovery-title">
          <div className="login-mark" aria-hidden="true">✓</div>
          <p className="entry-eyebrow">ACCOUNT CREATED</p>
          <h1 id="recovery-title" className="mt-3 text-2xl font-semibold text-[var(--text)]">保存云备份恢复密钥</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            该密钥用于解密云端备份。服务器无法恢复它，请保存到密码管理器或离线介质。
          </p>
          <textarea className="form-control mt-5 min-h-24 break-all font-mono text-xs" readOnly value={recoveryKey} />
          <Button
            className="mt-3 w-full"
            variant="secondary"
            onClick={() => void navigator.clipboard.writeText(recoveryKey)}
          >
            复制恢复密钥
          </Button>
          <label className="mt-5 flex items-start gap-2 text-sm text-[var(--text-secondary)]">
            <input type="checkbox" checked={recoveryConfirmed} onChange={(event) => setRecoveryConfirmed(event.target.checked)} />
            我已经安全保存恢复密钥
          </label>
          <Button className="mt-5 w-full" disabled={!recoveryConfirmed} onClick={() => setRecoveryKey(null)}>
            进入工作空间
          </Button>
        </section>
      </main>
    );
  }

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
          {mode === "register" ? "注册云账号并创建独立的本地数据库。" : "输入账号和密码进入自己的独立工作空间。"}
        </p>

        <form className="mt-7" onSubmit={handleSubmit}>
          {window.sessionStorage.getItem("my-personal-affairs:login-notice") ? (
            <p role="status" className="mb-4 text-sm text-[var(--text-secondary)]">
              {window.sessionStorage.getItem("my-personal-affairs:login-notice")}
            </p>
          ) : null}
          <label className="form-label" htmlFor="profile-username">账号</label>
          <div className={`password-field ${error ? "password-field-error" : ""}`}>
            <UserRound className="size-[18px] shrink-0 text-[var(--text-tertiary)]" />
            <input
              id="profile-username"
              autoFocus
              autoComplete="username"
              list="known-profile-usernames"
              value={username}
              onChange={(event) => { setUsername(event.target.value); setError(null); }}
              placeholder="请输入账号"
            />
            <datalist id="known-profile-usernames">
              {status.knownUsernames.map((value) => <option key={value} value={value} />)}
            </datalist>
          </div>

          <label className="form-label mt-4" htmlFor="profile-password">密码</label>
          <div className={`password-field ${error ? "password-field-error" : ""}`}>
            <LockKeyhole className="size-[18px] shrink-0 text-[var(--text-tertiary)]" />
            <input
              id="profile-password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => { setPassword(event.target.value); setError(null); }}
              placeholder="至少 12 位"
            />
            <button type="button" className="password-toggle" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          </div>

          {mode === "register" ? (
            <label className="form-label mt-4">确认密码
              <input className="form-control" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </label>
          ) : null}

          {status.legacyDataAvailable ? (
            <label className="form-label mt-4">原软件密码
              <input className="form-control" type="password" autoComplete="off" value={legacyPassword} onChange={(event) => setLegacyPassword(event.target.value)} placeholder="首次绑定账号时用于迁移现有数据" />
              <span className="mt-1 block text-xs font-normal text-[var(--text-tertiary)]">原数据库会保留，只复制到首个账号。</span>
            </label>
          ) : null}

          {mode === "login" ? (
            <label className="form-label mt-4">云备份恢复密钥（可选）
              <input className="form-control" type="password" autoComplete="off" value={importedRecoveryKey} onChange={(event) => setImportedRecoveryKey(event.target.value)} placeholder="新设备登录已有备份的账号时填写" />
            </label>
          ) : null}

          <div className="min-h-7 pt-2">
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          </div>
          <Button className="mt-2 w-full" type="submit" disabled={!username.trim() || !password || isSubmitting}>
            {isSubmitting ? "正在验证…" : mode === "register" ? "注册并创建工作空间" : "登录"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-5 w-full text-center text-sm text-[var(--primary)] hover:underline"
          onClick={() => { setMode((value) => value === "login" ? "register" : "login"); setError(null); setConfirmation(""); }}
        >
          {mode === "login" ? "没有账号？注册账号" : "已有账号？返回登录"}
        </button>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[var(--text-tertiary)]">
          <ShieldCheck className="size-4" />
          <span>每个账号使用独立数据库，关闭或锁定后清除解密密钥</span>
        </div>
      </section>
    </main>
  );
}
