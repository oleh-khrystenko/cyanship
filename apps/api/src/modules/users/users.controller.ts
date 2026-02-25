import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
    RESPONSE_CODE,
    type ApiMessageResponse,
} from '@lucidkit/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpdateLangDto } from './dto/update-lang.dto';
import { UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

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
                hasPassword: !!user.passwordHash,
                deletedAt: user.deletedAt ?? null,
                preferredLang: user.preferredLang,
            },
        };
    }

    @Patch('me/lang')
    @UseGuards(JwtAuthGuard)
    async updateLang(
        @CurrentUser() user: UserDocument,
        @Body() dto: UpdateLangDto
    ): Promise<ApiMessageResponse> {
        await this.usersService.updateLang(user.id as string, dto.lang);
        return {
            data: {
                code: RESPONSE_CODE.LANG_UPDATED,
                message: 'Language updated',
            },
        };
    }
}
