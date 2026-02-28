import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { UserDocument } from '../../modules/users/schemas/user.schema';

@Injectable()
export class SubscriptionGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const user = request.user as UserDocument | undefined;

        if (!user) {
            throw new ForbiddenException('Subscription required');
        }

        if (!user.billing?.hasActiveSubscription) {
            throw new ForbiddenException('Subscription required');
        }

        return true;
    }
}
