import { act, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NoteSaveGuard } from "./note-save-guard";
import { flushAllNotes, hasPendingNotes } from "./note-save-queue";

const native = vi.hoisted(() => ({ close: vi.fn(), onCloseRequested: vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => native }));
vi.mock("./note-save-queue", () => ({ flushAllNotes: vi.fn(), hasPendingNotes: vi.fn() }));
afterEach(() => { Reflect.deleteProperty(window, "__TAURI_INTERNALS__"); vi.restoreAllMocks(); });

it("prevents native close until pending notes finish saving", async () => {
  Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {}, configurable: true });
  let handler!: (event: { preventDefault: () => void }) => Promise<void>;
  let resolve!: () => void;
  native.onCloseRequested.mockImplementation(callback => { handler = callback; return Promise.resolve(vi.fn()); });
  native.close.mockResolvedValue(undefined);
  vi.mocked(hasPendingNotes).mockReturnValue(true);
  vi.mocked(flushAllNotes).mockImplementation(() => new Promise(done => { resolve = done; }));
  render(<NoteSaveGuard />);
  const event = { preventDefault: vi.fn() };
  let closing!: Promise<void>;
  act(() => { closing = handler(event); });
  expect(event.preventDefault).toHaveBeenCalled();
  expect(native.close).not.toHaveBeenCalled();
  await act(async () => { resolve(); await closing; });
  await waitFor(() => expect(native.close).toHaveBeenCalledOnce());
});
