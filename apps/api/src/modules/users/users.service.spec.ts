import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { User } from './schemas/user.schema';
import { UsersService } from './users.service';

const mockUserDoc = (overrides = {}) => ({
    id: '507f1f77bcf86cd799439011',
    email: 'test@gmail.com',
    provider: { name: 'google', id: 'google-123' },
    profile: { name: 'John Doe', avatar: 'https://photo.url' },
    credits: { balance: 0, freeReportUsed: false },
    preferredLang: 'uk',
    lastLoginAt: null as Date | null,
    save: jest.fn().mockReturnThis(),
    ...overrides,
});

const mockModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
};

describe('UsersService', () => {
    let service: UsersService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                { provide: getModelToken(User.name), useValue: mockModel },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
        jest.clearAllMocks();
    });

    describe('findByEmail', () => {
        it('should find user by lowercase email', async () => {
            const user = mockUserDoc();
            mockModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(user),
            });

            const result = await service.findByEmail('Test@Gmail.com');

            expect(mockModel.findOne).toHaveBeenCalledWith({
                email: 'test@gmail.com',
            });
            expect(result).toBe(user);
        });

        it('should return null when user not found', async () => {
            mockModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            const result = await service.findByEmail('unknown@test.com');

            expect(result).toBeNull();
        });
    });

    describe('findById', () => {
        it('should find user by id', async () => {
            const user = mockUserDoc();
            mockModel.findById.mockReturnValue({
                exec: jest.fn().mockResolvedValue(user),
            });

            const result = await service.findById('507f1f77bcf86cd799439011');

            expect(mockModel.findById).toHaveBeenCalledWith(
                '507f1f77bcf86cd799439011'
            );
            expect(result).toBe(user);
        });
    });

    describe('findOrCreateByGoogle', () => {
        const googleProfile = {
            email: 'Test@Gmail.com',
            name: 'John Doe',
            avatar: 'https://photo.url',
            providerId: 'google-123',
        };

        it('should create new user when not found', async () => {
            mockModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });
            const created = mockUserDoc();
            mockModel.create.mockResolvedValue(created);

            const result = await service.findOrCreateByGoogle(googleProfile);

            expect(mockModel.create).toHaveBeenCalledWith({
                email: 'test@gmail.com',
                provider: { name: 'google', id: 'google-123' },
                profile: { name: 'John Doe', avatar: 'https://photo.url' },
                lastLoginAt: expect.any(Date),
            });
            expect(result).toBe(created);
        });

        it('should update lastLoginAt for existing user', async () => {
            const existing = mockUserDoc();
            existing.save.mockResolvedValue(existing);
            mockModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(existing),
            });

            const result = await service.findOrCreateByGoogle(googleProfile);

            expect(existing.lastLoginAt).toBeInstanceOf(Date);
            expect(existing.save).toHaveBeenCalled();
            expect(mockModel.create).not.toHaveBeenCalled();
            expect(result).toBe(existing);
        });

        it('should set provider if missing on existing user', async () => {
            const existing = mockUserDoc({
                provider: undefined,
                profile: { name: 'John Doe', avatar: 'https://photo.url' },
            });
            existing.save.mockResolvedValue(existing);
            mockModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(existing),
            });

            await service.findOrCreateByGoogle(googleProfile);

            expect(existing.provider).toEqual({
                name: 'google',
                id: 'google-123',
            });
        });

        it('should enrich missing name from Google profile', async () => {
            const existing = mockUserDoc({
                profile: { name: undefined, avatar: 'https://existing.url' },
            });
            existing.save.mockResolvedValue(existing);
            mockModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(existing),
            });

            await service.findOrCreateByGoogle(googleProfile);

            expect(existing.profile.name).toBe('John Doe');
        });

        it('should enrich missing avatar from Google profile', async () => {
            const existing = mockUserDoc({
                profile: { name: 'Existing Name', avatar: undefined },
            });
            existing.save.mockResolvedValue(existing);
            mockModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(existing),
            });

            await service.findOrCreateByGoogle(googleProfile);

            expect(existing.profile.avatar).toBe('https://photo.url');
        });

        it('should NOT overwrite existing name with Google data', async () => {
            const existing = mockUserDoc({
                profile: {
                    name: 'Existing Name',
                    avatar: 'https://existing.url',
                },
            });
            existing.save.mockResolvedValue(existing);
            mockModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(existing),
            });

            await service.findOrCreateByGoogle(googleProfile);

            expect(existing.profile.name).toBe('Existing Name');
            expect(existing.profile.avatar).toBe('https://existing.url');
        });
    });

    describe('findOrCreateByEmail', () => {
        it('should create new user when not found', async () => {
            mockModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });
            const created = mockUserDoc({ email: 'new@test.com' });
            mockModel.create.mockResolvedValue(created);

            const result = await service.findOrCreateByEmail('New@Test.com');

            expect(mockModel.create).toHaveBeenCalledWith({
                email: 'new@test.com',
                lastLoginAt: expect.any(Date),
            });
            expect(result).toBe(created);
        });

        it('should update lastLoginAt for existing user', async () => {
            const existing = mockUserDoc();
            existing.save.mockResolvedValue(existing);
            mockModel.findOne.mockReturnValue({
                exec: jest.fn().mockResolvedValue(existing),
            });

            await service.findOrCreateByEmail('test@gmail.com');

            expect(existing.lastLoginAt).toBeInstanceOf(Date);
            expect(existing.save).toHaveBeenCalled();
        });
    });

    describe('addCredits', () => {
        it('should increment credits.balance by amount', async () => {
            mockModel.findByIdAndUpdate.mockResolvedValue(null);

            await service.addCredits('507f1f77bcf86cd799439011', 10);

            expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
                '507f1f77bcf86cd799439011',
                { $inc: { 'credits.balance': 10 } },
            );
        });
    });

    describe('deductCredit', () => {
        it('should deduct from balance atomically when balance > 0', async () => {
            mockModel.findOneAndUpdate.mockResolvedValueOnce(
                mockUserDoc({ credits: { balance: 2, freeReportUsed: false } }),
            );

            const result = await service.deductCredit(
                '507f1f77bcf86cd799439011'
            );

            expect(result).toBe(true);
            expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
                { _id: '507f1f77bcf86cd799439011', 'credits.balance': { $gt: 0 } },
                { $inc: { 'credits.balance': -1 } },
                { new: true },
            );
        });

        it('should use free report atomically when balance is 0 and free report unused', async () => {
            // First call (paid credit) returns null — no balance
            mockModel.findOneAndUpdate.mockResolvedValueOnce(null);
            // Second call (free report) succeeds
            mockModel.findOneAndUpdate.mockResolvedValueOnce(
                mockUserDoc({ credits: { balance: 0, freeReportUsed: true } }),
            );

            const result = await service.deductCredit(
                '507f1f77bcf86cd799439011'
            );

            expect(result).toBe(true);
            expect(mockModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
            expect(mockModel.findOneAndUpdate).toHaveBeenLastCalledWith(
                { _id: '507f1f77bcf86cd799439011', 'credits.freeReportUsed': false },
                { $set: { 'credits.freeReportUsed': true } },
                { new: true },
            );
        });

        it('should return false when no credits and free report already used', async () => {
            mockModel.findOneAndUpdate.mockResolvedValueOnce(null);
            mockModel.findOneAndUpdate.mockResolvedValueOnce(null);

            const result = await service.deductCredit(
                '507f1f77bcf86cd799439011'
            );

            expect(result).toBe(false);
        });

        it('should return false when user not found', async () => {
            mockModel.findOneAndUpdate.mockResolvedValueOnce(null);
            mockModel.findOneAndUpdate.mockResolvedValueOnce(null);

            const result = await service.deductCredit('nonexistent');

            expect(result).toBe(false);
        });
    });

    describe('hasCredit', () => {
        it('should return true when balance > 0', async () => {
            const user = mockUserDoc({
                credits: { balance: 1, freeReportUsed: true },
            });
            mockModel.findById.mockReturnValue({
                exec: jest.fn().mockResolvedValue(user),
            });

            expect(await service.hasCredit('507f1f77bcf86cd799439011')).toBe(
                true
            );
        });

        it('should return true when free report available', async () => {
            const user = mockUserDoc({
                credits: { balance: 0, freeReportUsed: false },
            });
            mockModel.findById.mockReturnValue({
                exec: jest.fn().mockResolvedValue(user),
            });

            expect(await service.hasCredit('507f1f77bcf86cd799439011')).toBe(
                true
            );
        });

        it('should return false when no credits and free report used', async () => {
            const user = mockUserDoc({
                credits: { balance: 0, freeReportUsed: true },
            });
            mockModel.findById.mockReturnValue({
                exec: jest.fn().mockResolvedValue(user),
            });

            expect(await service.hasCredit('507f1f77bcf86cd799439011')).toBe(
                false
            );
        });

        it('should return false when user not found', async () => {
            mockModel.findById.mockReturnValue({
                exec: jest.fn().mockResolvedValue(null),
            });

            expect(await service.hasCredit('nonexistent')).toBe(false);
        });
    });

    describe('updateLang', () => {
        it('should update preferredLang for user', async () => {
            mockModel.findByIdAndUpdate.mockReturnValue({
                exec: jest.fn().mockResolvedValue(undefined),
            });

            await service.updateLang('507f1f77bcf86cd799439011', 'en');

            expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
                '507f1f77bcf86cd799439011',
                { preferredLang: 'en' }
            );
        });
    });

    describe('setPasswordHash', () => {
        it('should store password hash via findByIdAndUpdate', async () => {
            mockModel.findByIdAndUpdate.mockResolvedValue(undefined);

            await service.setPasswordHash(
                '507f1f77bcf86cd799439011',
                '$2b$10$hash'
            );

            expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
                '507f1f77bcf86cd799439011',
                { passwordHash: '$2b$10$hash' }
            );
        });
    });

    describe('clearPasswordHash', () => {
        it('should set passwordHash to null', async () => {
            mockModel.findByIdAndUpdate.mockResolvedValue(undefined);

            await service.clearPasswordHash('507f1f77bcf86cd799439011');

            expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
                '507f1f77bcf86cd799439011',
                { passwordHash: null }
            );
        });
    });

    describe('softDelete', () => {
        it('should set deletedAt to current date', async () => {
            mockModel.findByIdAndUpdate.mockResolvedValue(undefined);

            await service.softDelete('507f1f77bcf86cd799439011');

            expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
                '507f1f77bcf86cd799439011',
                { deletedAt: expect.any(Date) }
            );
        });
    });

    describe('restore', () => {
        it('should clear deletedAt', async () => {
            mockModel.findByIdAndUpdate.mockResolvedValue(undefined);

            await service.restore('507f1f77bcf86cd799439011');

            expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
                '507f1f77bcf86cd799439011',
                { deletedAt: null }
            );
        });
    });

    describe('updateProfile', () => {
        it('should update name and avatar', async () => {
            const updated = mockUserDoc({
                profile: { name: 'New Name', avatar: 'https://new.url' },
            });
            mockModel.findByIdAndUpdate.mockResolvedValue(updated);

            const result = await service.updateProfile(
                '507f1f77bcf86cd799439011',
                { name: 'New Name', avatar: 'https://new.url' }
            );

            expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
                '507f1f77bcf86cd799439011',
                {
                    'profile.name': 'New Name',
                    'profile.avatar': 'https://new.url',
                },
                { new: true }
            );
            expect(result).toBe(updated);
        });

        it('should update only preferredLang when only lang provided', async () => {
            const updated = mockUserDoc({ preferredLang: 'en' });
            mockModel.findByIdAndUpdate.mockResolvedValue(updated);

            await service.updateProfile('507f1f77bcf86cd799439011', {
                preferredLang: 'en',
            });

            expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
                '507f1f77bcf86cd799439011',
                { preferredLang: 'en' },
                { new: true }
            );
        });

        it('should not include undefined fields in update', async () => {
            mockModel.findByIdAndUpdate.mockResolvedValue(mockUserDoc());

            await service.updateProfile('507f1f77bcf86cd799439011', {
                name: 'Only Name',
            });

            const updateArg = mockModel.findByIdAndUpdate.mock.calls[0][1];
            expect(updateArg).toEqual({ 'profile.name': 'Only Name' });
            expect(updateArg).not.toHaveProperty('profile.avatar');
            expect(updateArg).not.toHaveProperty('preferredLang');
        });
    });
});
