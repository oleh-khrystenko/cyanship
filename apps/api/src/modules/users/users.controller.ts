import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Patch,
    Post,
    Res,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import {
    MAGIC_LINK_PURPOSE,
    RESPONSE_CODE,
    type ApiMessageResponse,
} from '@lucidship/types';
import { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtActiveGuard } from '../../common/guards/jwt-active.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { VerifyPasswordDto } from '../auth/dto/verify-password.dto';
import { AcceptTermsDto } from './dto/accept-terms.dto';
import { UpdateLangDto } from './dto/update-lang.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
        private readonly authService: AuthService
    ) {}

    @Get('me')
    @UseGuards(JwtActiveGuard)
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
                accountDeletionRequestedAt:
                    user.accountDeletionRequestedAt ?? null,
                preferredLang: user.preferredLang,
                termsVersion: user.termsVersion ?? null,
                billing: user.billing
                    ? {
                          hasActiveSubscription:
                              user.billing.hasActiveSubscription,
                          planCode: user.billing.planCode,
                          subscriptionStatus: user.billing.subscriptionStatus,
                          currentPeriodEnd: user.billing.currentPeriodEnd,
                          cancelAtPeriodEnd: user.billing.cancelAtPeriodEnd,
                      }
                    : null,
            },
        };
    }

    @Patch('me')
    @UseGuards(JwtActiveGuard)
    async updateProfile(
        @CurrentUser() user: UserDocument,
        @Body() dto: UpdateProfileDto
    ): Promise<{ data: Record<string, unknown> }> {
        const updated = await this.usersService.updateProfile(
            user._id.toString(),
            dto
        );
        return {
            data: {
                id: updated!._id,
                email: updated!.email,
                profile: updated!.profile,
                credits: updated!.credits,
                hasPassword: !!updated!.passwordHash,
                deletedAt: updated!.deletedAt ?? null,
                accountDeletionRequestedAt:
                    updated!.accountDeletionRequestedAt ?? null,
                preferredLang: updated!.preferredLang,
            },
        };
    }

    @Patch('me/lang')
    @UseGuards(JwtActiveGuard)
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

    @Post('me/accept-terms')
    @UseGuards(JwtActiveGuard)
    async acceptTerms(
        @CurrentUser() user: UserDocument,
        @Body() dto: AcceptTermsDto
    ): Promise<ApiMessageResponse> {
        await this.usersService.acceptTerms(user._id.toString(), dto.termsVersion);
        return {
            data: {
                code: RESPONSE_CODE.TERMS_ACCEPTED,
                message: 'Terms accepted',
            },
        };
    }

    @Post('account/delete')
    @UseGuards(JwtActiveGuard)
    async deleteAccount(
        @CurrentUser() user: UserDocument
    ): Promise<{ data: Record<string, unknown> }> {
        if (user.passwordHash) {
            return { data: { requiresPassword: true } };
        }
        await this.authService.sendMagicLink(
            user.email,
            MAGIC_LINK_PURPOSE.DELETE_ACCOUNT
        );
        await this.usersService.setDeletionRequested(user._id.toString());
        return {
            data: {
                requiresMagicLink: true,
                message: 'Confirmation link sent',
            },
        };
    }

    @Post('account/delete/confirm')
    @UseGuards(JwtActiveGuard)
    async confirmDeleteAccount(
        @CurrentUser() user: UserDocument,
        @Body() dto: VerifyPasswordDto,
        @Res({ passthrough: true }) res: Response
    ): Promise<ApiMessageResponse> {
        const isValid = await this.authService.verifyPassword(
            user._id.toString(),
            dto.password
        );
        if (!isValid) {
            throw new UnauthorizedException('Invalid password');
        }

        await this.usersService.softDelete(user._id.toString());
        await this.authService.revokeAllUserTokens(user._id.toString());
        await this.authService.sendDeletionConfirmationEmail(
            user.email,
            user.preferredLang
        );

        res.clearCookie('bid_refresh', { path: '/' });

        return {
            data: {
                code: RESPONSE_CODE.ACCOUNT_DELETED,
                message: 'Account scheduled for deletion',
            },
        };
    }

    @Post('account/restore')
    @UseGuards(JwtAuthGuard)
    async restoreAccount(
        @CurrentUser() user: UserDocument
    ): Promise<ApiMessageResponse> {
        if (!user.deletedAt) {
            throw new BadRequestException('Account is not deleted');
        }
        await this.usersService.restore(user._id.toString());
        return {
            data: {
                code: RESPONSE_CODE.ACCOUNT_RESTORED,
                message: 'Account restored',
            },
        };
    }
}
