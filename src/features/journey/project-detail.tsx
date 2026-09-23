import { motion } from "motion/react";
import {
  ArrowLeft, Calendar, Check, Circle, FileClock, Flag, Lightbulb,
  Pencil, Plus, Sparkles, Target, Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ItemDialog, LogDialog, MilestoneDialog } from "@/features/journey/journey-dialogs";
import { JourneyProgress } from "@/features/journey/progress-bar";
import { displayDate, horizonLabels, itemStatusLabels, logKindLabels, projectStatusLabels } from "@/features/journey/labels";
import {
  deleteJourneyLog, getJourneyProject, saveJourneyProject, toggleJourneyMilestone,
} from "@/features/journey/journey-service";
import type {
  JourneyLog, JourneyMilestone, JourneyProject, JourneyProjectDetail, JourneyProjectItem,
} from "@/features/journey/types";
import { convertJourneyItem, listNotes, listTasks, type DailyTask, type KnowledgeNote } from "@/features/life/life-service";

export function ProjectDetail({
  projectId, onBack, onEdit,
}: {
  projectId: string; onBack: () => void; onEdit: (project: JourneyProject) => void;
}) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<JourneyProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [itemDialog, setItemDialog] = useState<JourneyProjectItem | "new" | null>(null);
  const [milestoneDialog, setMilestoneDialog] = useState<JourneyMilestone | "new" | null>(null);
  const [logDialog, setLogDialog] = useState<JourneyLog | "new" | null>(null);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [syncingProgress, setSyncingProgress] = useState(false);
  const [linkedTasks, setLinkedTasks] = useState<DailyTask[]>([]);
  const [linkedNotes, setLinkedNotes] = useState<KnowledgeNote[]>([]);

  const load = useCallback(async () => {
    try {
      const [nextDetail, tasks, notes] = await Promise.allSettled([getJourneyProject(projectId), listTasks("ALL", projectId), listNotes("ACTIVE", "", projectId)]);
      if (nextDetail.status === "rejected") throw nextDetail.reason;
      setDetail(nextDetail.value);
      if (tasks.status === "fulfilled") setLinkedTasks(tasks.value);
      if (notes.status === "fulfilled") setLinkedNotes(notes.value);
      setError(tasks.status === "rejected" || notes.status === "rejected" ? "部分关联资料读取失败，请刷新重试；项目仍可正常操作。" : null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "项目读取失败");
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);
  const refreshed = () => {
    setItemDialog(null);
    setMilestoneDialog(null);
    setLogDialog(null);
    void load();
  };

  const calculatedProgress = useMemo(() => {
    if (!detail) return null;
    const { items, milestones } = detail;
    if (!items.length && !milestones.length) return null;
    let total = 0;
    let count = 0;
    if (items.length) {
      const itemsAvg = items.reduce((sum, item) => sum + item.progress, 0) / items.length;
      total += itemsAvg;
      count++;
    }
    if (milestones.length) {
      const milestonesRatio = (milestones.filter((m) => m.isCompleted).length / milestones.length) * 100;
      total += milestonesRatio;
      count++;
    }
    return Math.round(total / count);
  }, [detail]);

  const handleSyncProgress = async () => {
    if (!detail || calculatedProgress === null || calculatedProgress === detail.project.progress) return;
    setSyncingProgress(true);
    try {
      await saveJourneyProject({
        title: detail.project.title,
        projectType: detail.project.projectType,
        summary: detail.project.summary,
        description: detail.project.description,
        status: calculatedProgress === 100 ? "COMPLETED" : detail.project.status,
        progress: calculatedProgress,
        currentGoal: detail.project.currentGoal,
        targetDate: detail.project.targetDate,
        accent: detail.project.accent,
      }, detail.project.id);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "更新完成度失败");
    } finally {
      setSyncingProgress(false);
    }
  };

  if (!detail) return <div className="journey-detail-loading"><Button variant="ghost" onClick={onBack}><ArrowLeft className="size-4" />返回</Button><p>{error ?? "正在读取项目…"}</p></div>;
  const { project, items, milestones, logs, sourceIdea, linkedGoals } = detail;
  const visibleLogs = showAllLogs ? logs : logs.slice(0, 8);

  return <div className="journey-detail">
    <div className="flex items-center justify-between gap-3">
      <Button variant="ghost" onClick={onBack}><ArrowLeft className="size-4" />返回项目中心</Button>
      <Button variant="secondary" onClick={() => onEdit(project)}><Pencil className="size-4" />编辑项目</Button>
    </div>
    {error ? <p className="journey-error">{error}</p> : null}
    <motion.section className="journey-cover" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${project.accent} 18%, var(--surface)), var(--surface))` }}>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="journey-pill">{project.projectType === "WORK" ? "工作项目" : "个人项目"}</span>
            <span className="journey-pill">{projectStatusLabels[project.status]}</span>
            {sourceIdea ? (
              <span className="journey-pill flex items-center gap-1 bg-[var(--surface)] text-[var(--accent)] shadow-xs">
                <Lightbulb className="size-3" />
                源自灵感: {sourceIdea.title}
              </span>
            ) : null}
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-.045em] text-[var(--text)]">{project.title}</h1>
          <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">{project.summary || "还没有填写一句话介绍。"}</p>
        </div>
        <div className="text-right">
          <div className="journey-progress-number" style={{ color: project.accent }}>{project.progress}<small>%</small></div>
          {calculatedProgress !== null && calculatedProgress !== project.progress ? (
            <button
              type="button"
              className="mt-1 text-xs text-[var(--accent)] underline hover:opacity-80"
              disabled={syncingProgress}
              onClick={() => void handleSyncProgress()}
            >
              根据任务同步({calculatedProgress}%)
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-7"><JourneyProgress value={project.progress} color={project.accent} /></div>
      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm text-[var(--text-secondary)]">
        <span className="flex items-center gap-2"><Target className="size-4" />{project.currentGoal || "尚未设置当前目标"}</span>
        <span className="flex items-center gap-2"><Calendar className="size-4" />{displayDate(project.targetDate)}</span>
      </div>
      {linkedGoals && linkedGoals.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text)]">服务目标:</span>
          {linkedGoals.map((goal) => (
            <span key={goal.id} className="journey-pill bg-[var(--surface)] shadow-xs">
              🎯 {goal.title} ({horizonLabels[goal.horizon]})
            </span>
          ))}
        </div>
      ) : null}
    </motion.section>

    <div className="journey-detail-grid">
      <section className="content-card"><div className="card-heading"><div><h2>关联日常任务</h2><p>项目事项可明确转成一条可执行任务。</p></div><Button size="sm" onClick={() => navigate(`/daily?project=${projectId}&new=task`)}><Plus className="size-4" />新建任务</Button></div><div className="mt-4 space-y-2">{linkedTasks.slice(0,8).map(task=><button key={task.id} className="journey-item text-left" onClick={()=>navigate(`/daily?task=${task.id}`)}><p className={task.status==="DONE"?"line-through text-[var(--text-tertiary)]":"font-medium"}>{task.title}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{task.status} · {task.plannedDay||"未安排"}</p></button>)}{!linkedTasks.length?<Empty copy="还没有关联任务。可从下方项目事项中选择转为日常任务。"/>:null}</div></section>
      <section className="content-card"><div className="card-heading"><div><h2>关联生活资料</h2><p>保存项目相关的笔记和资料。</p></div><Button size="sm" onClick={()=>navigate(`/knowledge?project=${projectId}&new=1`)}><Plus className="size-4" />新建笔记</Button></div><div className="mt-4 space-y-2">{linkedNotes.slice(0,8).map(note=><button key={note.id} className="journey-item text-left" onClick={()=>navigate(`/knowledge?note=${note.id}`)}><p className="font-medium">{note.title}</p><p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{note.tags||note.body||"空笔记"}</p></button>)}{!linkedNotes.length?<Empty copy="还没有关联资料。"/>:null}</div></section>
    </div>

    <div className="journey-detail-grid">
      <section className="content-card"><div className="card-heading"><div><h2>功能与任务</h2><p>拆解项目，并分别管理每一部分的完成度。</p></div><Button size="sm" onClick={() => setItemDialog("new")}><Plus className="size-4" />添加</Button></div>
        <div className="mt-5 space-y-3">{items.map((item, index) => <motion.div key={item.id} className="journey-item" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .04 }}><button type="button" className="w-full text-left" onClick={() => setItemDialog(item)}><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-[var(--text)]">{item.title}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{itemStatusLabels[item.status]} · {item.priority === "HIGH" ? "高优先级" : item.priority === "LOW" ? "低优先级" : "中优先级"}</p></div><strong className="text-sm text-[var(--text-secondary)]">{item.progress}%</strong></div><div className="mt-3"><JourneyProgress value={item.progress} color={item.status === "BLOCKED" ? "var(--warning)" : project.accent} compact /></div>{item.description ? <p className="mt-3 text-left text-xs leading-5 text-[var(--text-tertiary)]">{item.description}</p> : null}</button><button className="mt-3 text-xs font-medium text-[var(--accent)]" onClick={()=>void convertJourneyItem(item.id).then(()=>load()).catch(reason=>setError(reason instanceof Error?reason.message:"转换失败"))}>{linkedTasks.some(task=>task.sourceItemId===item.id)?"已关联日常任务":"转为日常任务"}</button></motion.div>)}{!items.length ? <Empty copy="还没有功能或任务，先拆解项目的第一部分。" /> : null}</div>
      </section>

      <section className="content-card"><div className="card-heading"><div><h2>里程碑</h2><p>从开始到完成，逐段点亮项目路线。</p></div><Button size="sm" onClick={() => setMilestoneDialog("new")}><Plus className="size-4" />添加</Button></div>
        <div className="journey-timeline">{milestones.map((milestone, index) => <div className="journey-milestone" key={milestone.id}><button type="button" className={`journey-milestone-dot ${milestone.isCompleted ? "journey-milestone-done" : ""}`} onClick={() => void toggleJourneyMilestone(milestone.id, !milestone.isCompleted).then(load)}>{milestone.isCompleted ? <Check className="size-3.5" /> : <Circle className="size-3" />}</button><button type="button" className="min-w-0 flex-1 text-left" onClick={() => setMilestoneDialog(milestone)}><p className={`font-medium ${milestone.isCompleted ? "text-[var(--text-tertiary)] line-through" : "text-[var(--text)]"}`}>{milestone.title}</p><p className="mt-1 text-xs text-[var(--text-tertiary)]">{displayDate(milestone.targetDate)}</p></button>{!milestone.isCompleted && index === milestones.findIndex((entry) => !entry.isCompleted) ? <span className="journey-live">当前</span> : null}</div>)}{!milestones.length ? <Empty copy="设置第一个里程碑，让项目路线清晰可见。" /> : null}</div>
      </section>
    </div>

    <div className="journey-detail-grid">
      <section className="content-card"><div className="card-heading"><div><h2>项目介绍</h2><p>项目存在的原因与最终想实现的结果。</p></div></div><p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]">{project.description || "还没有详细介绍。可以通过编辑项目补充。"}</p></section>
      <section className="content-card">
        <div className="card-heading">
          <div><h2>项目记录</h2><p>保留决定、困难、发现与阶段总结。</p></div>
          <div className="flex items-center gap-2">
            {logs.length > 8 ? (
              <Button size="sm" variant="ghost" onClick={() => setShowAllLogs(!showAllLogs)}>
                {showAllLogs ? "收起" : `全部 (${logs.length})`}
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setLogDialog("new")}><Plus className="size-4" />记录</Button>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {visibleLogs.map((log) => (
            <article className="journey-log group relative" key={log.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                  {log.kind === "DISCOVERY" ? <Sparkles className="size-3.5" /> : log.kind === "SUMMARY" ? <Flag className="size-3.5" /> : <FileClock className="size-3.5" />}
                  <span>{logKindLabels[log.kind]}</span>
                  <span>·</span>
                  <time>{new Date(log.createdAt).toLocaleDateString("zh-CN")}</time>
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    className="rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--text)]"
                    aria-label="编辑记录"
                    onClick={() => setLogDialog(log)}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-[var(--danger)] hover:opacity-80"
                    aria-label="删除记录"
                    onClick={() => {
                      if (window.confirm("确定删除这条记录吗？")) {
                        void deleteJourneyLog(log.id).then(refreshed);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{log.content}</p>
            </article>
          ))}
          {!logs.length ? <Empty copy="项目推进过程中，重要想法和决定可以记录在这里。" /> : null}
        </div>
      </section>
    </div>
    <ItemDialog open={itemDialog !== null} projectId={projectId} item={itemDialog === "new" ? null : itemDialog} onClose={() => setItemDialog(null)} onSaved={refreshed} onDeleted={refreshed} />
    <MilestoneDialog open={milestoneDialog !== null} projectId={projectId} milestone={milestoneDialog === "new" ? null : milestoneDialog} onClose={() => setMilestoneDialog(null)} onSaved={refreshed} onDeleted={refreshed} />
    <LogDialog open={logDialog !== null} projectId={projectId} log={logDialog === "new" ? null : logDialog} onClose={() => setLogDialog(null)} onSaved={refreshed} onDeleted={refreshed} />
  </div>;
}

function Empty({ copy }: { copy: string }) { return <div className="journey-empty"><p>{copy}</p></div>; }
