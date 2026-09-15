import { motion } from "motion/react";
import { ArrowLeft, Calendar, Check, Circle, FileClock, Flag, Pencil, Plus, Sparkles, Target } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ItemDialog, LogDialog, MilestoneDialog } from "@/features/journey/journey-dialogs";
import { JourneyProgress } from "@/features/journey/progress-bar";
import { displayDate, itemStatusLabels, logKindLabels, projectStatusLabels } from "@/features/journey/labels";
import { getJourneyProject, toggleJourneyMilestone } from "@/features/journey/journey-service";
import type { JourneyMilestone, JourneyProject, JourneyProjectDetail, JourneyProjectItem } from "@/features/journey/types";

export function ProjectDetail({ projectId, onBack, onEdit }: { projectId: string; onBack: () => void; onEdit: (project: JourneyProject) => void }) {
  const [detail, setDetail] = useState<JourneyProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [itemDialog, setItemDialog] = useState<JourneyProjectItem | "new" | null>(null);
  const [milestoneDialog, setMilestoneDialog] = useState<JourneyMilestone | "new" | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const load = useCallback(async () => {
    try { setDetail(await getJourneyProject(projectId)); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "项目读取失败"); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);
  const refreshed = () => { setItemDialog(null); setMilestoneDialog(null); setLogOpen(false); void load(); };

  if (!detail) return <div className="journey-detail-loading"><Button variant="ghost" onClick={onBack}><ArrowLeft className="size-4" />返回</Button><p>{error ?? "正在读取项目…"}</p></div>;
  const { project, items, milestones, logs } = detail;

  return <div className="journey-detail">
    <div className="flex items-center justify-between gap-3"><Button variant="ghost" onClick={onBack}><ArrowLeft className="size-4" />返回项目中心</Button><Button variant="secondary" onClick={() => onEdit(project)}><Pencil className="size-4" />编辑项目</Button></div>
    {error ? <p className="journey-error">{error}</p> : null}
    <motion.section className="journey-cover" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${project.accent} 18%, var(--surface)), var(--surface))` }}>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl"><div className="flex flex-wrap gap-2"><span className="journey-pill">{project.projectType === "WORK" ? "工作项目" : "个人项目"}</span><span className="journey-pill">{projectStatusLabels[project.status]}</span></div><h1 className="mt-5 text-4xl font-semibold tracking-[-.045em] text-[var(--text)]">{project.title}</h1><p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">{project.summary || "还没有填写一句话介绍。"}</p></div>
        <div className="journey-progress-number" style={{ color: project.accent }}>{project.progress}<small>%</small></div>
      </div>
      <div className="mt-7"><JourneyProgress value={project.progress} color={project.accent} /></div>
      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm text-[var(--text-secondary)]"><span className="flex items-center gap-2"><Target className="size-4" />{project.currentGoal || "尚未设置当前目标"}</span><span className="flex items-center gap-2"><Calendar className="size-4" />{displayDate(project.targetDate)}</span></div>
    </motion.section>

    <div className="journey-detail-grid">
      <section className="content-card"><div className="card-heading"><div><h2>功能与任务</h2><p>拆解项目，并分别管理每一部分的完成度。</p></div><Button size="sm" onClick={() => setItemDialog("new")}><Plus className="size-4" />添加</Button></div>
        <div className="mt-5 space-y-3">{items.map((item, index) => <motion.button key={item.id} type="button" className="journey-item" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .04 }} onClick={() => setItemDialog(item)}><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-[var(--text)]">{item.title}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{itemStatusLabels[item.status]} · {item.priority === "HIGH" ? "高优先级" : item.priority === "LOW" ? "低优先级" : "中优先级"}</p></div><strong className="text-sm text-[var(--text-secondary)]">{item.progress}%</strong></div><div className="mt-3"><JourneyProgress value={item.progress} color={item.status === "BLOCKED" ? "var(--warning)" : project.accent} compact /></div>{item.description ? <p className="mt-3 text-left text-xs leading-5 text-[var(--text-tertiary)]">{item.description}</p> : null}</motion.button>)}{!items.length ? <Empty copy="还没有功能或任务，先拆解项目的第一部分。" /> : null}</div>
      </section>

      <section className="content-card"><div className="card-heading"><div><h2>里程碑</h2><p>从开始到完成，逐段点亮项目路线。</p></div><Button size="sm" onClick={() => setMilestoneDialog("new")}><Plus className="size-4" />添加</Button></div>
        <div className="journey-timeline">{milestones.map((milestone, index) => <div className="journey-milestone" key={milestone.id}><button type="button" className={`journey-milestone-dot ${milestone.isCompleted ? "journey-milestone-done" : ""}`} onClick={() => void toggleJourneyMilestone(milestone.id, !milestone.isCompleted).then(load)}>{milestone.isCompleted ? <Check className="size-3.5" /> : <Circle className="size-3" />}</button><button type="button" className="min-w-0 flex-1 text-left" onClick={() => setMilestoneDialog(milestone)}><p className={`font-medium ${milestone.isCompleted ? "text-[var(--text-tertiary)] line-through" : "text-[var(--text)]"}`}>{milestone.title}</p><p className="mt-1 text-xs text-[var(--text-tertiary)]">{displayDate(milestone.targetDate)}</p></button>{!milestone.isCompleted && index === milestones.findIndex((entry) => !entry.isCompleted) ? <span className="journey-live">当前</span> : null}</div>)}{!milestones.length ? <Empty copy="设置第一个里程碑，让项目路线清晰可见。" /> : null}</div>
      </section>
    </div>

    <div className="journey-detail-grid">
      <section className="content-card"><div className="card-heading"><div><h2>项目介绍</h2><p>项目存在的原因与最终想实现的结果。</p></div></div><p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]">{project.description || "还没有详细介绍。可以通过编辑项目补充。"}</p></section>
      <section className="content-card"><div className="card-heading"><div><h2>项目记录</h2><p>保留决定、困难、发现与阶段总结。</p></div><Button size="sm" onClick={() => setLogOpen(true)}><Plus className="size-4" />记录</Button></div><div className="mt-4 space-y-3">{logs.slice(0, 8).map((log) => <article className="journey-log" key={log.id}><div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">{log.kind === "DISCOVERY" ? <Sparkles className="size-3.5" /> : log.kind === "SUMMARY" ? <Flag className="size-3.5" /> : <FileClock className="size-3.5" />}<span>{logKindLabels[log.kind]}</span><span>·</span><time>{new Date(log.createdAt).toLocaleDateString("zh-CN")}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{log.content}</p></article>)}{!logs.length ? <Empty copy="项目推进过程中，重要想法和决定可以记录在这里。" /> : null}</div></section>
    </div>
    <ItemDialog open={itemDialog !== null} projectId={projectId} item={itemDialog === "new" ? null : itemDialog} onClose={() => setItemDialog(null)} onSaved={refreshed} />
    <MilestoneDialog open={milestoneDialog !== null} projectId={projectId} milestone={milestoneDialog === "new" ? null : milestoneDialog} onClose={() => setMilestoneDialog(null)} onSaved={refreshed} />
    <LogDialog open={logOpen} projectId={projectId} onClose={() => setLogOpen(false)} onSaved={refreshed} />
  </div>;
}

function Empty({ copy }: { copy: string }) { return <div className="journey-empty"><p>{copy}</p></div>; }
