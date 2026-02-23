import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

import { ENV } from '../../../config/env';

export interface GoogleValidatedUser {
    email: string;
    name?: string;
    avatar?: string;
    providerId: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor() {
        super({
            clientID: ENV.GOOGLE_CLIENT_ID,
            clientSecret: ENV.GOOGLE_CLIENT_SECRET,
            callbackURL: ENV.GOOGLE_CALLBACK_URL,
            scope: ['email', 'profile'],
        });
    }

    validate(
        _accessToken: string,
        _refreshToken: string,
        profile: {
            id: string;
            emails?: { value: string }[];
            displayName?: string;
            photos?: { value: string }[];
        },
        done: VerifyCallback
    ): void {
        const user: GoogleValidatedUser = {
            email: profile.emails?.[0]?.value ?? '',
            name: profile.displayName,
            avatar: profile.photos?.[0]?.value,
            providerId: profile.id,
        };

        done(null, user);
    }
}
