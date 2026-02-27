import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { AuthService } from '../auth/auth.service';
import { CleanupService } from './cleanup.service';
import { User } from './schemas/user.schema';

jest.mock('../../config/env', () => ({
    ENV: {
        ACCOUNT_DELETION_GRACE_DAYS: 30,
    },
}));

const mockModel = {
    find: jest.fn(),
    findByIdAndDelete: jest.fn(),
};

const mockAuthService = {
    revokeAllUserTokens: jest.fn().mockResolvedValue(undefined),
};

describe('CleanupService', () => {
    let service: CleanupService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CleanupService,
                { provide: getModelToken(User.name), useValue: mockModel },
                { provide: AuthService, useValue: mockAuthService },
            ],
        }).compile();

        service = module.get<CleanupService>(CleanupService);
        jest.clearAllMocks();
    });

    describe('handleExpiredAccounts', () => {
        it('should delete users with deletedAt older than grace period', async () => {
            const expiredUsers = [
                { _id: { toString: () => 'user-1' }, email: 'a@test.com' },
                { _id: { toString: () => 'user-2' }, email: 'b@test.com' },
            ];

            mockModel.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockReturnValue({
                        exec: jest.fn().mockResolvedValue(expiredUsers),
                    }),
                }),
            });
            mockModel.findByIdAndDelete.mockReturnValue({
                exec: jest.fn().mockResolvedValue(undefined),
            });

            await service.handleExpiredAccounts();

            expect(mockModel.find).toHaveBeenCalledWith({
                deletedAt: { $lte: expect.any(Date) },
            });
            expect(mockAuthService.revokeAllUserTokens).toHaveBeenCalledWith(
                'user-1'
            );
            expect(mockAuthService.revokeAllUserTokens).toHaveBeenCalledWith(
                'user-2'
            );
            expect(mockModel.findByIdAndDelete).toHaveBeenCalledWith('user-1');
            expect(mockModel.findByIdAndDelete).toHaveBeenCalledWith('user-2');
            expect(mockAuthService.revokeAllUserTokens).toHaveBeenCalledTimes(
                2
            );
            expect(mockModel.findByIdAndDelete).toHaveBeenCalledTimes(2);
        });

        it('should not delete anything when no expired accounts', async () => {
            mockModel.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockReturnValue({
                        exec: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });

            await service.handleExpiredAccounts();

            expect(mockAuthService.revokeAllUserTokens).not.toHaveBeenCalled();
            expect(mockModel.findByIdAndDelete).not.toHaveBeenCalled();
        });

        it('should use correct cutoff date based on grace days', async () => {
            mockModel.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockReturnValue({
                        exec: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });

            const before = new Date(Date.now() - 30 * 86_400_000);
            await service.handleExpiredAccounts();
            const after = new Date(Date.now() - 30 * 86_400_000);

            const cutoffArg = mockModel.find.mock.calls[0][0].deletedAt.$lte;
            expect(cutoffArg.getTime()).toBeGreaterThanOrEqual(
                before.getTime()
            );
            expect(cutoffArg.getTime()).toBeLessThanOrEqual(after.getTime());
        });

        it('should continue deleting other users when one fails', async () => {
            const expiredUsers = [
                { _id: { toString: () => 'user-1' }, email: 'a@test.com' },
                { _id: { toString: () => 'user-2' }, email: 'b@test.com' },
            ];

            mockModel.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockReturnValue({
                        exec: jest.fn().mockResolvedValue(expiredUsers),
                    }),
                }),
            });

            // First user fails on revokeAllUserTokens
            mockAuthService.revokeAllUserTokens
                .mockRejectedValueOnce(new Error('Redis connection lost'))
                .mockResolvedValueOnce(undefined);

            mockModel.findByIdAndDelete.mockReturnValue({
                exec: jest.fn().mockResolvedValue(undefined),
            });

            await service.handleExpiredAccounts();

            // First user: revoke called but failed, so findByIdAndDelete NOT called for user-1
            expect(
                mockAuthService.revokeAllUserTokens
            ).toHaveBeenCalledTimes(2);
            // Second user: both revoke and delete called
            expect(mockModel.findByIdAndDelete).toHaveBeenCalledWith('user-2');
            expect(mockModel.findByIdAndDelete).toHaveBeenCalledTimes(1);
        });

        it('should revoke tokens before deleting user document', async () => {
            const callOrder: string[] = [];

            mockModel.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockReturnValue({
                        exec: jest.fn().mockResolvedValue([
                            {
                                _id: { toString: () => 'user-1' },
                                email: 'a@test.com',
                            },
                        ]),
                    }),
                }),
            });

            mockAuthService.revokeAllUserTokens.mockImplementation(() => {
                callOrder.push('revoke');
                return Promise.resolve();
            });
            mockModel.findByIdAndDelete.mockReturnValue({
                exec: jest.fn().mockImplementation(() => {
                    callOrder.push('delete');
                    return Promise.resolve();
                }),
            });

            await service.handleExpiredAccounts();

            expect(callOrder).toEqual(['revoke', 'delete']);
        });
    });
});
