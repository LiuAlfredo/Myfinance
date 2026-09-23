import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { KnowledgePage } from "./knowledge-page";
import { getNote, listNotes, listTasks, saveNote, setNoteState, type KnowledgeNote } from "./life-service";

vi.mock("./life-service", () => ({ getNote: vi.fn(), listNotes: vi.fn(), listTasks: vi.fn(), saveNote: vi.fn(), setNoteState: vi.fn(), deleteNotePermanently: vi.fn() }));
vi.mock("@/features/journey/journey-service", () => ({ getJourneyDashboard: vi.fn().mockResolvedValue({ projects: [] }) }));
const note: KnowledgeNote = { id: "note", title: "测试笔记", body: "初始正文", tags: "", isPinned: false, isArchived: false, deletedAt: null, projectId: null, projectTitle: null, taskId: null, taskTitle: null, createdAt: 1, updatedAt: 1 };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listNotes).mockResolvedValue([note]);
  vi.mocked(getNote).mockResolvedValue(note);
  vi.mocked(listTasks).mockResolvedValue([]);
  vi.mocked(saveNote).mockResolvedValue("note");
  vi.mocked(setNoteState).mockResolvedValue();
});

it("saves an edit even when the page immediately unmounts", async () => {
  const rendered = render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
  fireEvent.click(await screen.findByText("测试笔记"));
  fireEvent.change(await screen.findByDisplayValue("初始正文"), { target: { value: "离开前的修改" } });
  rendered.unmount();
  await waitFor(() => expect(saveNote).toHaveBeenCalledWith(expect.objectContaining({ body: "离开前的修改" }), "note"));
});

it("does not reset the editor when the selected list row is clicked again", async () => {
  render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
  fireEvent.click(await screen.findByText("测试笔记"));
  fireEvent.change(await screen.findByDisplayValue("初始正文"), { target: { value: "保留修改" } });
  fireEvent.click(screen.getByText("测试笔记"));
  expect(screen.getByDisplayValue("保留修改")).toBeTruthy();
  await waitFor(() => expect(saveNote).toHaveBeenCalled());
});

it("creates exactly one note under StrictMode from the quick-create link", async () => {
  render(<StrictMode><MemoryRouter initialEntries={["/knowledge?new=1&project=p"]}><KnowledgePage /></MemoryRouter></StrictMode>);
  await screen.findByDisplayValue("初始正文");
  expect(saveNote).toHaveBeenCalledTimes(1);
  expect(saveNote).toHaveBeenCalledWith(expect.objectContaining({ projectId: "p" }));
});

it("flushes a pending edit before archiving", async () => {
  let finish!: (id: string) => void;
  vi.mocked(saveNote).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
  fireEvent.click(await screen.findByText("测试笔记"));
  fireEvent.change(await screen.findByDisplayValue("初始正文"), { target: { value: "归档前修改" } });
  fireEvent.click(screen.getAllByRole("button", { name: "归档" }).at(-1)!);
  await waitFor(() => expect(saveNote).toHaveBeenCalled());
  expect(setNoteState).not.toHaveBeenCalled();
  finish("note");
  await waitFor(() => expect(setNoteState).toHaveBeenCalledWith("note", "ARCHIVE"));
});
