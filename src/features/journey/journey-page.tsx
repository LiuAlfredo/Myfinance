import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CheckCircle2, Compass, FolderKanban, Lightbulb, Pencil, Plus, Rocket, Sparkles, Target } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { GoalDialog, IdeaDialog, ProjectDialog } from "@/features/journey/journey-dialogs";
import { ProjectDetail } from "@/features/journey/project-detail";
import { JourneyProgress } from "@/features/journey/progress-bar";
import { convertJourneyIdea, getJourneyDashboard } from "@/features/journey/journey-service";
import { displayDate, horizonLabels, ideaStatusLabels, projectStatusLabels } from "@/features/journey/labels";
import type { JourneyDashboard, JourneyGoal, JourneyIdea, JourneyProject } from "@/features/journey/types";

type View = "OVERVIEW" | "PROJECTS" | "IDEAS" | "GOALS";
const emptyDashboard: JourneyDashboard = { projects: [], ideas: [], goals: [] };

export function JourneyPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("OVERVIEW");
  const [data, setData] = useState<JourneyDashboard>(emptyDashboard);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projectDialog, setProjectDialog] = useState<JourneyProject | "new" | null>(null);
  const [ideaDialog, setIdeaDialog] = useState<JourneyIdea | "new" | null>(null);
  const [goalDialog, setGoalDialog] = useState<JourneyGoal | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailRevision, setDetailRevision] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getJourneyDashboard()); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "我的进程加载失败"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const saved = () => { setProjectDialog(null); setIdeaDialog(null); setGoalDialog(null); void load(); };
  const projectSaved = (id: string) => { setProjectDialog(null); void load(); setSelectedProject(id); setDetailRevision((revision) => revision + 1); };
  const projectDeleted = () => { setProjectDialog(null); setSelectedProject(null); void load(); };
  const primaryAction = view === "IDEAS"
    ? { label: "记下想法", run: () => setIdeaDialog("new") }
    : view === "GOALS"
      ? { label: "创建目标", run: () => setGoalDialog("new") }
      : { label: "新建项目", run: () => setProjectDialog("new") };

  return <main className="modules-screen journey-screen">
    <header className="modules-header">
      <Button variant="ghost" onClick={() => navigate("/modules")}><ArrowLeft className="size-4" />返回模块选择</Button>
      <div className="flex items-center gap-2"><span className="hidden text-xs font-semibold tracking-[.12em] text-[var(--text-tertiary)] sm:inline">MY JOURNEY</span><ThemeSwitcher /></div>
    </header>
    <div className="journey-container">
      {selectedProject ? <ProjectDetail key={`${selectedProject}-${detailRevision}`} projectId={selectedProject} onBack={() => setSelectedProject(null)} onEdit={(project) => setProjectDialog(project)} /> : <>
        <section className="journey-heading">
          <div><p className="entry-eyebrow">02 · MY JOURNEY</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.045em] text-[var(--text)]">我的进程</h1><p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">从一个想法开始，推进项目，最终抵达长期目标。</p></div>
          <Button onClick={primaryAction.run}><Plus className="size-4" />{primaryAction.label}</Button>
        </section>
        <nav className="journey-tabs" aria-label="我的进程导航">{(["OVERVIEW", "PROJECTS", "IDEAS", "GOALS"] as View[]).map((item) => <button type="button" key={item} className={view === item ? "journey-tab-active" : ""} onClick={() => setView(item)}>{item === "OVERVIEW" ? "总览" : item === "PROJECTS" ? "项目" : item === "IDEAS" ? "灵感库" : "长期目标"}</button>)}</nav>
        {error ? <div className="journey-error">{error}</div> : null}
        {loading && !data.projects.length ? <p className="py-16 text-center text-sm text-[var(--text-tertiary)]">正在整理你的成长路径…</p> : null}
        {!loading && view === "OVERVIEW" ? <Overview data={data} onProject={setSelectedProject} onView={setView} onNewIdea={() => setIdeaDialog("new")} onNewGoal={() => setGoalDialog("new")} /> : null}
        {!loading && view === "PROJECTS" ? <ProjectsView projects={data.projects} onProject={setSelectedProject} onEdit={setProjectDialog} /> : null}
        {!loading && view === "IDEAS" ? <IdeasView ideas={data.ideas} onEdit={setIdeaDialog} onConvert={(idea) => void convertJourneyIdea(idea.id).then((id) => { void load(); setSelectedProject(id); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "转换失败"))} /> : null}
        {!loading && view === "GOALS" ? <GoalsView goals={data.goals} projects={data.projects} onEdit={setGoalDialog} onProject={setSelectedProject} /> : null}
      </>}
    </div>
    <ProjectDialog open={projectDialog !== null} project={projectDialog === "new" ? null : projectDialog} onClose={() => setProjectDialog(null)} onSaved={projectSaved} onDeleted={projectDeleted} />
    <IdeaDialog open={ideaDialog !== null} idea={ideaDialog === "new" ? null : ideaDialog} onClose={() => setIdeaDialog(null)} onSaved={saved} onDeleted={saved} />
    <GoalDialog open={goalDialog !== null} goal={goalDialog === "new" ? null : goalDialog} projects={data.projects} onClose={() => setGoalDialog(null)} onSaved={saved} />
  </main>;
}

