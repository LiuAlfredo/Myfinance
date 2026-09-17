import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "@/stores/auth-store";
import type {
  PrivateCalendarDayMark,
  PrivateCalendarEvent,
  PrivateCalendarEventInput,
  PrivateCalendarYearStats,
} from "@/features/private-calendar/types";

function requireDesktop() {
  if (!("__TAURI_INTERNALS__" in window)) {
    throw new Error("私密日历只能在 My Personal Affairs 桌面应用中使用");
  }
}

async function privateInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  requireDesktop();
  try {
    return await invoke<T>(command, args);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "私密日历操作失败，请重试";
    if (message.includes("私密数据已锁定")) await useAuthStore.getState().logout();
    throw new Error(message);
  }
}

export async function getPrivateCalendarMonth(year: number, month: number): Promise<PrivateCalendarDayMark[]> {
  return privateInvoke("get_private_calendar_month", { year, month });
}

export async function getPrivateCalendarDay(dayKey: string): Promise<PrivateCalendarEvent[]> {
  return privateInvoke("get_private_calendar_day", { dayKey });
}

export async function savePrivateCalendarEvent(input: PrivateCalendarEventInput, eventId?: string): Promise<PrivateCalendarEvent> {
  return privateInvoke("save_private_calendar_event", { input, idOpt: eventId });
}

export async function deletePrivateCalendarEvent(eventId: string): Promise<void> {
  await privateInvoke("delete_private_calendar_event", { id: eventId });
}

export async function getPrivateCalendarStatistics(): Promise<PrivateCalendarYearStats[]> {
  return privateInvoke("get_private_calendar_statistics");
}
