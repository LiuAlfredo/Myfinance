import { useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth-store";
import {
  deleteVaultItem, getVaultItem, listVaultItems, lockVault, saveVaultItem, unlockVault,
  type VaultInput, type VaultItem, type VaultSummary,
} from "./vault-service";

const blank: VaultInput = { platform: "", website: "", username: "", password: "", note: "" };

export function VaultPanel() {
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const [unlocked, setUnlocked] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [items, setItems] = useState<VaultSummary[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<VaultItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<VaultInput>(blank);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);

  function clearLocal() {
    generation.current += 1;
    setUnlocked(false);
    setItems([]);
    setSelected(null);
    setEditing(false);
    setForm(blank);
    setShowPassword(false);
    setMasterPassword("");
    setSearch("");
    setBusy(false);
  }

  useEffect(() => {
    if (!unlocked || !authenticated) return;
    const timer = window.setTimeout(() => { clearLocal(); void lockVault().catch(() => {}); }, 5 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [unlocked, authenticated]);

  useEffect(() => () => { generation.current += 1; void lockVault().catch(() => {}); }, []);

  function handleError(reason: unknown) {
    const message = reason instanceof Error ? reason.message : String(reason);
    if (message.includes("已锁定")) clearLocal();
    setError(message);
  }

  async function unlock(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const request = ++generation.current;
    try {
      if (!(await unlockVault(masterPassword))) { setError("软件密码不正确"); return; }
      const list = await listVaultItems();
      if (request !== generation.current) return;
      setItems(list);
      setUnlocked(true);
      setMasterPassword("");
    } catch (reason) { if (request === generation.current) handleError(reason); }
    finally { setBusy(false); }
  }

  async function openItem(id: string) {
    setError("");
    const request = ++generation.current;
    try {
      const item = await getVaultItem(id);
      if (request === generation.current) { setSelected(item); setShowPassword(false); }
    } catch (reason) { if (request === generation.current) handleError(reason); }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const request = ++generation.current;
    try {
      await saveVaultItem(form, selected?.id);
      const list = await listVaultItems();
      if (request !== generation.current) return;
      setItems(list);
      setSelected(null);
      setForm(blank);
      setEditing(false);
    } catch (reason) { if (request === generation.current) handleError(reason); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!selected || !window.confirm(`删除 ${selected.platform} 的账号 ${selected.username}？此操作无法撤销。`)) return;
    const request = ++generation.current;
    setBusy(true);
    try {
      await deleteVaultItem(selected.id);
      const list = await listVaultItems();
      if (request !== generation.current) return;
      setItems(list);
      setSelected(null);
    } catch (reason) { if (request === generation.current) handleError(reason); }
    finally { setBusy(false); }
  }

  async function copyPassword() {
    if (!selected) return;
    try {
      const password = selected.password;
      await navigator.clipboard.writeText(password);
      window.setTimeout(async () => {
        try { if (await navigator.clipboard.readText() === password) await navigator.clipboard.writeText(""); }
        catch { /* Clipboard permissions may change while the app is inactive. */ }
      }, 30_000);
    } catch { setError("复制失败，请检查剪贴板权限"); }
  }

  const visible = items.filter((item) => `${item.platform} ${item.username}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));

  if (!unlocked) return (
    <section className="content-card mt-6">
      <div className="flex items-center gap-3"><LockKeyhole className="size-5" /><h2 className="font-semibold">平台密码库</h2></div>
      <p className="mt-3 text-sm text-[var(--text-secondary)]">输入软件密码后查看和管理保存在本机的账号。密码库将在 5 分钟后自动锁定。</p>
      <form className="mt-5 flex max-w-lg flex-wrap gap-3" onSubmit={(event) => void unlock(event)}>
        <input className="form-control min-w-52 flex-1" type="password" autoComplete="current-password" aria-label="软件密码" placeholder="软件密码" value={masterPassword} onChange={(event) => setMasterPassword(event.target.value)} required />
        <Button type="submit" disabled={busy}>解锁密码库</Button>
      </form>
      {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
      {!("__TAURI_INTERNALS__" in window) && <p className="mt-3 text-sm text-[var(--text-secondary)]">请在桌面应用中使用密码库。</p>}
    </section>
  );

  return (
    <section className="content-card mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">平台密码库</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { clearLocal(); void lockVault().catch(() => {}); }}>立即锁定</Button>
          <Button onClick={() => { setSelected(null); setForm(blank); setEditing(true); setError(""); }}><Plus className="size-4" />新增记录</Button>
        </div>
      </div>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">这里保存密码记录；修改平台密码仍需前往对应网站操作。</p>
      <label className="mt-5 flex items-center gap-2 rounded-xl border border-[var(--border)] px-3"><Search className="size-4" /><input className="w-full bg-transparent py-3 outline-none" aria-label="搜索平台或账号" placeholder="搜索平台或账号" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
      <div className="mt-4 space-y-2">
        {visible.map((item) => <button key={item.id} className="flex w-full justify-between rounded-xl border border-[var(--border)] p-4 text-left hover:bg-[var(--surface-muted)]" onClick={() => void openItem(item.id)}><span><strong>{item.platform}</strong><span className="ml-3 text-sm text-[var(--text-secondary)]">{item.username}</span></span><span className="text-xs text-[var(--text-tertiary)]">{new Date(item.updatedAt).toLocaleDateString("zh-CN")}</span></button>)}
        {!visible.length && <p className="py-6 text-center text-sm text-[var(--text-secondary)]">暂无匹配的记录</p>}
      </div>
      <Dialog open={Boolean(selected) && !editing} onOpenChange={(open) => { if (!open) { setSelected(null); setShowPassword(false); generation.current++; } }} title={selected?.platform ?? "账号详情"}>
        {selected && <div className="space-y-4 break-all text-sm">
          <p>账号：{selected.username}</p><p>网址：{selected.website || "未填写"}</p>
          <div className="flex items-center gap-2"><span>密码：{showPassword ? selected.password : "••••••••"}</span><Button variant="ghost" size="icon" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button></div>
          <p>备注：{selected.note || "无"}</p>
          <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => void copyPassword()}>复制密码</Button><Button variant="secondary" onClick={() => void remove()} disabled={busy}>删除</Button><Button onClick={() => { setForm({ platform: selected.platform, website: selected.website, username: selected.username, password: selected.password, note: selected.note }); setEditing(true); }}>编辑</Button></div>
        </div>}
      </Dialog>
      <Dialog open={editing} onOpenChange={(open) => { if (!open) { setEditing(false); setSelected(null); setForm(blank); generation.current++; } }} title={selected ? "编辑记录" : "新增记录"} description="更新本地记录不会修改对应平台的实际密码。">
        <form className="space-y-3" onSubmit={(event) => void save(event)}>
          {([ ["platform", "平台名称"], ["website", "网址"], ["username", "账号"], ["password", "密码"] ] as const).map(([field, label]) => <label key={field} className="form-label">{label}<input className="form-control" type={field === "password" ? "password" : "text"} autoComplete="off" maxLength={field === "website" ? 2048 : field === "password" ? 4096 : 512} required={field === "platform" || field === "username" || field === "password"} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /></label>)}
          <label className="form-label">备注<textarea className="form-control" rows={3} maxLength={8192} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? "保存中…" : "保存记录"}</Button></div>
        </form>
      </Dialog>
    </section>
  );
}
