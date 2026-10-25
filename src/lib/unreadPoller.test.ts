import { describe, expect, test } from "bun:test";
import {
  createUnreadPoller,
  STOP_POLLING,
  UNREAD_POLL_MS,
  type Interval,
  type Visibility,
} from "./unreadPoller";

function harness(
  visible: boolean,
  counts: Array<number | null | typeof STOP_POLLING> = [3],
) {
  let isVisible = visible;
  const listeners = new Set<() => void>();
  const visibility: Visibility = {
    isVisible: () => isVisible,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let nextHandle = 1;
  const interval: Interval = {
    start(fn, ms) {
      const handle = nextHandle++;
      timers.set(handle, { fn, ms });
      return handle;
    },
    stop(handle) {
      timers.delete(handle as number);
    },
  };
  let fetches = 0;
  const seen: number[] = [];
  const poller = createUnreadPoller({
    fetchCount: async () => counts[Math.min(fetches++, counts.length - 1)],
    onCount: (n) => seen.push(n),
    visibility,
    interval,
  });
  return {
    poller,
    timers,
    listeners,
    seen,
    fetches: () => fetches,
    setVisible(value: boolean) {
      isVisible = value;
      for (const l of listeners) l();
    },
    tick() {
      for (const { fn } of timers.values()) fn();
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createUnreadPoller", () => {
  test("visible at start: fetches at once and every 60 s", async () => {
    const h = harness(true, [3, 5]);
    h.poller.start();
    await flush();
    expect(h.fetches()).toBe(1);
    expect([...h.timers.values()].map((t) => t.ms)).toEqual([UNREAD_POLL_MS]);
    h.tick();
    await flush();
    expect(h.seen).toEqual([3, 5]);
  });

  test("hidden at start: nothing until the tab becomes visible", async () => {
    const h = harness(false);
    h.poller.start();
    await flush();
    expect(h.fetches()).toBe(0);
    expect(h.timers.size).toBe(0);
    h.setVisible(true);
    await flush();
    expect(h.fetches()).toBe(1);
    expect(h.timers.size).toBe(1);
  });

  test("hiding the tab stops the interval", async () => {
    const h = harness(true);
    h.poller.start();
    await flush();
    h.setVisible(false);
    expect(h.timers.size).toBe(0);
  });

  test("a failed fetch (null) leaves the count alone", async () => {
    const h = harness(true, [null]);
    h.poller.start();
    await flush();
    expect(h.seen).toEqual([]);
  });

  test("stop clears the interval and the visibility listener", async () => {
    const h = harness(true);
    h.poller.start();
    await flush();
    h.poller.stop();
    expect(h.timers.size).toBe(0);
    expect(h.listeners.size).toBe(0);
  });

  test("a 401 (STOP_POLLING) zeroes the count and stops further fetches", async () => {
    const h = harness(true, [4, STOP_POLLING, 7]);
    h.poller.start();
    await flush();
    h.tick();
    await flush();
    expect(h.seen).toEqual([4, 0]);
    expect(h.timers.size).toBe(0);
    expect(h.listeners.size).toBe(0);
    h.setVisible(false);
    h.setVisible(true);
    h.tick();
    await flush();
    expect(h.fetches()).toBe(2);
  });

  test("refresh refetches at once without adding a timer; no-op when stopped", async () => {
    const h = harness(true, [4, 1, 9]);
    h.poller.start();
    await flush();
    h.poller.refresh();
    await flush();
    expect(h.seen).toEqual([4, 1]);
    expect(h.timers.size).toBe(1);
    h.poller.stop();
    h.poller.refresh();
    await flush();
    expect(h.fetches()).toBe(2);
  });
});
