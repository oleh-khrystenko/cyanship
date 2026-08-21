import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

import { API_GLOBAL_PREFIX } from '../../../config/api';
import { ENV } from '../../../config/env';

// Google returns the browser to the web origin, never to the API origin:
// `bid_refresh` is a web-origin cookie and `next.config.ts` proxies `/api/*`
// here. Everything but the origin is fixed by the route, so the URL is derived
// from WEB_URL instead of being a second variable that can drift per
// environment. Must stay identical to the redirect URI registered in Google
// Cloud Console.
const GOOGLE_CALLBACK_URL = `${ENV.WEB_URL}/${API_GLOBAL_PREFIX}/auth/google/callback`;

export interface GoogleValidatedUser {
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    providerId: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor() {
        super({
            clientID: ENV.GOOGLE_CLIENT_ID,
            clientSecret: ENV.GOOGLE_CLIENT_SECRET,
            callbackURL: GOOGLE_CALLBACK_URL,
            scope: ['email', 'profile'],
            state: false,
        });
    }

    validate(
        _accessToken: string,
        _refreshToken: string,
        profile: {
            id: string;
            emails?: { value: string; verified?: boolean }[];
            displayName?: string;
            name?: { givenName?: string; familyName?: string };
            photos?: { value: string }[];
        },
        done: VerifyCallback
    ): void {
        const emailEntry = profile.emails?.[0];

        if (!emailEntry?.value) {
            done(
                new UnauthorizedException(
                    'Google account has no associated email'
                ),
                undefined
            );
            return;
        }

        if (emailEntry.verified !== true) {
            done(
                new UnauthorizedException('Google email is not verified'),
                undefined
            );
            return;
        }

        const user: GoogleValidatedUser = {
            email: emailEntry.value,
            firstName:
                profile.name?.givenName ?? profile.displayName ?? undefined,
            lastName: profile.name?.familyName ?? undefined,
            avatar: profile.photos?.[0]?.value,
            providerId: profile.id,
        };

        done(null, user);
    }
}
