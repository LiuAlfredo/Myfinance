import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

export function PersonalSettingsPage() {
  const navigate = useNavigate();
  const changePassword = useAuthStore((state) => state.changePassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 6) {
      setError("新密码至少需要 6 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }
    if (newPassword === currentPassword) {
      setError("新密码不能与当前密码相同");
      return;
    }

    setIsSubmitting(true);
    try {
      const changed = await changePassword(currentPassword, newPassword);
      if (!changed) {
        setError("当前密码不正确");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("密码已更新，下次登录请使用新密码");
    } catch {
      setError("密码保存失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="modules-screen">
      <header className="modules-header">
        <Button variant="ghost" onClick={() => navigate("/modules")}>
          <ArrowLeft className="size-4" />
          返回模块选择
        </Button>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm font-medium text-[var(--text-secondary)] sm:inline">My Personal Affairs</span>
          <ThemeSwitcher />
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-5 py-12 md:py-20">
        <p className="entry-eyebrow">SETTINGS</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-[var(--text)]">设置</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">管理工作空间的登录密码与基础偏好。</p>

        <section className="content-card mt-10">
          <div className="flex items-start gap-3">
            <span className="module-icon"><KeyRound className="size-5" /></span>
            <div>
              <h2 className="font-semibold text-[var(--text)]">修改登录密码</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">修改前需要验证当前密码，新密码至少为 6 位。</p>
            </div>
          </div>

          <form className="mt-7 max-w-lg space-y-4" onSubmit={handleSubmit}>
            <label className="form-label">
              当前密码
              <input
                className="form-control"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label className="form-label">
              新密码
              <input
                className="form-control"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label className="form-label">
              确认新密码
              <input
                className="form-control"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>

            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            {success ? (
              <p className="flex items-center gap-2 text-sm text-[var(--success)]">
                <ShieldCheck className="size-4" />
                {success}
              </p>
            ) : null}

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "正在保存…" : "保存新密码"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
