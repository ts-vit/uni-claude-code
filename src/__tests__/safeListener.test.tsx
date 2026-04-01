import { render, waitFor } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTauriListener } from "../utils/safeListener";

const mockedListen = vi.mocked(listen);

function TestListener() {
  useTauriListener("test-event", () => {}, []);
  return <div>listener</div>;
}

describe("useTauriListener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates listener", async () => {
    const unlisten = vi.fn();
    mockedListen.mockResolvedValue(unlisten);

    render(<TestListener />);

    await waitFor(() => {
      expect(mockedListen).toHaveBeenCalledWith("test-event", expect.any(Function));
    });
  });

  it("cleanup on unmount", async () => {
    const unlisten = vi.fn();
    mockedListen.mockResolvedValue(unlisten);

    const { unmount } = render(<TestListener />);

    await waitFor(() => {
      expect(mockedListen).toHaveBeenCalled();
    });

    unmount();

    await waitFor(() => {
      expect(unlisten).toHaveBeenCalledTimes(1);
    });
  });

  it("cleanup race condition", async () => {
    const unlisten = vi.fn();
    let resolveListen: undefined | ((value: () => void) => void);

    mockedListen.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveListen = resolve;
        }),
    );

    const { unmount } = render(<TestListener />);
    unmount();

    if (resolveListen) {
      resolveListen(unlisten);
    }

    await waitFor(() => {
      expect(unlisten).toHaveBeenCalledTimes(1);
    });
  });
});
