/**
 * 通知铃的未读数轮询：页面可见时立即取一次，之后每 60 秒一次；页面隐藏时停。
 *
 * 不碰 Vue 也不碰 DOM：可见性和定时器是注入的，`bun test` 直接驱动。浏览器里的那两
 * 个实现在文件末尾，只在 `onMounted` 里调用。
 */

export const UNREAD_POLL_MS = 60_000;

/** `/notifications` 页全部标为已读后在 window 上派发，铃把数字清零。 */
export const READ_EVENT = "va:notifications-read";

export interface Visibility {
  isVisible(): boolean;
  /** 每次可见性变化都调一次 listener。返回取消订阅。 */
  subscribe(listener: () => void): () => void;
}

export interface Interval {
  start(fn: () => void, ms: number): unknown;
  stop(handle: unknown): void;
}

export interface UnreadPoller {
  start(): void;
  stop(): void;
}

export function createUnreadPoller(options: {
  /** null：这一次没取到，数字不动。 */
  fetchCount: () => Promise<number | null>;
  onCount: (count: number) => void;
  visibility: Visibility;
  interval: Interval;
  periodMs?: number;
}): UnreadPoller {
  const period = options.periodMs ?? UNREAD_POLL_MS;
  let handle: unknown = null;
  let unsubscribe: (() => void) | null = null;
  let running = false;

  async function tick(): Promise<void> {
    const count = await options.fetchCount();
    if (running && count !== null) options.onCount(count);
  }

  function resume(): void {
    if (handle !== null) return;
    void tick();
    handle = options.interval.start(() => void tick(), period);
  }

  function pause(): void {
    if (handle === null) return;
    options.interval.stop(handle);
    handle = null;
  }

  function sync(): void {
    if (options.visibility.isVisible()) resume();
    else pause();
  }

  return {
    start() {
      if (running) return;
      running = true;
      unsubscribe = options.visibility.subscribe(sync);
      sync();
    },
    stop() {
      running = false;
      pause();
      unsubscribe?.();
      unsubscribe = null;
    },
  };
}

export function documentVisibility(): Visibility {
  return {
    isVisible: () => document.visibilityState === "visible",
    subscribe(listener) {
      document.addEventListener("visibilitychange", listener);
      return () => document.removeEventListener("visibilitychange", listener);
    },
  };
}

export const windowInterval: Interval = {
  start: (fn, ms) => window.setInterval(fn, ms),
  stop: (handle) => window.clearInterval(handle as number),
};
