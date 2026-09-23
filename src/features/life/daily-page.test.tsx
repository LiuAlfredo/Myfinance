import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { DailyPage } from "./daily-page";
import { listEvents, listTasks, saveEvent, saveTask, type DailyTask } from "./life-service";

vi.mock("./life-service", async original => ({ ...await original<typeof import("./life-service")>(), listEvents: vi.fn(), listTasks: vi.fn(), saveEvent: vi.fn(), saveTask: vi.fn() }));
vi.mock("@/features/journey/journey-service", () => ({ getJourneyDashboard: vi.fn().mockResolvedValue({ projects: [{ id: "project", title: "关联项目" }] }) }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listTasks).mockResolvedValue([]);
  vi.mocked(listEvents).mockResolvedValue([]);
  vi.mocked(saveTask).mockResolvedValue("task");
  vi.mocked(saveEvent).mockResolvedValue("event");
});

it("keeps the project association when creating from Journey", async () => {
  render(<MemoryRouter initialEntries={["/daily?project=project&new=task"]}><DailyPage /></MemoryRouter>);
  await screen.findByRole("option", { name: "关联项目" });
  fireEvent.change(screen.getByLabelText("标题"), { target: { value: "项目任务" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(saveTask).toHaveBeenCalledWith(expect.objectContaining({ projectId: "project" }), undefined));
});

it("opens an undated linked task directly", async () => {
  const task: DailyTask = { id: "linked", title: "未安排任务", note: "", status: "TODO", priority: "NORMAL", plannedDay: null, dueAt: null, projectId: null, projectTitle: null, parentId: null, sourceItemId: null, completedAt: null, childCount: 0, createdAt: 1, updatedAt: 1 };
  vi.mocked(listTasks).mockResolvedValue([task]);
  render(<MemoryRouter initialEntries={["/daily?task=linked"]}><DailyPage /></MemoryRouter>);
  expect(await screen.findByDisplayValue("未安排任务")).toBeTruthy();
});

it("prevents duplicate events and locates a saved event in a different month", async () => {
  let finish!: (id: string) => void;
  vi.mocked(saveEvent).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<MemoryRouter><DailyPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "新建日程" }));
  fireEvent.change(screen.getByLabelText("标题"), { target: { value: "明年的安排" } });
  fireEvent.change(screen.getByLabelText("日期"), { target: { value: "2028-02-15" } });
  const form = screen.getByLabelText("标题").closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(saveEvent).toHaveBeenCalledTimes(1);
  finish("event");
  await waitFor(() => expect(screen.getByLabelText("日程月份")).toHaveProperty("value", "2028-02"));
  await waitFor(() => expect(listEvents).toHaveBeenLastCalledWith("2028-02-01", "2028-02-29", expect.any(Number), expect.any(Number)));
});
