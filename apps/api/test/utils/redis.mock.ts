/**
 * Stateful in-memory stand-in for the ioredis client injected via REDIS_CLIENT.
 *
 * Shared by every e2e fixture so token families, rate-limit counters and magic
 * link storage are exercised against a single implementation — three divergent
 * copies of this mock were the reason the suites silently drifted away from the
 * production module graph.
 *
 * Only the commands the API actually issues are implemented. TTLs are accepted
 * and ignored: e2e assertions never advance time, they pre-seed counters.
 */

/** Redis sets are stored in the same string map as JSON arrays. */
function readSet(store: Map<string, string>, key: string): Set<string> {
    const raw = store.get(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>();
}

function writeSet(
    store: Map<string, string>,
    key: string,
    set: Set<string>
): void {
    if (set.size === 0) store.delete(key);
    else store.set(key, JSON.stringify([...set]));
}

function increment(store: Map<string, string>, key: string): number {
    const next = (parseInt(store.get(key) ?? '0', 10) || 0) + 1;
    store.set(key, String(next));
    return next;
}

export function createStatefulRedisMock() {
    const store = new Map<string, string>();

    function createPipeline() {
        const ops: Array<() => void> = [];
        const pipe = {
            set(key: string, value: string, _ex?: string, _ttl?: number) {
                ops.push(() => store.set(key, value));
                return pipe;
            },
            del(key: string) {
                ops.push(() => store.delete(key));
                return pipe;
            },
            incr(key: string) {
                ops.push(() => increment(store, key));
                return pipe;
            },
            expire(_key: string, _ttl: number) {
                return pipe;
            },
            sadd(key: string, ...members: string[]) {
                ops.push(() => {
                    const set = readSet(store, key);
                    for (const m of members) set.add(m);
                    writeSet(store, key, set);
                });
                return pipe;
            },
            srem(key: string, ...members: string[]) {
                ops.push(() => {
                    const set = readSet(store, key);
                    for (const m of members) set.delete(m);
                    writeSet(store, key, set);
                });
                return pipe;
            },
            async exec() {
                for (const op of ops) op();
                return [];
            },
        };
        return pipe;
    }

    return {
        ping: jest.fn().mockResolvedValue('PONG'),
        quit: jest.fn().mockResolvedValue('OK'),
        on: jest.fn().mockReturnThis(),

        async get(key: string) {
            return store.get(key) ?? null;
        },
        async getdel(key: string) {
            const val = store.get(key) ?? null;
            if (val !== null) store.delete(key);
            return val;
        },
        async set(key: string, value: string, _ex?: string, _ttl?: number) {
            store.set(key, value);
            return 'OK';
        },
        async del(key: string) {
            store.delete(key);
            return 1;
        },
        async incr(key: string) {
            return increment(store, key);
        },
        async expire(_key: string, _ttl: number) {
            return 1;
        },
        async smembers(key: string) {
            return [...readSet(store, key)];
        },
        async sadd(key: string, ...members: string[]) {
            const set = readSet(store, key);
            const before = set.size;
            for (const m of members) set.add(m);
            writeSet(store, key, set);
            return set.size - before;
        },
        async srem(key: string, ...members: string[]) {
            const set = readSet(store, key);
            let removed = 0;
            for (const m of members) {
                if (set.delete(m)) removed++;
            }
            writeSet(store, key, set);
            return removed;
        },

        /**
         * `RedisCounterService` issues both of its counter scripts through EVAL.
         * Both scripts do `INCR KEYS[1]` (one of them also refreshes the TTL,
         * which this mock ignores) and return the post-increment value, so a
         * single INCR reproduces their observable contract.
         */
        async eval(_script: string, _numKeys: number, key: string) {
            return increment(store, key);
        },

        pipeline() {
            return createPipeline();
        },

        // Test utilities — pre-seed counters, inspect state, reset between tests.
        _store: store,
        _clear() {
            store.clear();
        },
    };
}

export type StatefulRedisMock = ReturnType<typeof createStatefulRedisMock>;
