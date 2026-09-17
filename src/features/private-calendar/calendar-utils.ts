export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDayKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function timeValue(timestamp: number) {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "操作失败，请重试";
}

export function recordTimestamp(day: string, time: string) {
  const date = new Date(`${day}T${time}:00`);
  if (!Number.isFinite(date.getTime()) || dayKey(date) !== day || timeValue(date.getTime()) !== time) {
    throw new Error("日期或时间无效，请检查输入（夏令时切换可能使部分时间不存在）");
  }
  return date.getTime();
}
