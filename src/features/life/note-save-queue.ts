import { saveNote, type KnowledgeNoteInput } from "./life-service";
// Keep failed drafts across page navigation. Never persist note bodies in browser storage.
const drafts = new Map<string, KnowledgeNoteInput>();
const queues = new Map<string, Promise<unknown>>();
export const pendingNote = (id: string) => drafts.get(id);
export const hasPendingNotes = () => drafts.size > 0;
export function persistNote(id: string, input: KnowledgeNoteInput): Promise<void> {
    drafts.set(id, input);
    const previous = queues.get(id) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
        await saveNote(input, id);
        if (drafts.get(id) === input)
            drafts.delete(id);
    });
    queues.set(id, next);
    void next.finally(() => {
        if (queues.get(id) === next)
            queues.delete(id);
    }).catch(() => undefined);
    return next;
}
export async function flushNote(id: string): Promise<void> {
    await queues.get(id)?.catch(() => undefined);
    const input = drafts.get(id);
    if (input)
        await persistNote(id, input);
}
export async function flushAllNotes(): Promise<void> {
    for (const id of drafts.keys())
        await flushNote(id);
}
if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", event => {
        if (hasPendingNotes()) {
            event.preventDefault();
            event.returnValue = "";
        }
    });
}
