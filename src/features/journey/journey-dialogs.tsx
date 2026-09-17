import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { dateInputValue, timestampFromDate } from "@/features/journey/labels";
import {
  addJourneyLog, deleteJourneyGoal, deleteJourneyIdea, deleteJourneyLog,
  deleteJourneyMilestone, deleteJourneyProject, deleteJourneyProjectItem,
  saveJourneyGoal, saveJourneyIdea, saveJourneyMilestone, saveJourneyProject,
  saveJourneyProjectItem, updateJourneyLog,
} from "@/features/journey/journey-service";
import type {
  JourneyGoal, JourneyIdea, JourneyLog, JourneyMilestone, JourneyProject, JourneyProjectItem, LogKind,
} from "@/features/journey/types";


function ErrorText({ error }: { error: string | null }) { return error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null; }
function message(reason: unknown) { return reason instanceof Error ? reason.message : "保存失败"; }

export function ProjectDialog({ open, project, onClose, onSaved, onDeleted }: { open: boolean; project: JourneyProject | null; onClose: () => void; onSaved: (id: string) => void; onDeleted: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }} title={project ? "编辑项目" : "创建项目"} description="记录介绍、目标、完成度和当前阶段。">
    <form className="space-y-4" onSubmit={(event: FormEvent<HTMLFormElement>) => {
      event.preventDefault(); setError(null); const data = new FormData(event.currentTarget);
      void saveJourneyProject({ title: String(data.get("title")), projectType: String(data.get("projectType")) as "WORK" | "PERSONAL", summary: String(data.get("summary") ?? ""), description: String(data.get("description") ?? ""), status: String(data.get("status")) as JourneyProject["status"], progress: Number(data.get("progress")), currentGoal: String(data.get("currentGoal") ?? ""), targetDate: timestampFromDate(data.get("targetDate")), accent: String(data.get("accent")) }, project?.id).then((saved) => onSaved(saved.id)).catch((reason: unknown) => setError(message(reason)));
    }}>
      <label className="form-label">项目名称<input className="form-control" name="title" required maxLength={120} defaultValue={project?.title ?? ""} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="form-label">类型<select className="form-control" name="projectType" defaultValue={project?.projectType ?? "WORK"}><option value="WORK">工作项目</option><option value="PERSONAL">个人项目</option></select></label>
        <label className="form-label">状态<select className="form-control" name="status" defaultValue={project?.status ?? "PLANNING"}><option value="PLANNING">计划中</option><option value="ACTIVE">进行中</option><option value="PAUSED">暂停</option><option value="COMPLETED">已完成</option><option value="ARCHIVED">已归档</option></select></label>
      </div>
      <label className="form-label">一句话介绍<input className="form-control" name="summary" defaultValue={project?.summary ?? ""} placeholder="这个项目要解决什么？" /></label>
      <label className="form-label">详细介绍<textarea className="form-control" name="description" rows={3} defaultValue={project?.description ?? ""} /></label>
      <label className="form-label">当前目标<input className="form-control" name="currentGoal" defaultValue={project?.currentGoal ?? ""} placeholder="下一步最重要的事情" /></label>
      <div className="grid grid-cols-[1fr_1fr_72px] gap-3">
        <label className="form-label">完成度<input className="form-control" name="progress" type="number" min={0} max={100} defaultValue={project?.progress ?? 0} /></label>
        <label className="form-label">目标日期<input className="form-control" name="targetDate" type="date" defaultValue={dateInputValue(project?.targetDate ?? null)} /></label>
        <label className="form-label">主题色<input className="form-control h-10 p-1" name="accent" type="color" defaultValue={project?.accent ?? "#5b6ee1"} /></label>
      </div>
      <ErrorText error={error} /><div className="flex items-center gap-2">{project ? <Button className="bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white" type="button" variant="ghost" onClick={() => { if (window.confirm(`确定删除项目“${project.title}”吗？项目中的功能、里程碑和记录也会一起删除，此操作无法撤销。`)) void deleteJourneyProject(project.id).then(onDeleted).catch((reason: unknown) => setError(message(reason))); }}>删除项目</Button> : null}<div className="ml-auto flex gap-2"><Button type="button" variant="secondary" onClick={onClose}>取消</Button><Button type="submit">保存项目</Button></div></div>
    </form>
  </Dialog>;
}

