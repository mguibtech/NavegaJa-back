import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  beforeEach(() => {
    reflector.getAllAndOverride.mockReset();
  });

  it('allows requests when no roles metadata is defined', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('rejects requests without an authenticated user when roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    expect(guard.canActivate(createContext(undefined))).toBe(false);
  });

  it('allows only users whose role matches the required metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'boat_manager']);

    expect(guard.canActivate(createContext({ role: 'boat_manager' }))).toBe(
      true,
    );
    expect(guard.canActivate(createContext({ role: 'captain' }))).toBe(false);
  });
});

function createContext(user?: { role: string }): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}
