import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './users.schema';

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>
    ) {}

    findAll() {
        return this.userModel
            .find()
            .select('-passwordHash')
            .lean()
            .exec();
    }

    findById(id: string) {
        return this.userModel
            .findById(id)
            .select('-passwordHash')
            .lean()
            .exec();
    }
}
