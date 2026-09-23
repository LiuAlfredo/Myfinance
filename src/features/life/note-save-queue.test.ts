import { expect, it, vi } from "vitest";
import { saveNote, type KnowledgeNoteInput } from "./life-service";
import { flushNote, pendingNote, persistNote } from "./note-save-queue";

vi.mock("./life-service", () => ({ saveNote: vi.fn() }));
const input: KnowledgeNoteInput = { title: "笔记", body: "旧内容", tags: "", isPinned: false, isArchived: false, projectId: null, taskId: null };

it("serializes writes so the newest edit cannot be overwritten by an older request", async () => {
  let release!: (id: string) => void;
  vi.mocked(saveNote).mockReset().mockImplementationOnce(() => new Promise(resolve => { release = resolve; })).mockResolvedValue("ordered");
  const first = persistNote("ordered", input);
  const latest = { ...input, body: "最新内容" };
  const second = persistNote("ordered", latest);
  await vi.waitFor(() => expect(saveNote).toHaveBeenCalledTimes(1));
  expect(pendingNote("ordered")).toEqual(latest);
  release("ordered");
  await Promise.all([first, second]);
  expect(saveNote).toHaveBeenLastCalledWith(latest, "ordered");
  expect(pendingNote("ordered")).toBeUndefined();
});

it("retains a failed draft and flush retries it before a state change", async () => {
  vi.mocked(saveNote).mockReset().mockRejectedValueOnce(new Error("数据库忙")).mockResolvedValue("retry");
  await expect(persistNote("retry", input)).rejects.toThrow("数据库忙");
  expect(pendingNote("retry")).toEqual(input);
  await flushNote("retry");
  expect(saveNote).toHaveBeenCalledTimes(2);
  expect(pendingNote("retry")).toBeUndefined();
});
