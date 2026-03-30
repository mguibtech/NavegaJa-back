import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { KycStatus, User, UserRole } from '../users/user.entity';
import { ensureReferralCode } from '../users/referral-code.util';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { MailService } from '../mail/mail.service';
import { GamificationService } from '../gamification/gamification.service';
import { JwtPayload } from './jwt-payload';

function getRequiredSecret(config: ConfigService, key: string): string {
  const value = config.get<string>(key);

  if (!value) {
    throw new Error(`Environment variable ${key} is required.`);
  }

  return value;
}

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
    this.refreshSecret = getRequiredSecret(config, 'JWT_REFRESH_SECRET');
  }

  async register(dto: RegisterDto) {
    const exists = await this.usersRepo.findOne({
      where: { phone: dto.phone },
    });
    if (exists) {
      throw new ConflictException('Telefone já cadastrado');
    }

    if (dto.cpf) {
      const cpfExists = await this.usersRepo.findOne({
        where: { cpf: dto.cpf },
      });
      if (cpfExists) {
        throw new ConflictException('CPF já cadastrado');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      cpf: dto.cpf,
      passwordHash,
      role: UserRole.PASSENGER, // app mobile cria sempre passageiro
      city: dto.city,
      state: dto.state ?? 'AM',
      gender: dto.gender ?? null,
    });

    const saved = await this.usersRepo.save(user);

    await ensureReferralCode(this.usersRepo, saved);

    // Processa indicação se informada
    if (dto.referralCode) {
      await this.gamificationService.processReferral(
        dto.referralCode,
        saved.id,
      );
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

    await ensureReferralCode(this.usersRepo, user);
    const tokens = this.generateTokens(user);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * Login Web (Dashboard Admin) - Por EMAIL
   * APENAS ADMIN tem acesso ao dashboard web
   */
  async loginWeb(dto: { email: string; password: string }) {
    const user = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }

    // ✅ Apenas admin e boat_manager acedem ao dashboard web
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.BOAT_MANAGER) {
      throw new UnauthorizedException(
        'Acesso restrito a administradores e gestores de embarcação',
      );
    }

    await ensureReferralCode(this.usersRepo, user);
    const tokens = this.generateTokens(user);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
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
    await ensureReferralCode(this.usersRepo, user);
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
      throw new BadRequestException(
        'Nenhum código de recuperação foi solicitado',
      );
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
    const { passwordHash, resetCode, resetCodeExpires, ...result } = user;
    void passwordHash;
    void resetCode;
    void resetCodeExpires;
    return {
      ...result,
      capabilities: this.buildCapabilities(user),
    };
  }

  /**
   * Informa ao app o que o utilizador pode fazer.
   * Para passageiros e admin devolve null — sem restrições relevantes no lado do cliente.
   * Para capitães expõe o estado de verificação e os bloqueios activos.
   */
  private buildCapabilities(user: User) {
    if (user.role === UserRole.CAPTAIN) {
      const isVerified = user.isVerified ?? false;
      const pendingVerification =
        user.kycStatus === KycStatus.PENDING ||
        user.kycStatus === KycStatus.UNDER_REVIEW ||
        (!isVerified && (!!user.licensePhotoUrl || !!user.certificatePhotoUrl));

      return {
        isVerified,
        pendingVerification,
        canOperate: isVerified,
        canCreateTrips: isVerified,
        canConfirmPayments: isVerified,
        canManageShipments: isVerified,
      };
    }

    if (user.role === UserRole.BOAT_MANAGER) {
      // Permissões base — as permissões por barco são verificadas na API via BoatStaffService
      return {
        isBoatManager: true,
        canCreateTrips: true,
        canConfirmPayments: true,
        canManageShipments: true,
      };
    }

    return null;
  }
}
