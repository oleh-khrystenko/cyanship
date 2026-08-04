import { MongoBinary } from 'mongodb-memory-server';

/**
 * Downloads the mongod binary once, in the Jest main process, before any worker
 * spawns.
 *
 * Each e2e suite creates its own `MongoMemoryServer` in `beforeAll`, and Jest
 * runs those suites in parallel workers. On a cold binary cache — every CI run,
 * since only the pnpm store is cached — all of them miss at the same instant and
 * race for the same download lock. The loser dies on `Cannot unlock file
 * "…/mongodb-binaries/<version>.lock", because it is not locked by this process`
 * and takes its whole suite down before a single request is made. Locally the
 * binary is already on disk, so the race never shows up outside CI. Warming the
 * cache here leaves every worker on the already-downloaded path.
 */
export default async function globalSetup(): Promise<void> {
    await MongoBinary.getPath();
}
