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
    Lang,
    RESPONSE_CODE,
    type ApiMessageResponse,
} from '@lucidkit/types';
import { CookieOptions, Request, Response } from 'express';

import { ENV } from '../../config/env';
import { AuthService } from './auth.service';
import { SendMagicLinkDto } from './dto/send-magic-link.dto';
import { VerifyMagicLinkDto } from './dto/verify-magic-link.dto';
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

    @Post('magic-link/send')
    async sendMagicLink(
        @Body() dto: SendMagicLinkDto
    ): Promise<ApiMessageResponse> {
        await this.authService.sendMagicLink(dto.email);
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
    ): Promise<{ data: AuthResponse }> {
        const { user, tokens } = await this.authService.verifyMagicLink(
            dto.token
        );

        res.cookie('bid_refresh', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

        return {
            data: {
                user: {
                    id: user.id as string,
                    email: user.email,
                    profile: user.profile,
                    credits: user.credits,
                    preferredLang: user.preferredLang as Lang,
                },
                accessToken: tokens.accessToken,
            },
        };
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
