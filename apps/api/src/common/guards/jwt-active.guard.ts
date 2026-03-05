import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtActiveGuard extends AuthGuard('jwt') {
    handleRequest<TUser = any>(
        err: Error | null,
        user: TUser | false,
        info: unknown,
        context: ExecutionContext
    ): TUser {
        const authenticatedUser = super.handleRequest(err, user, info, context);
        if (authenticatedUser && (authenticatedUser as any).deletedAt) {
            throw new UnauthorizedException();
        }
        return authenticatedUser;
    }
}
