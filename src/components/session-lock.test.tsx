import { act, fireEvent, render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SessionLock } from "./session-lock";
import { useAuthStore } from "@/stores/auth-store";

it("locks after inactivity and extends the deadline only on activity", async () => {
  vi.useFakeTimers();
  useAuthStore.setState({ isAuthenticated: true });
  render(<SessionLock />);
  await act(async () => { vi.advanceTimersByTime(14 * 60 * 1000); });
  expect(useAuthStore.getState().isAuthenticated).toBe(true);
  fireEvent.keyDown(window, { key: "ArrowRight" });
  await act(async () => { vi.advanceTimersByTime(14 * 60 * 1000); });
  expect(useAuthStore.getState().isAuthenticated).toBe(true);
  await act(async () => { vi.advanceTimersByTime(60 * 1000); });
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
});
