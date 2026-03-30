import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from '../users/schemas/user.schema';
import { Brief, BriefSchema } from './schemas/brief.schema';
import { BriefController } from './brief.controller';
import { BriefService } from './services/brief.service';
import { TurnstileService } from './services/turnstile.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Brief.name, schema: BriefSchema },
            { name: User.name, schema: UserSchema },
        ]),
    ],
    controllers: [BriefController],
    providers: [BriefService, TurnstileService],
})
export class AgencyModule {}
