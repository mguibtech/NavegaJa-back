import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: ['boats'],
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async updateProfile(id: string, data: Partial<User>): Promise<User> {
    await this.usersRepo.update(id, data);
    return this.findById(id);
  }

  async updateRating(captainId: string, newRating: number): Promise<void> {
    await this.usersRepo.update(captainId, { rating: newRating });
  }
}
