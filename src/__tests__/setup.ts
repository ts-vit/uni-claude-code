import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement ResizeObserver — Mantine SegmentedControl/ScrollArea need it
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

// jsdom doesn't implement matchMedia — Mantine needs it
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@mantine/notifications", () => ({
  notifications: {
    show: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return Object.entries(params).reduce(
          (str, [k, v]) => str.replace(`{{${k}}}`, String(v)),
          key,
        );
      }
      return key;
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

vi.mock("@uni-fw/ui", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => content,
  useSettings: vi.fn(() => ({ value: "", set: vi.fn() })),
  UniProvider: ({ children }: { children: React.ReactNode }) => children,
  ConfirmModal: ({ opened, title, message }: { opened: boolean; title: string; message: string }) =>
    opened ? `${title}: ${message}` : null,
}));
