import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { paymentProviderProvider } from './providers/payment-provider.provider';
import { StripeService } from './providers/stripe.service';
import {
    ProcessedWebhookEvent,
    ProcessedWebhookEventSchema,
} from './schemas/processed-webhook-event.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: ProcessedWebhookEvent.name,
                schema: ProcessedWebhookEventSchema,
            },
            { name: User.name, schema: UserSchema },
        ]),
    ],
    controllers: [PaymentsController],
    providers: [PaymentsService, StripeService, paymentProviderProvider],
    exports: [PaymentsService],
})
export class PaymentsModule {}
