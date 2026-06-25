const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  info: (msg: string, data?: unknown) => {
    if (isDev) console.log(`[INFO] ${msg}`, data ?? "");
  },
  warn: (msg: string, data?: unknown) => {
    console.warn(`[WARN] ${msg}`, data ?? "");
  },
  error: (msg: string, err?: unknown) => {
    console.error(`[ERROR] ${msg}`, err ?? "");
  },
};
