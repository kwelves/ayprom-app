import { promises as fs } from "node:fs";
import path from "node:path";
import {
  initialState,
  stateSchema,
  summarySchema,
  type AppState,
  type Summary,
} from "../shared/contracts";
export class StateStore {
  private state: AppState = initialState();
  private pending = Promise.resolve();
  constructor(private directory: string) {}
  async load(): Promise<AppState> {
    const file = path.join(this.directory, "state.json");
    try {
      const raw = JSON.parse(await fs.readFile(file, "utf8"));
      const parsed = stateSchema.parse(raw);
      this.state = {
        ...parsed,
        presets: parsed.presets.filter(
          (p) => !p.builtIn && p.id !== "ayprom-standard",
        ),
        history: Array.isArray(raw.history)
          ? raw.history.slice(0, 30).flatMap((value: unknown) => {
              const result = summarySchema.safeParse(value);
              return result.success ? [result.data] : [];
            })
          : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        await fs
          .copyFile(file, `${file}.recovery-${Date.now()}`)
          .catch(() => {});
        this.state.warning =
          "Настройки повреждены или имеют неподдерживаемую версию. Сохранена резервная копия; загружены заводские значения.";
      }
    }
    return this.get();
  }
  get(): AppState {
    return structuredClone(this.state);
  }
  save(value: unknown): Promise<void> {
    const parsed = stateSchema.parse(value);
    this.state = {
      ...this.state,
      ...parsed,
      presets: parsed.presets.filter(
        (p) => !p.builtIn && p.id !== "ayprom-standard",
      ),
    };
    return this.persist();
  }
  addHistory(summary: Summary): Promise<void> {
    this.state.history = [summary, ...this.state.history].slice(0, 30);
    return this.persist();
  }
  private persist(): Promise<void> {
    const snapshot = JSON.stringify(this.state, null, 2);
    this.pending = this.pending
      .catch(() => {})
      .then(async () => {
        await fs.mkdir(this.directory, { recursive: true });
        const file = path.join(this.directory, "state.json");
        await fs.writeFile(`${file}.tmp`, snapshot);
        await fs.rename(`${file}.tmp`, file);
      });
    return this.pending;
  }
  flush(): Promise<void> {
    return this.pending;
  }
}
