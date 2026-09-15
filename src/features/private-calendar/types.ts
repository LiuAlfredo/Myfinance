export interface PrivateCalendarEvent {
  id: string;
  occurredAt: number;
  dayKey: string;
  personName: string;
  location: string;
  note: string;
}

export interface PrivateCalendarDayMark {
  dayKey: string;
  count: number;
}

export interface PrivateCalendarEventInput {
  occurredAt: number;
  dayKey: string;
  personName: string;
  location: string;
  note: string;
}
