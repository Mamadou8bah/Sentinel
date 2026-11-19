/** Only KYC session/status calls use this policy. Never wrap payment writes. */
export type KycConnectionOptions = { signal?: AbortSignal; onRetry?: (attempt: number) => void; deadline?: number };
export class KycConnectionPending extends Error {
  constructor() { super("Verification is taking longer to connect. Your verification status has not changed. Please try again."); this.name = "KycConnectionPending"; }
}
export class KycTemporaryError extends Error { constructor() { super("Verification service is temporarily unavailable"); } }
function transient(error: unknown) {
  return error instanceof KycTemporaryError || error instanceof SyntaxError || (error instanceof Error && /unable to connect|temporarily unavailable|could not confirm|timed out|failed to fetch|network request failed|load failed/i.test(error.message));
}
function pause(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(new Error("Verification request cancelled.")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, ms);
    signal?.addEventListener("abort", abort, { once: true }); if (signal?.aborted) abort();
  });
}
export async function withKycWarmup<T>(operation: (signal: AbortSignal) => Promise<T>, options: KycConnectionOptions = {}): Promise<T> {
  const deadline = options.deadline ?? Date.now() + 180000;
  let attempt = 0;
  while (Date.now() < deadline) {
    if (options.signal?.aborted) throw new Error("Verification request cancelled.");
    const controller = new AbortController();
    let rejectCancelled: (error: Error) => void = () => {};
    const cancelled = new Promise<never>((_, reject) => { rejectCancelled = reject; });
    const cancel = () => { controller.abort(); rejectCancelled(new Error("Verification request cancelled.")); };
    options.signal?.addEventListener("abort", cancel, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Verification request timed out")); }, Math.min(30000, Math.max(1, deadline - Date.now()))); });
      return await Promise.race([operation(controller.signal), timeout, cancelled]);
    } catch (error) {
      if (options.signal?.aborted) throw new Error("Verification request cancelled.");
      if (!transient(error)) throw error;
      options.onRetry?.(++attempt);
    } finally { if (timer) clearTimeout(timer); options.signal?.removeEventListener("abort", cancel); }
    const remaining = deadline - Date.now(); if (remaining <= 0) break;
    await pause(Math.min(5000, remaining), options.signal);
  }
  throw new KycConnectionPending();
}
