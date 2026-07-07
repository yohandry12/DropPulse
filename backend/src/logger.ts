// Tiny zero-dependency console logger. ANSI colours, short timestamps, levelled
// lines, a startup banner and an HTTP-request formatter. Colours auto-disable
// when stdout isn't a TTY (piped logs stay clean). Shared by server + worker.

const isTTY = process.stdout.isTTY ?? false;

// ANSI helpers — no-ops when not a TTY.
const c = (code: string) => (s: string) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = c("2");
const bold = c("1");
const red = c("31");
const green = c("32");
const yellow = c("33");
const blue = c("34");
const magenta = c("35");
const cyan = c("36");
const gray = c("90");

// HH:MM:SS local time. new Date() is fine here (not inside a workflow script).
function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return dim(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
}

type Level = "info" | "warn" | "error" | "ok";

const TAG: Record<Level, string> = {
  info: blue("info"),
  ok: green(" ok "),
  warn: yellow("warn"),
  error: red("err "),
};

function line(level: Level, msg: string, extra?: string): void {
  const out = `${stamp()} ${TAG[level]} ${msg}${extra ? ` ${dim(extra)}` : ""}`;
  if (level === "error") console.error(out);
  else console.log(out);
}

export const log = {
  info: (msg: string, extra?: string) => line("info", msg, extra),
  ok: (msg: string, extra?: string) => line("ok", msg, extra),
  warn: (msg: string, extra?: string) => line("warn", msg, extra),
  error: (msg: string, extra?: string) => line("error", msg, extra),
};

// Colour an HTTP status by class.
function colourStatus(status: number): string {
  const s = String(status);
  if (status >= 500) return red(s);
  if (status >= 400) return yellow(s);
  if (status >= 300) return cyan(s);
  return green(s);
}

// Colour a duration: fast green, slowish yellow, slow red.
function colourMs(ms: number): string {
  const s = `${ms}ms`;
  if (ms >= 500) return red(s);
  if (ms >= 150) return yellow(s);
  return gray(s);
}

// One formatted request line: "12:04:33  GET  /products/live  200  8ms".
export function logRequest(method: string, path: string, status: number, ms: number): void {
  const m = magenta(method.padEnd(6));
  console.log(`${stamp()} ${m} ${path.padEnd(28)} ${colourStatus(status)} ${colourMs(ms)}`);
}

// A boxed startup banner. `rows` are label→value pairs shown under the title.
export function banner(title: string, rows: [string, string][]): void {
  const label = (s: string) => dim(s.padEnd(9));
  console.log("");
  console.log(bold(cyan(`  ▲ ${title}`)));
  for (const [k, v] of rows) {
    console.log(`    ${label(k)} ${v}`);
  }
  console.log("");
}

export { green, red, yellow, cyan, dim, bold };
