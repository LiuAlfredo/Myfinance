import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

Object.defineProperty(window, "matchMedia", { writable: true, value: (query: string) => ({
  matches: query.includes("prefers-reduced-motion"), media: query, onchange: null,
  addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
}) });

afterEach(() => { cleanup(); vi.useRealTimers(); });
