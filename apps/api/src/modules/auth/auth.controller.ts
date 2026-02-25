import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    Res,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
    AuthResponse,
    CheckEmailResponse,
    Lang,
    MAGIC_LINK_PURPOSE,
    RESPONSE_CODE,
    type ApiMessageResponse,
} from '@lucidkit/types';
import { CookieOptions, Request, Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ENV } from '../../config/env';
import { UserDocument } from '../users/schemas/user.schema';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CheckEmailDto } from './dto/check-email.dto';
import { LoginPasswordDto } from './dto/login-password.dto';
import { SendMagicLinkDto } from './dto/send-magic-link.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { VerifyMagicLinkDto } from './dto/verify-magic-link.dto';
import { VerifyPasswordDto } from './dto/verify-password.dto';
import { GoogleValidatedUser } from './strategies/google.strategy';

const REFRESH_COOKIE_OPTIONS: CookieOptions = {
    httpOnly: true,
    secure: ENV.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Get('google')
    @UseGuards(AuthGuard('google'))
    googleAuth() {
        // Passport redirects to Google consent screen
    }

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    async googleCallback(
        @Req() req: Request,
        @Res() res: Response
    ): Promise<void> {
        const { tokens } = await this.authService.handleGoogleAuth(
            req.user as GoogleValidatedUser
        );

        res.cookie('bid_refresh', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
        res.redirect(`${ENV.WEB_URL}/auth/callback`);
    }

    @Post('check-email')
    async checkEmail(
        @Body() dto: CheckEmailDto,
        @Req() req: Request
    ): Promise<{ data: CheckEmailResponse }> {
        const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
        const result = await this.authService.checkEmail(dto.email, ip);
        return { data: result };
    }

    @Post('login/password')
    async loginWithPassword(
        @Body() dto: LoginPasswordDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<{ data: AuthResponse }> {
        const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
        const { user, accessToken, refreshToken } =
            await this.authService.loginWithPassword(
                dto.email,
                dto.password,
                ip
            );

        res.cookie('bid_refresh', refreshToken, REFRESH_COOKIE_OPTIONS);

        return {
            data: {
                user: {
                    id: user.id as string,
                    email: user.email,
                    profile: user.profile,
                    credits: user.credits,
                    hasPassword: !!user.passwordHash,
                    deletedAt: user.deletedAt ?? null,
                    preferredLang: user.preferredLang as Lang,
                },
                accessToken,
            },
        };
    }

    @Post('magic-link/send')
    async sendMagicLink(
        @Body() dto: SendMagicLinkDto
    ): Promise<ApiMessageResponse> {
        await this.authService.sendMagicLink(
            dto.email,
            dto.purpose ?? MAGIC_LINK_PURPOSE.LOGIN
        );
        return {
            data: {
                code: RESPONSE_CODE.MAGIC_LINK_SENT,
                message: 'Magic link sent',
            },
        };
    }

    @Post('magic-link/verify')
    async verifyMagicLink(
        @Body() dto: VerifyMagicLinkDto,
        @Res({ passthrough: true }) res: Response
    ): Promise<{ data: AuthResponse | { deleted: true; message: string } }> {
        const result = await this.authService.verifyMagicLink(dto.token);

        if (result.deleted) {
            res.clearCookie('bid_refresh', { path: '/' });
            return {
                data: { deleted: true, message: result.message },
            };
        }

        const { user, tokens, purpose } = result;

        res.cookie('bid_refresh', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

        return {
            data: {
                user: {
                    id: user.id as string,
                    email: user.email,
                    profile: user.profile,
                    credits: user.credits,
                    hasPassword: !!user.passwordHash,
                    deletedAt: user.deletedAt ?? null,
                    preferredLang: user.preferredLang as Lang,
                },
                accessToken: tokens.accessToken,
                purpose,
            },
        };
    }

    @Post('password/set')
    @UseGuards(JwtAuthGuard)
    async setPassword(
        @CurrentUser() user: UserDocument,
        @Body() dto: SetPasswordDto
    ): Promise<ApiMessageResponse> {
        await this.authService.setPassword(
            user._id.toString(),
            dto.password
        );
        return {
            data: {
                code: RESPONSE_CODE.PASSWORD_SET,
                message: 'Password set',
            },
        };
    }

    @Post('password/change')
    @UseGuards(JwtAuthGuard)
    async changePassword(
        @CurrentUser() user: UserDocument,
        @Body() dto: ChangePasswordDto,
        @Res({ passthrough: true }) res: Response
    ): Promise<{ data: { message: string; accessToken: string } }> {
        const { accessToken, refreshToken } =
            await this.authService.changePassword(
                user._id.toString(),
                dto.currentPassword,
                dto.newPassword
            );

        res.cookie('bid_refresh', refreshToken, REFRESH_COOKIE_OPTIONS);

        return { data: { message: 'Password changed', accessToken } };
    }

    @Post('password/delete')
    @UseGuards(JwtAuthGuard)
    async deletePassword(
        @CurrentUser() user: UserDocument
    ): Promise<ApiMessageResponse> {
        await this.authService.deletePassword(user._id.toString());
        return {
            data: {
                code: RESPONSE_CODE.PASSWORD_DELETED,
                message: 'Password deleted',
            },
        };
    }

    @Post('password/verify')
    @UseGuards(JwtAuthGuard)
    async verifyPassword(
        @CurrentUser() user: UserDocument,
        @Body() dto: VerifyPasswordDto
    ): Promise<{ data: { isValid: boolean } }> {
        const isValid = await this.authService.verifyPassword(
            user._id.toString(),
            dto.password
        );
        return { data: { isValid } };
    }

    @Post('refresh')
    async refresh(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<{ data: { accessToken: string } }> {
        const refreshToken = req.cookies?.bid_refresh as string | undefined;

        if (!refreshToken) {
            throw new UnauthorizedException('Refresh token not found');
        }

        try {
            const tokens =
                await this.authService.rotateRefreshToken(refreshToken);

            res.cookie(
                'bid_refresh',
                tokens.refreshToken,
                REFRESH_COOKIE_OPTIONS
            );

            return { data: { accessToken: tokens.accessToken } };
        } catch (error) {
            res.clearCookie('bid_refresh', {
                httpOnly: true,
                secure: ENV.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
            });
            throw error;
        }
    }

    @Post('logout')
    async logout(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ): Promise<ApiMessageResponse> {
        const refreshToken = req.cookies?.bid_refresh as string | undefined;

        if (refreshToken) {
            await this.authService.revokeRefreshTokenByJwt(refreshToken);
        }

        res.clearCookie('bid_refresh', {
            httpOnly: true,
            secure: ENV.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
        });

        return {
            data: {
                code: RESPONSE_CODE.LOGGED_OUT,
                message: 'Logged out',
            },
        };
    }
}
