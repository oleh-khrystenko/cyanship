import {
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtActiveGuard extends AuthGuard('jwt') {
    handleRequest<
        TUser extends Record<string, unknown> = Record<string, unknown>,
    >(
        err: Error | null,
        user: TUser | false,
        info: unknown,
        context: ExecutionContext
    ): TUser {
        const authenticatedUser: TUser = super.handleRequest(
            err,
            user,
            info,
            context
        );
        if (authenticatedUser && authenticatedUser.deletedAt) {
            throw new UnauthorizedException();
        }
        return authenticatedUser;
    }
}