export function IdeaDialog({ open, idea, onClose, onSaved, onDeleted }: { open: boolean; idea: JourneyIdea | null; onClose: () => void; onSaved: () => void; onDeleted: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }} title={idea ? "编辑想法" : "记下想法"} description="先快速记录，成熟后再转为项目。">
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void saveJourneyIdea({ title: String(data.get("title")), description: String(data.get("description") ?? ""), status: String(data.get("status")) as JourneyIdea["status"], tags: String(data.get("tags") ?? ""), valueScore: Number(data.get("valueScore")) }, idea?.id).then(onSaved).catch((reason: unknown) => setError(message(reason))); }}>
      <label className="form-label">标题<input className="form-control" name="title" required defaultValue={idea?.title ?? ""} /></label>
      <label className="form-label">描述<textarea className="form-control" name="description" rows={4} defaultValue={idea?.description ?? ""} /></label>
      <div className="grid grid-cols-2 gap-3"><label className="form-label">状态<select className="form-control" name="status" defaultValue={idea?.status ?? "NEW"}><option value="NEW">刚刚想到</option><option value="RESEARCH">值得研究</option><option value="WAITING">等待时机</option>{idea?.status === "CONVERTED" ? <option value="CONVERTED">已转为项目</option> : null}<option value="DROPPED">暂时放弃</option></select></label><label className="form-label">潜在价值<select className="form-control" name="valueScore" defaultValue={idea?.valueScore ?? 3}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label></div>
      <label className="form-label">标签<input className="form-control" name="tags" defaultValue={idea?.tags ?? ""} placeholder="用逗号分隔" /></label>
      <ErrorText error={error} /><div className="flex items-center gap-2">{idea ? <Button className="bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white" type="button" variant="ghost" onClick={() => { if (window.confirm(`确定删除想法“${idea.title}”吗？此操作无法撤销。`)) void deleteJourneyIdea(idea.id).then(onDeleted).catch((reason: unknown) => setError(message(reason))); }}>删除想法</Button> : null}<div className="ml-auto flex gap-2"><Button type="button" variant="secondary" onClick={onClose}>取消</Button><Button type="submit">保存想法</Button></div></div>
    </form>
  </Dialog>;
}

