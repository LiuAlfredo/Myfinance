import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "./calendar-utils";
import { getPrivateCalendarDay, getPrivateCalendarMonth, getPrivateCalendarStatistics } from "./private-calendar-service";

function usePrivateQuery<T>(key: string, load: () => Promise<T>, enabled: boolean) {
  const [result, setResult] = useState<{ key: string; data: T | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!enabled) { setResult(null); return; }
    let cancelled = false;
    void load().then(
      (data) => { if (!cancelled) setResult({ key, data, error: null }); },
      (reason: unknown) => { if (!cancelled) setResult({ key, data: null, error: errorMessage(reason) }); },
    );
    return () => { cancelled = true; };
  }, [key, load, enabled]);
  const current = enabled && result?.key === key ? result : null;
  return { data: current?.data ?? null, error: current?.error ?? null, loading: enabled && !current };
}

export function usePrivateCalendarData(selectedDay: string, revision: number, visible: boolean) {
  const [year, month] = selectedDay.split("-").map(Number);
  const loadMonth = useCallback(() => getPrivateCalendarMonth(year, month), [year, month]);
  const loadDay = useCallback(() => getPrivateCalendarDay(selectedDay), [selectedDay]);
  const monthResult = usePrivateQuery(`${year}-${month}:${revision}`, loadMonth, visible);
  const dayResult = usePrivateQuery(`${selectedDay}:${revision}`, loadDay, visible);
  const statistics = usePrivateQuery(`statistics:${revision}`, getPrivateCalendarStatistics, visible);
  return { month: monthResult, day: dayResult, statistics };
}
