import { Controller, Get, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserDocument } from './schemas/user.schema';

@Controller('users')
export class UsersController {
    @Get('me')
    @UseGuards(JwtAuthGuard)
    getMe(@CurrentUser() user: UserDocument): {
        data: Record<string, unknown>;
    } {
        return {
            data: {
                id: user.id as string,
                email: user.email,
                profile: user.profile,
                credits: user.credits,
                preferredLang: user.preferredLang,
            },
        };
    }
}
