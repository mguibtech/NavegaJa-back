import type { UserRole } from '../users/user.entity';

export interface JwtPayload {
  sub: string;
  phone?: string;
  role: UserRole;
}
