import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordTimestamp } from "./calendar-utils";
import { PrivateCalendarPage } from "./private-calendar-page";
import { deletePrivateCalendarEvent, getPrivateCalendarDay, getPrivateCalendarMonth, getPrivateCalendarStatistics, savePrivateCalendarEvent } from "./private-calendar-service";
import type { PrivateCalendarEvent, PrivateCalendarYearStats } from "./types";
import { usePrivateCalendarData } from "./use-private-calendar-data";

vi.mock("./private-calendar-service");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function record(day: string, id = "record-1"): PrivateCalendarEvent {
  return { id, dayKey: day, occurredAt: recordTimestamp(day, "12:00"), personName: "测试别名", location: "测试地点", note: "" };
}

function yearStats(year: number, count: number): PrivateCalendarYearStats {
  return { year, total: count, activeDays: count ? 1 : 0, months: [count, ...Array<number>(11).fill(0)], firstDay: `${year}-01-01`, lastDay: `${year}-01-01` };
}

function renderPage() { return render(<MemoryRouter><PrivateCalendarPage /></MemoryRouter>); }

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getPrivateCalendarMonth).mockResolvedValue([]);
  vi.mocked(getPrivateCalendarDay).mockResolvedValue([]);
  vi.mocked(getPrivateCalendarStatistics).mockResolvedValue([]);
  vi.mocked(deletePrivateCalendarEvent).mockResolvedValue();
});

describe("private calendar navigation", () => {
  it("never displays an old day when requests complete out of order", async () => {
    const older = deferred<PrivateCalendarEvent[]>();
    const newer = deferred<PrivateCalendarEvent[]>();
    vi.mocked(getPrivateCalendarDay).mockImplementation((day) => day === "2024-01-01" ? older.promise : newer.promise);
    const { result, rerender } = renderHook(({ day }) => usePrivateCalendarData(day, 0, true), { initialProps: { day: "2024-01-01" } });
    rerender({ day: "2024-01-02" });
    expect(result.current.day.data).toBeNull();
    await act(async () => { newer.resolve([record("2024-01-02")]); });
    expect(result.current.day.data?.[0].dayKey).toBe("2024-01-02");
    await act(async () => { older.resolve([record("2024-01-01")]); });
    expect(result.current.day.data?.[0].dayKey).toBe("2024-01-02");
  });

  it("clears old records on a failed date request and can retry", async () => {
    vi.mocked(getPrivateCalendarDay).mockResolvedValueOnce([record("2024-01-01")]).mockRejectedValueOnce(new Error("读取失败")).mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(({ day, revision }) => usePrivateCalendarData(day, revision, true), { initialProps: { day: "2024-01-01", revision: 0 } });
    await waitFor(() => expect(result.current.day.data).toHaveLength(1));
    rerender({ day: "2024-01-02", revision: 0 });
    await waitFor(() => expect(result.current.day.error).toBe("读取失败"));
    expect(result.current.day.data).toBeNull();
    rerender({ day: "2024-01-02", revision: 1 });
    await waitFor(() => expect(result.current.day.data).toEqual([]));
    expect(result.current.day.error).toBeNull();
  });

  it("opens a historical year and drills down into its month", async () => {
    vi.mocked(getPrivateCalendarStatistics).mockResolvedValue([yearStats(2024, 2)]);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "历史数据" }));
    fireEvent.click(await screen.findByRole("button", { name: /2024年.*2次/ }));
    expect(await screen.findByText("2024年性爱次数")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "2024年1月，2次，查看记录" }));
    expect(screen.getByRole("heading", { name: "2024年1月1日" })).toBeTruthy();
    await waitFor(() => expect(getPrivateCalendarDay).toHaveBeenLastCalledWith("2024-01-01"));
  });

  it("shows zero for a year without records and hides statistics in privacy mode", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "年度统计" }));
    expect(await screen.findByText("这一年暂无记录。可以点击月份，查看或补记历史记录。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "关闭对话框" }));
    fireEvent.click(screen.getByRole("button", { name: "隐私模式" }));
    expect((screen.getByRole("button", { name: "年度统计" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("隐私模式已隐藏记录和统计")).toBeTruthy();
  });
});

describe("private calendar mutations", () => {
  it("submits once while saving, then locates the saved historical date", async () => {
    const save = deferred<PrivateCalendarEvent>();
    vi.mocked(savePrivateCalendarEvent).mockReturnValue(save.promise);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "添加记录" }));
    fireEvent.change(screen.getByLabelText("日期"), { target: { value: "2024-02-29" } });
    fireEvent.change(screen.getByLabelText("姓名"), { target: { value: "测试别名" } });
    const button = screen.getByRole("button", { name: "保存记录" });
    const form = button.closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(savePrivateCalendarEvent).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "正在保存…" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { save.resolve(record("2024-02-29")); });
    expect(screen.getByRole("heading", { name: "2024年2月29日" })).toBeTruthy();
    expect(screen.getByText("记录已保存，已定位到 2024-02-29。")).toBeTruthy();
    await waitFor(() => expect(getPrivateCalendarStatistics).toHaveBeenCalledTimes(2));
  });

  it("preserves form input after a failure and permits retry", async () => {
    vi.mocked(savePrivateCalendarEvent).mockRejectedValueOnce(new Error("保存失败，请重试")).mockResolvedValueOnce(record("2024-01-01"));
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "添加记录" }));
    fireEvent.change(screen.getByLabelText("姓名"), { target: { value: "测试别名" } });
    fireEvent.click(screen.getByRole("button", { name: "保存记录" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "保存失败，请重试");
    expect((screen.getByLabelText("姓名") as HTMLInputElement).value).toBe("测试别名");
    fireEvent.click(screen.getByRole("button", { name: "保存记录" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(savePrivateCalendarEvent).toHaveBeenCalledTimes(2);
  });

  it("moves an edited record to another year and refreshes statistics", async () => {
    const original = record("2024-01-01");
    vi.mocked(getPrivateCalendarDay).mockResolvedValue([original]);
    vi.mocked(savePrivateCalendarEvent).mockResolvedValue(record("2025-01-01"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "编辑记录" }));
    expect((screen.getByLabelText("姓名") as HTMLInputElement).value).toBe(original.personName);
    fireEvent.change(screen.getByLabelText("日期"), { target: { value: "2025-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "保存记录" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "2025年1月1日" })).toBeTruthy());
    expect(savePrivateCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({ dayKey: "2025-01-01" }), original.id);
    await waitFor(() => expect(getPrivateCalendarStatistics).toHaveBeenCalledTimes(2));
  });

  it("requires confirmation and removes the record only after successful deletion", async () => {
    vi.mocked(getPrivateCalendarDay).mockResolvedValue([record("2024-01-01")]);
    const deletion = deferred<void>();
    vi.mocked(deletePrivateCalendarEvent).mockReturnValue(deletion.promise);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "删除记录" }));
    expect(deletePrivateCalendarEvent).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "确认删除" }));
    expect(deletePrivateCalendarEvent).toHaveBeenCalledTimes(1);
    vi.mocked(getPrivateCalendarDay).mockResolvedValue([]);
    await act(async () => { deletion.resolve(); });
    await waitFor(() => expect(screen.queryByText("测试别名")).toBeNull());
    expect(screen.getByText("记录已删除。")).toBeTruthy();
  });
});
