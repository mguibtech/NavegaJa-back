import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

/**
 * Dono da inicialização do firebase-admin.
 *
 * O NotificationsService já inicializava o SDK por conta própria para o FCM.
 * Ambos procuram o app '[DEFAULT]' antes de criar, então convivem sem
 * inicializar duas vezes, independente de qual módulo suba primeiro. A
 * intenção é migrar o NotificationsService para depender deste serviço quando
 * houver uma janela sem trabalho concorrente naquele arquivo.
 */
@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: admin.app.App | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');

    if (!projectId || !privateKey || !clientEmail) {
      this.logger.warn(
        'Credenciais Firebase incompletas — login por OTP desativado',
      );
      return;
    }

    try {
      this.app =
        admin.apps.find((a) => a?.name === '[DEFAULT]') ||
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey: privateKey.replace(/\\n/g, '\n'),
            clientEmail,
          }),
        });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Erro ao inicializar Firebase Admin: ${message}`);
    }
  }

  get isEnabled(): boolean {
    return this.app !== null;
  }

  /**
   * Verifica um ID token emitido pelo Firebase Authentication.
   *
   * Devolve null quando o SDK não está configurado ou quando o token é
   * inválido/expirado — quem chama decide qual erro HTTP faz sentido, para não
   * vazar detalhe de verificação para o cliente.
   */
  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken | null> {
    if (!this.app) {
      return null;
    }

    try {
      // checkRevoked evita aceitar token de sessão que já foi revogada no
      // console (ex.: usuário desativado depois de o token ser emitido).
      return await this.app.auth().verifyIdToken(idToken, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(`ID token rejeitado: ${message}`);
      return null;
    }
  }
}
