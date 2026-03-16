import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

jest.mock('../../config/env', () => ({
    ENV: {
        WEB_URL: 'http://localhost:3000',
    },
}));

const mockUser = {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    email: 'test@example.com',
};

const mockPaymentsService = {
    createCheckoutSession: jest.fn(),
    createPortalSession: jest.fn(),
    handleWebhook: jest.fn(),
};

describe('PaymentsController', () => {
    let controller: PaymentsController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [PaymentsController],
            providers: [
                { provide: PaymentsService, useValue: mockPaymentsService },
            ],
        }).compile();

        controller = module.get<PaymentsController>(PaymentsController);
        jest.clearAllMocks();
    });

    // ─── POST /payments/checkout-session ────────────────────────────

    describe('POST /payments/checkout-session', () => {
        it('should create checkout session with subscription type', async () => {
            const dto = {
                paymentType: 'subscription' as const,
                planCode: 'monthly_usd',
            };
            mockPaymentsService.createCheckoutSession.mockResolvedValue({
                checkoutUrl: 'https://checkout.stripe.com/test',
            });

            const result = await controller.createCheckoutSession(
                mockUser as any,
                dto as any
            );

            expect(
                mockPaymentsService.createCheckoutSession
            ).toHaveBeenCalledWith('507f1f77bcf86cd799439011', dto);
            expect(result).toEqual({
                data: { checkoutUrl: 'https://checkout.stripe.com/test' },
            });
        });

        it('should create checkout session with one-off type', async () => {
            const dto = {
                paymentType: 'one_off' as const,
                packCode: 'credits_5' as const,
            };
            mockPaymentsService.createCheckoutSession.mockResolvedValue({
                checkoutUrl: 'https://checkout.stripe.com/oneoff',
            });

            const result = await controller.createCheckoutSession(
                mockUser as any,
                dto as any
            );

            expect(
                mockPaymentsService.createCheckoutSession
            ).toHaveBeenCalledWith('507f1f77bcf86cd799439011', dto);
            expect(result).toEqual({
                data: { checkoutUrl: 'https://checkout.stripe.com/oneoff' },
            });
        });
    });

    // ─── POST /payments/portal-session ──────────────────────────────

    describe('POST /payments/portal-session', () => {
        it('should call paymentsService.createPortalSession with userId and return portalUrl', async () => {
            mockPaymentsService.createPortalSession.mockResolvedValue({
                portalUrl: 'https://billing.stripe.com/test',
            });

            const result = await controller.createPortalSession(
                mockUser as any
            );

            expect(
                mockPaymentsService.createPortalSession
            ).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
            expect(result).toEqual({
                data: { portalUrl: 'https://billing.stripe.com/test' },
            });
        });
    });

    // ─── POST /payments/webhook/:provider ───────────────────────────

    describe('POST /payments/webhook/:provider', () => {
        it('should pass provider, rawBody, and signature to paymentsService.handleWebhook and return { received: true }', async () => {
            const rawBody = Buffer.from(
                '{"type":"checkout.session.completed"}'
            );
            const signature = 'stripe-sig-test';
            const req = { rawBody } as any;

            mockPaymentsService.handleWebhook.mockResolvedValue(undefined);

            const result = await controller.handleWebhook(
                'stripe',
                req,
                signature
            );

            expect(mockPaymentsService.handleWebhook).toHaveBeenCalledWith(
                'stripe',
                rawBody,
                signature
            );
            expect(result).toEqual({ received: true });
        });

        it('should throw BadRequestException when rawBody is missing', async () => {
            const req = { rawBody: undefined } as any;

            await expect(
                controller.handleWebhook('stripe', req, 'stripe-sig')
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException when stripe-signature header is missing', async () => {
            const req = { rawBody: Buffer.from('{}') } as any;

            await expect(
                controller.handleWebhook('stripe', req, undefined as any)
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException for unsupported provider', async () => {
            const req = { rawBody: Buffer.from('{}') } as any;

            await expect(
                controller.handleWebhook('unknown', req, 'some-sig')
            ).rejects.toThrow(BadRequestException);
        });

        it('should include provider name in BadRequestException message for unsupported provider', async () => {
            const req = { rawBody: Buffer.from('{}') } as any;

            const error = await controller
                .handleWebhook('monobank', req, 'some-sig')
                .catch((e: unknown) => e);

            expect(error).toBeInstanceOf(BadRequestException);
            expect((error as BadRequestException).message).toBe(
                'Unsupported provider: monobank'
            );
        });
    });
});
