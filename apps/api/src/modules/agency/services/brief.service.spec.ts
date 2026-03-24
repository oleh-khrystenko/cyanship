import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BRIEF_STATUS, BRIEF_BUDGET_LABEL, BRIEF_DEADLINE_LABEL } from '@cyanship/types/agency';

import { BriefService } from './brief.service';
import { Brief } from '../schemas/brief.schema';
import { EmailService } from '../../email/email.service';

jest.mock('../../../config/env', () => ({
    ENV: {},
}));

const mockBriefModel = {
    create: jest.fn(),
};

const mockEmailService = {
    sendBriefConfirmation: jest.fn().mockResolvedValue(undefined),
    sendBriefNotification: jest.fn().mockResolvedValue(undefined),
};

const testDto = {
    name: 'John Doe',
    email: 'john@example.com',
    description: 'A project description that is long enough',
    budget: 'under_2500' as const,
    deadline: 'asap' as const,
    source: 'linkedin.com',
    lang: 'en',
    captchaToken: 'test-token',
};

describe('BriefService', () => {
    let service: BriefService;

    beforeEach(async () => {
        jest.clearAllMocks();

        mockBriefModel.create.mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            ...testDto,
            status: BRIEF_STATUS.NEW,
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BriefService,
                {
                    provide: getModelToken(Brief.name),
                    useValue: mockBriefModel,
                },
                {
                    provide: EmailService,
                    useValue: mockEmailService,
                },
            ],
        }).compile();

        service = module.get(BriefService);
    });

    it('saves brief with correct fields and status new', async () => {
        await service.submit(testDto);

        expect(mockBriefModel.create).toHaveBeenCalledWith({
            name: 'John Doe',
            email: 'john@example.com',
            description: 'A project description that is long enough',
            budget: 'under_2500',
            deadline: 'asap',
            source: 'linkedin.com',
            lang: 'en',
            status: BRIEF_STATUS.NEW,
        });
    });

    it('saves brief with null for optional fields when not provided', async () => {
        const dtoWithoutOptionals = {
            ...testDto,
            deadline: undefined,
            source: undefined,
        };

        await service.submit(dtoWithoutOptionals);

        expect(mockBriefModel.create).toHaveBeenCalledWith(
            expect.objectContaining({
                deadline: null,
                source: null,
            }),
        );
    });

    it('calls sendBriefConfirmation with correct params', async () => {
        await service.submit(testDto);

        expect(mockEmailService.sendBriefConfirmation).toHaveBeenCalledWith({
            email: 'john@example.com',
            name: 'John Doe',
            lang: 'en',
        });
    });

    it('calls sendBriefNotification with correct params including labels', async () => {
        await service.submit(testDto);

        expect(mockEmailService.sendBriefNotification).toHaveBeenCalledWith({
            name: 'John Doe',
            email: 'john@example.com',
            description: 'A project description that is long enough',
            budget: 'under_2500',
            budgetLabel: BRIEF_BUDGET_LABEL['under_2500'],
            deadline: 'asap',
            deadlineLabel: BRIEF_DEADLINE_LABEL['asap'],
            source: 'linkedin.com',
        });
    });

    it('sets deadlineLabel to null when deadline is not provided', async () => {
        await service.submit({ ...testDto, deadline: undefined });

        expect(mockEmailService.sendBriefNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                deadline: null,
                deadlineLabel: null,
            }),
        );
    });

    it('saves brief even when emails fail (Promise.allSettled)', async () => {
        mockEmailService.sendBriefConfirmation.mockRejectedValue(
            new Error('SMTP down'),
        );
        mockEmailService.sendBriefNotification.mockRejectedValue(
            new Error('SMTP down'),
        );

        await expect(service.submit(testDto)).resolves.toBeUndefined();
        expect(mockBriefModel.create).toHaveBeenCalled();
    });
});
