import {
    forwardRef,
    Inject,
    Logger,
    Module,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import Redis from 'ioredis';

import {
    REDIS_CLIENT,
    redisProvider,
} from '../../common/providers/redis.provider';
import { ENV } from '../../config/env';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
    imports: [
        PassportModule,
        JwtModule.register({
            secret: ENV.JWT_ACCESS_SECRET,
            signOptions: { expiresIn: '1h' },
        }),
        forwardRef(() => UsersModule),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        JwtStrategy,
        GoogleStrategy,
        redisProvider,
    ],
    exports: [AuthService, REDIS_CLIENT],
})
export class AuthModule implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(AuthModule.name);

    constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

    async onModuleInit(): Promise<void> {
        const result = await this.redis.ping();
        this.logger.log(`Redis ping: ${result}`);
    }

    async onModuleDestroy(): Promise<void> {
        await this.redis.quit();
        this.logger.log('Redis connection closed');
    }
}
