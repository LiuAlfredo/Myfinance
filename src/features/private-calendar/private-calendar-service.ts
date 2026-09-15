import { invoke } from "@tauri-apps/api/core";
import type {
  PrivateCalendarDayMark,
  PrivateCalendarEvent,
  PrivateCalendarEventInput,
} from "@/features/private-calendar/types";

function requireDesktop() {
  if (!("__TAURI_INTERNALS__" in window)) {
    throw new Error("私密日历只能在 My Personal Affairs 桌面应用中使用");
  }
}

export async function getPrivateCalendarMonth(year: number, month: number): Promise<PrivateCalendarDayMark[]> {
  requireDesktop();
  return invoke("get_private_calendar_month", { year, month });
}

export async function getPrivateCalendarDay(dayKey: string): Promise<PrivateCalendarEvent[]> {
  requireDesktop();
  return invoke("get_private_calendar_day", { dayKey });
}

export async function savePrivateCalendarEvent(input: PrivateCalendarEventInput, eventId?: string): Promise<PrivateCalendarEvent> {
  requireDesktop();
  return invoke("save_private_calendar_event", { input, idOpt: eventId });
}

export async function deletePrivateCalendarEvent(eventId: string): Promise<void> {
  requireDesktop();
  await invoke("delete_private_calendar_event", { id: eventId });
}