export function GoalDialog({ open, goal, projects, onClose, onSaved, onDeleted }: { open: boolean; goal: JourneyGoal | null; projects: JourneyProject[]; onClose: () => void; onSaved: () => void; onDeleted?: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }} title={goal ? "编辑长期目标" : "创建长期目标"} description="把目标与正在推进的项目连接起来。">
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void saveJourneyGoal({ title: String(data.get("title")), reason: String(data.get("reason") ?? ""), horizon: String(data.get("horizon")) as JourneyGoal["horizon"], progress: Number(data.get("progress")), targetDate: timestampFromDate(data.get("targetDate")), nextAction: String(data.get("nextAction") ?? ""), linkedProjectIds: data.getAll("linkedProjects").map(String), status: String(data.get("status")) as JourneyGoal["status"] }, goal?.id).then(onSaved).catch((reason: unknown) => setError(message(reason))); }}>
      <label className="form-label">目标名称<input className="form-control" name="title" required defaultValue={goal?.title ?? ""} /></label>
      <label className="form-label">为什么要实现<textarea className="form-control" name="reason" rows={3} defaultValue={goal?.reason ?? ""} /></label>
      <div className="grid grid-cols-2 gap-3"><label className="form-label">时间范围<select className="form-control" name="horizon" defaultValue={goal?.horizon ?? "YEAR"}><option value="YEAR">一年目标</option><option value="THREE_YEARS">三年目标</option><option value="FIVE_YEARS">五年目标</option><option value="LIFETIME">长期愿景</option></select></label><label className="form-label">状态<select className="form-control" name="status" defaultValue={goal?.status ?? "ACTIVE"}><option value="ACTIVE">推进中</option><option value="PAUSED">暂停</option><option value="ACHIEVED">已实现</option></select></label></div>
      <div className="grid grid-cols-2 gap-3"><label className="form-label">完成度<input className="form-control" name="progress" type="number" min={0} max={100} defaultValue={goal?.progress ?? 0} /></label><label className="form-label">目标日期<input className="form-control" name="targetDate" type="date" defaultValue={dateInputValue(goal?.targetDate ?? null)} /></label></div>
      <label className="form-label">下一步行动<input className="form-control" name="nextAction" defaultValue={goal?.nextAction ?? ""} /></label>
      {projects.length ? <fieldset><legend className="form-label">关联项目</legend><div className="mt-2 grid max-h-28 grid-cols-2 gap-2 overflow-y-auto rounded-xl bg-[var(--surface-muted)] p-3">{projects.filter((project) => project.status !== "ARCHIVED" || goal?.linkedProjectIds.includes(project.id)).map((project) => <label key={project.id} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" name="linkedProjects" value={project.id} defaultChecked={goal?.linkedProjectIds.includes(project.id)} /><span>{project.title}</span>{project.status === "ARCHIVED" ? <span className="text-xs text-[var(--text-tertiary)]">(已归档)</span> : null}</label>)}</div></fieldset> : null}
      <ErrorText error={error} />
      <div className="flex items-center gap-2">
        {goal ? <Button className="bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white" type="button" variant="ghost" onClick={() => { if (window.confirm(`确定删除目标“${goal.title}”吗？此操作无法撤销。`)) void deleteJourneyGoal(goal.id).then(onDeleted ?? onSaved).catch((reason: unknown) => setError(message(reason))); }}>删除目标</Button> : null}
        <div className="ml-auto flex gap-2"><Button type="button" variant="secondary" onClick={onClose}>取消</Button><Button type="submit">保存目标</Button></div>
      </div>
    </form>
  </Dialog>;
}

export function ItemDialog({ open, projectId, item, onClose, onSaved, onDeleted }: { open: boolean; projectId: string; item: JourneyProjectItem | null; onClose: () => void; onSaved: () => void; onDeleted?: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }} title={item ? "编辑功能" : "添加功能或任务"}>
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void saveJourneyProjectItem({ projectId, title: String(data.get("title")), description: String(data.get("description") ?? ""), status: String(data.get("status")) as JourneyProjectItem["status"], progress: Number(data.get("progress")), priority: String(data.get("priority")) as JourneyProjectItem["priority"], targetDate: timestampFromDate(data.get("targetDate")), sortOrder: item?.sortOrder ?? 0 }, item?.id).then(onSaved).catch((reason: unknown) => setError(message(reason))); }}>
      <label className="form-label">名称<input className="form-control" name="title" required defaultValue={item?.title ?? ""} /></label><label className="form-label">说明<textarea className="form-control" name="description" rows={3} defaultValue={item?.description ?? ""} /></label>
      <div className="grid grid-cols-3 gap-3"><label className="form-label">状态<select className="form-control" name="status" defaultValue={item?.status ?? "TODO"}><option value="TODO">待开始</option><option value="ACTIVE">进行中</option><option value="DONE">已完成</option><option value="BLOCKED">受阻</option></select></label><label className="form-label">优先级<select className="form-control" name="priority" defaultValue={item?.priority ?? "MEDIUM"}><option value="LOW">低</option><option value="MEDIUM">中</option><option value="HIGH">高</option></select></label><label className="form-label">完成度<input className="form-control" name="progress" type="number" min={0} max={100} defaultValue={item?.progress ?? 0} /></label></div>
      <label className="form-label">目标日期<input className="form-control" name="targetDate" type="date" defaultValue={dateInputValue(item?.targetDate ?? null)} /></label><ErrorText error={error} />
      <div className="flex items-center gap-2">
        {item ? <Button className="bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white" type="button" variant="ghost" onClick={() => { if (window.confirm(`确定删除任务“${item.title}”吗？`)) void deleteJourneyProjectItem(item.id).then(onDeleted ?? onSaved).catch((reason: unknown) => setError(message(reason))); }}>删除任务</Button> : null}
        <div className="ml-auto flex gap-2"><Button type="button" variant="secondary" onClick={onClose}>取消</Button><Button type="submit">保存</Button></div>
      </div>
    </form>
  </Dialog>;
}

