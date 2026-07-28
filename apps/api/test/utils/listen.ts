import { INestApplication } from '@nestjs/common';

/**
 * Address every e2e suite binds to — and therefore the exact value Express
 * reports as `req.ip`. Rate-limit fixtures key their Redis entries off it
 * instead of hardcoding an address form: a wildcard bind would report the
 * IPv4-mapped `::ffff:127.0.0.1` instead, and the seeded key would silently
 * miss.
 */
export const LOOPBACK_IP = '127.0.0.1';

/**
 * Binds the app to one fixed loopback port for the whole suite.
 *
 * Must be called in `beforeAll` right after `app.init()`, before the first
 * supertest request. Left to itself, supertest binds a *new* ephemeral port for
 * every single request (listen → request → close, ~150 cycles per suite) and it
 * binds on the wildcard address while always dialing `127.0.0.1`. A parallel
 * jest worker's in-memory mongod takes `127.0.0.1:<port>` from the same
 * ephemeral range; a wildcard bind does not collide with it, so the request is
 * answered by mongod and comes back as a foreign `404 Not Found` on a route that
 * exists. Binding once, explicitly on `127.0.0.1`, makes the kernel account for
 * the port on the exact address supertest dials — it cannot be handed out twice.
 */
export async function listenOnLoopback(app: INestApplication): Promise<void> {
    await app.listen(0, LOOPBACK_IP);
}
