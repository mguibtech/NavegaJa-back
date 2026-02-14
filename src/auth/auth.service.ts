import { Injectable, UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User, UserRole } from '../users/user.entity';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import { MailService } from '../mail/mail.service';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class AuthService {
  private readonly refreshSecret: string;

  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private jwtService: JwtService,
    private mailService: MailService,
    private gamificationService: GamificationService,
    config: ConfigService,
  ) {
    this.refreshSecret = config.get('JWT_REFRESH_SECRET', 'navegaja-refresh-secret-2026');
  }

  async register(dto: RegisterDto) {
    const exists = await this.usersRepo.findOne({ where: { phone: dto.phone } });
    if (exists) {
      throw new ConflictException('Telefone já cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      cpf: dto.cpf,
      passwordHash,
      role: dto.role ?? UserRole.PASSENGER,
    });

    const saved = await this.usersRepo.save(user) as User;

    // Gera código de indicação
    const referralCode = `NVJ-${saved.id.substring(0, 6).toUpperCase()}`;
    await this.usersRepo.update(saved.id, { referralCode });
    saved.referralCode = referralCode;

    // Processa indicação se informada
    if (dto.referralCode) {
      await this.gamificationService.processReferral(dto.referralCode, saved.id);
    }

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
        secret: this.refreshSecret,
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

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException('Nenhuma conta encontrada com este e-mail');
    }

    const code = crypto.randomInt(100000, 999999).toString();
    user.resetCode = code;
    user.resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    await this.usersRepo.save(user);

    await this.mailService.sendResetCode(dto.email, code);

    return { message: 'Código de recuperação enviado para o e-mail' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException('Nenhuma conta encontrada com este e-mail');
    }

    if (!user.resetCode || !user.resetCodeExpires) {
      throw new BadRequestException('Nenhum código de recuperação foi solicitado');
    }

    if (new Date() > user.resetCodeExpires) {
      throw new BadRequestException('Código expirado. Solicite um novo código');
    }

    if (user.resetCode !== dto.code) {
      throw new BadRequestException('Código inválido');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.resetCode = null;
    user.resetCodeExpires = null;
    await this.usersRepo.save(user);

    return { message: 'Senha alterada com sucesso' };
  }

  private generateTokens(user: User) {
    const tokenPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(tokenPayload);

    const refreshToken = this.jwtService.sign(tokenPayload, {
      secret: this.refreshSecret,
      expiresIn: '30d',
    });

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User) {
    const { passwordHash, ...result } = user;
    return result;
  }
}
