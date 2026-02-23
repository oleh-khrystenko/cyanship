import { Logger, Provider } from '@nestjs/common';
import Redis from 'ioredis';

import { ENV } from '../../config/env';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProvider: Provider = {
    provide: REDIS_CLIENT,
    useFactory: (): Redis => {
        const logger = new Logger('RedisProvider');
        const client = new Redis(ENV.REDIS_URL);

        client.on('error', (err: Error) => {
            logger.error(`Redis connection error: ${err.message}`);
        });

        client.on('connect', () => {
            logger.log('Redis connected');
        });

        return client;
    },
};
