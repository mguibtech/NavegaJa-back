import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/user.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JWT_REFRESH_SECRET } from './auth.module';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.usersRepo.findOne({ where: { phone: dto.phone } });
    if (exists) {
      throw new ConflictException('Telefone já cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({
      name: dto.name,
      phone: dto.phone,
      passwordHash,
      role: dto.role ?? UserRole.PASSENGER,
    });

    const saved = await this.usersRepo.save(user) as User;
    const tokens = this.generateTokens(saved);

    return {
      user: this.sanitizeUser(saved),
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepo.findOne({ where: { phone: dto.phone } });
    if (!user) {
      throw new UnauthorizedException('Telefone ou senha incorretos');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Telefone ou senha incorretos');
    }

    const tokens = this.generateTokens(user);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: JWT_REFRESH_SECRET,
      });

      const user = await this.usersRepo.findOne({ where: { id: payload.sub } });
      if (!user) {
        throw new UnauthorizedException('Usuário não encontrado');
      }

      const tokens = this.generateTokens(user);
      return tokens;
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }

  async getMe(userId: string) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['boats'],
    });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    return this.sanitizeUser(user);
  }

  private generateTokens(user: User) {
    const tokenPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(tokenPayload);

    const refreshToken = this.jwtService.sign(tokenPayload, {
      secret: JWT_REFRESH_SECRET,
      expiresIn: '30d',
    });

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User) {
    const { passwordHash, ...result } = user;
    return result;
  }
}
