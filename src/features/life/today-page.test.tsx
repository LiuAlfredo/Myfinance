import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { TodayPage } from "./today-page";
import { getToday, setTaskStatus } from "./life-service";

vi.mock("./life-service", async (original) => {
  const actual = await original<typeof import("./life-service")>();
  return { ...actual, getToday: vi.fn(), setTaskStatus: vi.fn(), pinTodayProject: vi.fn() };
});

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  vi.mocked(setTaskStatus).mockResolvedValue();
  vi.mocked(getToday).mockResolvedValue({
    tasks: [{ id:"task",title:"缴费",note:"",status:"TODO",priority:"IMPORTANT",plannedDay:"2026-09-23",dueAt:null,projectId:null,projectTitle:null,parentId:null,sourceItemId:null,completedAt:null,childCount:0,createdAt:1,updatedAt:1 }],
    events: [], overdueCount: 0,
    plannedExpenses: [{ id:"bill",title:"保险",amount:12345,plannedDate:Date.now() }],
    projects: [],
  });
});

it("completes a task through its owning service and refreshes the summary", async () => {
  render(<MemoryRouter><TodayPage /></MemoryRouter>);
  expect(await screen.findByText("缴费")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "完成" }));
  await waitFor(() => expect(setTaskStatus).toHaveBeenCalledWith("task", "DONE"));
  await waitFor(() => expect(getToday).toHaveBeenCalledTimes(2));
});

it("hides every displayed amount when privacy mode is enabled", async () => {
  render(<MemoryRouter><TodayPage /></MemoryRouter>);
  expect(await screen.findByText("¥123.45")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "隐藏金额" }));
  expect(screen.queryByText("¥123.45")).toBeNull();
  expect(screen.getByText("••••")).toBeTruthy();
  expect(localStorage.getItem("today:show-money")).toBe("false");
});
