import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type pg from "pg";
import type { TestBundle } from "@/types/coding-exercise";

/** Where hidden test bundles come from. Production reads them from the
 * database (judge.test_bundles, published from the private repository);
 * local development can point at a directory of built bundles instead. */
export interface BundleSource {
  get(exerciseId: string): Promise<TestBundle | null>;
}

export class DirectoryBundles implements BundleSource {
  constructor(private readonly dir: string) {}

  async get(exerciseId: string): Promise<TestBundle | null> {
    if (!/^[a-z0-9-]+$/.test(exerciseId)) return null;
    try {
      return JSON.parse(await readFile(join(this.dir, `${exerciseId}.json`), "utf8")) as TestBundle;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }
}

const CACHE_MS = 60_000;

export class DatabaseBundles implements BundleSource {
  private cache = new Map<string, { bundle: TestBundle | null; fetchedAt: number }>();

  constructor(private readonly pool: pg.Pool) {}

  async get(exerciseId: string): Promise<TestBundle | null> {
    const hit = this.cache.get(exerciseId);
    if (hit && Date.now() - hit.fetchedAt < CACHE_MS) return hit.bundle;
    const { rows } = await this.pool.query<{ bundle: TestBundle }>(
      "select bundle from judge.get_bundle($1)",
      [exerciseId],
    );
    const bundle = rows[0]?.bundle ?? null;
    this.cache.set(exerciseId, { bundle, fetchedAt: Date.now() });
    return bundle;
  }
}
