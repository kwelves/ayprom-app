/** Keeps the drive and the last folders of a Windows or POSIX path. */
export function shortPath(path: string, keep = 2) {
  if (!path) return "";
  const separator = path.includes("\\") ? "\\" : "/";
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= keep + 1) return path;
  const head = /^[A-Za-z]:$/.test(parts[0])
    ? parts[0]
    : path.startsWith(separator)
      ? ""
      : parts[0];
  return [head, "…", ...parts.slice(-keep)].join(separator);
}

export function baseName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/** 0:07, 1:24, 1:02:10 */
export function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Remaining-time estimate in plain words: «≈ 2 мин 10 с». */
export function eta(ms: number) {
  const total = Math.max(1, Math.round(ms / 1000));
  if (total < 60) return `≈ ${total} с`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) return `≈ ${Math.floor(m / 60)} ч ${m % 60} мин`;
  return s ? `≈ ${m} мин ${s} с` : `≈ ${m} мин`;
}

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
});
const timeFormat = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

/** «Сегодня, 12:42», «Вчера, 04:30», «5 окт., 20:18» */
export function runDate(iso: string, now = new Date()) {
  const date = new Date(iso);
  const day = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diff = Math.round((day(now) - day(date)) / 86_400_000);
  const prefix =
    diff === 0 ? "Сегодня" : diff === 1 ? "Вчера" : dateFormat.format(date);
  return `${prefix}, ${timeFormat.format(date)}`;
}

/** Russian plural: plural(5, ["фото", "фото", "фото"]) */
export function plural(n: number, forms: [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return forms[1];
  return forms[2];
}
