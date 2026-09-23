import type { ReactNode } from "react";
import { Grid2X2, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
export function LifeShell({ eyebrow, title, description, children, action }: {
    eyebrow: string;
    title: string;
    description: string;
    children: ReactNode;
    action?: ReactNode;
}) {
    const navigate = useNavigate();
    return <main className="modules-screen"><header className="modules-header"><div className="flex gap-2"><Button variant="ghost" onClick={() => navigate("/today")}><Home className="size-4"/>今日首页</Button><Button variant="ghost" onClick={() => navigate("/modules")}><Grid2X2 className="size-4"/>全部模块</Button></div><ThemeSwitcher /></header><div className="mx-auto w-full max-w-6xl px-5 py-10 md:py-14"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="entry-eyebrow">{eyebrow}</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.045em] text-[var(--text)]">{title}</h1><p className="mt-3 text-sm text-[var(--text-secondary)]">{description}</p></div>{action}</div>{children}</div></main>;
}
