import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const guard = new JwtAuthGuard(reflector as unknown as Reflector);
  const parentPrototype = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
    canActivate: (context: ExecutionContext) => boolean | Promise<boolean>;
  };

  beforeEach(() => {
    reflector.getAllAndOverride.mockReset();
    jest.restoreAllMocks();
  });

  it('allows public endpoints without delegating to passport', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = createContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  it('delegates to passport guard for protected endpoints', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext();
    const superSpy = jest
      .spyOn(parentPrototype, 'canActivate')
      .mockReturnValue(true);

    expect(guard.canActivate(context)).toBe(true);
    expect(superSpy).toHaveBeenCalledWith(context);
  });
});

function createContext(): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;
}