function Overview({ data, onProject, onView, onNewIdea, onNewGoal }: { data: JourneyDashboard; onProject: (id: string) => void; onView: (view: View) => void; onNewIdea: () => void; onNewGoal: () => void }) {
  const active = data.projects.filter((project) => project.status === "ACTIVE");
  const completed = data.projects.filter((project) => project.status === "COMPLETED").length;
  const average = active.length ? Math.round(active.reduce((sum, project) => sum + project.progress, 0) / active.length) : 0;
  const nextProject = data.projects.filter((project) => project.targetDate && project.status !== "COMPLETED" && project.status !== "ARCHIVED").sort((a, b) => (a.targetDate ?? Infinity) - (b.targetDate ?? Infinity))[0];
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <div className="journey-stat-grid"><Stat icon={Rocket} label="进行中的项目" value={active.length} copy="保持专注，持续推进" /><Stat icon={CheckCircle2} label="已完成项目" value={completed} copy="你的阶段成果" /><Stat icon={Sparkles} label="平均完成度" value={`${average}%`} copy="按进行中项目计算" /><Stat icon={Compass} label="最近目标日期" value={nextProject ? displayDate(nextProject.targetDate).replace(/\d{4}年/, "") : "未设置"} copy={nextProject?.title ?? "为项目设置目标日期"} /></div>
    <SectionHeading title="正在推进" copy="你此刻最重要的项目" action={<button type="button" onClick={() => onView("PROJECTS")}>查看全部 <ArrowRight className="size-4" /></button>} />
    {active.length ? <div className="journey-project-grid">{active.slice(0, 4).map((project, index) => <ProjectCard key={project.id} project={project} index={index} onClick={() => onProject(project.id)} />)}</div> : <LargeEmpty icon={FolderKanban} title="还没有进行中的项目" copy="新建项目后，将状态设为“进行中”，它就会出现在这里。" />}
    <div className="journey-overview-bottom"><section className="content-card"><SectionHeading title="最近想法" copy={`${data.ideas.filter((idea) => idea.status !== "CONVERTED").length} 个等待探索的灵感`} action={<button type="button" onClick={onNewIdea}><Plus className="size-4" />记下想法</button>} />{data.ideas.slice(0, 3).map((idea) => <div className="journey-compact-row" key={idea.id}><Lightbulb className="size-4" /><div><p>{idea.title}</p><span>{ideaStatusLabels[idea.status]}</span></div></div>)}{!data.ideas.length ? <p className="journey-small-empty">灵感出现时，把它快速留在这里。</p> : null}</section><section className="content-card"><SectionHeading title="长期目标" copy="让今天的项目连接未来" action={<button type="button" onClick={onNewGoal}><Plus className="size-4" />创建目标</button>} />{data.goals.slice(0, 3).map((goal) => <div className="journey-goal-mini" key={goal.id}><div className="flex items-center justify-between gap-3"><p>{goal.title}</p><strong>{goal.progress}%</strong></div><JourneyProgress value={goal.progress} compact /></div>)}{!data.goals.length ? <p className="journey-small-empty">创建一个真正值得长期投入的方向。</p> : null}</section></div>
  </motion.div>;
}

function ProjectsView({ projects, onProject, onEdit }: { projects: JourneyProject[]; onProject: (id: string) => void; onEdit: (project: JourneyProject) => void }) {
  const current = projects.filter((project) => project.status !== "ARCHIVED"); const archived = projects.filter((project) => project.status === "ARCHIVED");
  return <div><SectionHeading title="所有项目" copy="工作项目与个人项目保持在同一个进程视图中" />{current.length ? <div className="journey-project-grid">{current.map((project, index) => <div className="relative" key={project.id}><ProjectCard project={project} index={index} onClick={() => onProject(project.id)} /><Button className="absolute right-3 top-3" size="icon" variant="ghost" aria-label="编辑项目" onClick={() => onEdit(project)}><Pencil className="size-4" /></Button></div>)}</div> : <LargeEmpty icon={FolderKanban} title="还没有项目" copy="从一个工作项目或个人项目开始。" />}{archived.length ? <><SectionHeading title="项目档案" copy={`${archived.length} 个已归档项目`} /><div className="journey-project-grid opacity-70">{archived.map((project, index) => <ProjectCard key={project.id} project={project} index={index} onClick={() => onProject(project.id)} />)}</div></> : null}</div>;
}

