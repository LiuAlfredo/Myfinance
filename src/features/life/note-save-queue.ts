import {
  saveNote,
  noteRevision,
  type KnowledgeNoteInput,
} from "./life-service";
import { stageDraft } from "./workspace-service";
// Keep failed drafts across page navigation. Never persist note bodies in browser storage.
const drafts = new Map<string, KnowledgeNoteInput>();
const queues = new Map<string, Promise<unknown>>();
const scheduled = new Map<string, { timer: ReturnType<typeof setTimeout>; waiters: Array<{ resolve: () => void; reject: (reason: unknown) => void }> }>();
export const pendingNote = (id: string) => drafts.get(id);
export const hasPendingNotes = () => drafts.size > 0;
export function persistNote(
  id: string,
  input: KnowledgeNoteInput,
): Promise<void> {
  drafts.set(id, input);
  const previous = queues.get(id) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      await stageDraft(id, { ...input, expectedRevision: noteRevision(id) });
      if (drafts.get(id) !== input) return;
      await saveNote(input, id);
      if (drafts.get(id) === input) drafts.delete(id);
    });
  queues.set(id, next);
  void next
    .finally(() => {
      if (queues.get(id) === next) queues.delete(id);
    })
    .catch(() => undefined);
  return next;
}
export function scheduleNote(id: string, input: KnowledgeNoteInput, delay = 300): Promise<void> {
  drafts.set(id, input);
  const existing=scheduled.get(id);
  if(existing) clearTimeout(existing.timer);
  return new Promise<void>((resolve,reject)=>{
    const waiters=[...(existing?.waiters??[]),{resolve,reject}];
    const timer=setTimeout(()=>{
      scheduled.delete(id);
      const latest=drafts.get(id);
      if(!latest){waiters.forEach((waiter)=>waiter.resolve());return;}
      void persistNote(id,latest).then(()=>waiters.forEach((waiter)=>waiter.resolve()),(reason)=>waiters.forEach((waiter)=>waiter.reject(reason)));
    },delay);
    scheduled.set(id,{timer,waiters});
  });
}
export async function flushNote(id: string): Promise<void> {
  const delayed=scheduled.get(id);
  if(delayed){clearTimeout(delayed.timer);scheduled.delete(id);const input=drafts.get(id);try{if(input)await persistNote(id,input);delayed.waiters.forEach((waiter)=>waiter.resolve());}catch(reason){delayed.waiters.forEach((waiter)=>waiter.reject(reason));throw reason;}}
  await queues.get(id)?.catch(() => undefined);
  const input = drafts.get(id);
  if (input) await persistNote(id, input);
}
export async function flushAllNotes(): Promise<void> {
  for (const id of drafts.keys()) await flushNote(id);
}
export async function discardPendingNote(id: string): Promise<void> {
  const delayed=scheduled.get(id);
  if(delayed){clearTimeout(delayed.timer);scheduled.delete(id);delayed.waiters.forEach((waiter)=>waiter.resolve());}
  await queues.get(id)?.catch(() => undefined);
  drafts.delete(id);
}
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (event) => {
    if (hasPendingNotes()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
}
