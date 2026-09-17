import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { errorMessage, recordTimestamp, timeValue } from "./calendar-utils";
import { savePrivateCalendarEvent } from "./private-calendar-service";
import type { PrivateCalendarEvent } from "./types";

export function EventDialog({ event, day, onClose, onSaved }: {
  event: PrivateCalendarEvent | null;
  day: string;
  onClose: () => void;
  onSaved: (event: PrivateCalendarEvent) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const close = () => { if (!submitting.current) onClose(); };

  const submit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (submitting.current) return;
    const data = new FormData(submitEvent.currentTarget);
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      const recordDay = String(data.get("day"));
      const personName = String(data.get("personName")).trim();
      if (!personName) throw new Error("请输入姓名或别名，不能只输入空格");
      const occurredAt = recordTimestamp(recordDay, String(data.get("time")));
      const saved = await savePrivateCalendarEvent({
        occurredAt, dayKey: recordDay, personName,
        location: String(data.get("location") ?? ""), note: String(data.get("note") ?? ""),
      }, event?.id);
      onSaved(saved);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }} title={event ? "编辑私密记录" : "添加私密记录"} description="每条记录计为一次；内容加密保存在本地。">
      <form className="space-y-4" onSubmit={(e) => void submit(e)} aria-busy={saving}>
        <fieldset disabled={saving} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="form-label">日期<input name="day" type="date" min="1900-01-01" max="9999-12-31" required defaultValue={event?.dayKey ?? day} className="form-control" /></label>
            <label className="form-label">时间<input name="time" type="time" required defaultValue={event ? timeValue(event.occurredAt) : timeValue(Date.now())} className="form-control" /></label>
          </div>
          <label className="form-label">姓名<input name="personName" required maxLength={80} defaultValue={event?.personName ?? ""} className="form-control" placeholder="姓名或别名" autoComplete="off" /></label>
          <label className="form-label">地点<input name="location" maxLength={500} defaultValue={event?.location ?? ""} className="form-control" placeholder="可选" /></label>
          <label className="form-label">备注<textarea name="note" maxLength={5000} defaultValue={event?.note ?? ""} className="form-control" rows={3} placeholder="可选" /></label>
        </fieldset>
        {error ? <p role="alert" className="text-sm text-[var(--danger)]">{error}</p> : null}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={saving} onClick={close}>取消</Button><Button type="submit" disabled={saving}>{saving ? "正在保存…" : "保存记录"}</Button></div>
      </form>
    </Dialog>
  );
}