function IdeasView({ ideas, onEdit, onConvert }: { ideas: JourneyIdea[]; onEdit: (idea: JourneyIdea) => void; onConvert: (idea: JourneyIdea) => void }) {
  return <div><SectionHeading title="灵感库" copy="不要求每个想法立刻成为计划" />{ideas.length ? <div className="journey-idea-grid">{ideas.map((idea, index) => <motion.article className="journey-idea-card" key={idea.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .035 }}><div className="flex items-start justify-between gap-3"><span className="journey-idea-icon"><Lightbulb className="size-5" /></span><span className="journey-pill">{ideaStatusLabels[idea.status]}</span></div><h2>{idea.title}</h2><p>{idea.description || "尚未补充描述"}</p>{idea.tags ? <div className="journey-tags">{idea.tags.split(/[,，]/).filter(Boolean).map((tag) => <span key={tag}>{tag.trim()}</span>)}</div> : null}<div className="mt-5 flex items-center justify-between"><span className="journey-value" aria-label={`潜在价值 ${idea.valueScore} 分`}><span>潜在价值</span><span className="journey-value-dots">{[1, 2, 3, 4, 5].map((value) => <i key={value} className={value <= idea.valueScore ? "journey-value-active" : ""} />)}</span></span><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => onEdit(idea)}>编辑</Button>{idea.status !== "CONVERTED" ? <Button size="sm" variant="secondary" onClick={() => onConvert(idea)}>转为项目</Button> : null}</div></div></motion.article>)}</div> : <LargeEmpty icon={Lightbulb} title="灵感库还是空的" copy="先记下一句话，之后再决定是否把它变成项目。" />}</div>;
}

function GoalsView({ goals, projects, onEdit, onProject }: { goals: JourneyGoal[]; projects: JourneyProject[]; onEdit: (goal: JourneyGoal) => void; onProject: (id: string) => void }) {
  return <div><SectionHeading title="长期目标路线" copy="方向由你决定，进度也由你确认" />{goals.length ? <div className="journey-goals">{goals.map((goal, index) => { const linked = projects.filter((project) => goal.linkedProjectIds.includes(project.id)); return <motion.article className="journey-goal-card" key={goal.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .06 }}><div className="journey-goal-node"><Target className="size-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="journey-pill">{horizonLabels[goal.horizon]}</span><h2>{goal.title}</h2></div><Button size="sm" variant="ghost" onClick={() => onEdit(goal)}><Pencil className="size-4" />编辑</Button></div>{goal.reason ? <p className="journey-goal-reason">{goal.reason}</p> : null}<div className="mt-5 flex items-center gap-4"><div className="flex-1"><JourneyProgress value={goal.progress} /></div><strong className="text-lg text-[var(--text)]">{goal.progress}%</strong></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div className="journey-goal-note"><span>下一步</span><p>{goal.nextAction || "尚未填写"}</p></div><div className="journey-goal-note"><span>目标日期</span><p>{displayDate(goal.targetDate)}</p></div></div>{linked.length ? <div className="journey-linked-projects">{linked.map((project) => <button type="button" key={project.id} onClick={() => onProject(project.id)}><span style={{ background: project.accent }} />{project.title}<ArrowRight className="size-3.5" /></button>)}</div> : null}</div></motion.article>; })}</div> : <LargeEmpty icon={Target} title="还没有长期目标" copy="写下你真正想抵达的方向，再让项目成为通往它的路径。" />}</div>;
}

function ProjectCard({ project, index, onClick }: { project: JourneyProject; index: number; onClick: () => void }) {
  const reduced = useReducedMotion(); return <motion.button type="button" className="journey-project-card" onClick={onClick} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} whileHover={reduced ? undefined : { y: -4 }} transition={{ delay: index * .045, duration: .25 }} style={{ "--project-color": project.accent } as React.CSSProperties}><div className="journey-project-accent" /><div className="flex items-start justify-between gap-4"><span className="journey-pill">{project.projectType === "WORK" ? "工作项目" : "个人项目"}</span><span className="text-xs font-semibold text-[var(--text-tertiary)]">{projectStatusLabels[project.status]}</span></div><h2>{project.title}</h2><p>{project.summary || "尚未填写项目介绍"}</p><div className="mt-7 flex items-center justify-between text-xs text-[var(--text-secondary)]"><span>{project.currentGoal || "等待设置下一步"}</span><strong>{project.progress}%</strong></div><div className="mt-2"><JourneyProgress value={project.progress} color={project.accent} compact /></div><div className="mt-5 flex items-center justify-between text-xs text-[var(--text-tertiary)]"><span>{displayDate(project.targetDate)}</span><ArrowRight className="size-4" /></div></motion.button>;
}

function Stat({ icon: Icon, label, value, copy }: { icon: typeof Rocket; label: string; value: string | number; copy: string }) { return <motion.section className="journey-stat" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><span><Icon className="size-4" /></span><p>{label}</p><strong>{value}</strong><small>{copy}</small></motion.section>; }
function SectionHeading({ title, copy, action }: { title: string; copy: string; action?: React.ReactNode }) { return <div className="journey-section-heading"><div><h2>{title}</h2><p>{copy}</p></div>{action}</div>; }
function LargeEmpty({ icon: Icon, title, copy }: { icon: typeof BriefcaseBusiness; title: string; copy: string }) { return <div className="journey-large-empty"><span><Icon className="size-6" /></span><h2>{title}</h2><p>{copy}</p></div>; }