export function MilestoneDialog({ open, projectId, milestone, onClose, onSaved, onDeleted }: { open: boolean; projectId: string; milestone: JourneyMilestone | null; onClose: () => void; onSaved: () => void; onDeleted?: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }} title={milestone ? "编辑里程碑" : "添加里程碑"}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void saveJourneyMilestone({ projectId, title: String(data.get("title")), targetDate: timestampFromDate(data.get("targetDate")), isCompleted: milestone?.isCompleted ?? false, sortOrder: milestone?.sortOrder ?? 0 }, milestone?.id).then(onSaved).catch((reason: unknown) => setError(message(reason))); }}><label className="form-label">里程碑名称<input className="form-control" name="title" required defaultValue={milestone?.title ?? ""} /></label><label className="form-label">目标日期<input className="form-control" name="targetDate" type="date" defaultValue={dateInputValue(milestone?.targetDate ?? null)} /></label><ErrorText error={error} />
    <div className="flex items-center gap-2">
      {milestone ? <Button className="bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white" type="button" variant="ghost" onClick={() => { if (window.confirm(`确定删除里程碑“${milestone.title}”吗？`)) void deleteJourneyMilestone(milestone.id).then(onDeleted ?? onSaved).catch((reason: unknown) => setError(message(reason))); }}>删除里程碑</Button> : null}
      <div className="ml-auto flex gap-2"><Button type="button" variant="secondary" onClick={onClose}>取消</Button><Button type="submit">保存</Button></div>
    </div>
  </form></Dialog>;
}

export function LogDialog({ open, projectId, log, onClose, onSaved, onDeleted }: { open: boolean; projectId: string; log?: JourneyLog | null; onClose: () => void; onSaved: () => void; onDeleted?: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }} title={log ? "编辑项目记录" : "添加项目记录"}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const kind = String(data.get("kind")) as LogKind; const content = String(data.get("content")); const action = log ? updateJourneyLog(log.id, kind, content) : addJourneyLog(projectId, kind, content); void action.then(onSaved).catch((reason: unknown) => setError(message(reason))); }}><label className="form-label">类型<select className="form-control" name="kind" defaultValue={log?.kind ?? "NOTE"}><option value="NOTE">项目记录</option><option value="DECISION">重要决定</option><option value="PROBLEM">当前困难</option><option value="DISCOVERY">新发现</option><option value="SUMMARY">阶段总结</option></select></label><label className="form-label">内容<textarea className="form-control" name="content" rows={5} required maxLength={2000} defaultValue={log?.content ?? ""} /></label><ErrorText error={error} />
    <div className="flex items-center gap-2">
      {log ? <Button className="bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white" type="button" variant="ghost" onClick={() => { if (window.confirm("确定删除这条项目记录吗？")) void deleteJourneyLog(log.id).then(onDeleted ?? onSaved).catch((reason: unknown) => setError(message(reason))); }}>删除记录</Button> : null}
      <div className="ml-auto flex gap-2"><Button type="button" variant="secondary" onClick={onClose}>取消</Button><Button type="submit">保存记录</Button></div>
    </div>
  </form></Dialog>;
}
