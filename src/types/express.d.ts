import type { UserRole } from '../users/user.entity';

declare global {
  namespace Express {
    interface User {
      sub: string;
      phone?: string;
      role: UserRole;
    }

    interface Request {
      user: User;
    }
  }

  type AuthenticatedRequest = import('express').Request & {
    user: Express.User;
  };
}

export {};
