import { Repository } from 'typeorm';
import { PaymentMethodsService } from './payment-methods.service';
import { CardBrand, PaymentMethod } from './payment-method.entity';

describe('PaymentMethodsService', () => {
  const createRepo = () => ({
    find: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    create: jest.fn((value: Partial<PaymentMethod>) => value as PaymentMethod),
    save: jest.fn((value: PaymentMethod) => Promise.resolve(value)),
    findOne: jest.fn(),
    delete: jest.fn(),
  });

  it('lists cards ordered by default flag and creation date', async () => {
    const repo = createRepo();
    repo.find.mockResolvedValue([{ id: 'card-1' }]);
    const service = new PaymentMethodsService(
      repo as unknown as Repository<PaymentMethod>,
    );

    const result = await service.findAll('user-1');

    expect(result).toEqual([{ id: 'card-1' }]);
    expect(repo.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  });

  it('rejects expired cards during creation', async () => {
    const repo = createRepo();
    const service = new PaymentMethodsService(
      repo as unknown as Repository<PaymentMethod>,
    );

    await expect(
      service.create('user-1', {
        type: 'credit_card',
        cardNumber: '4111111111111111',
        holderName: 'Jane Doe',
        expiryMonth: 1,
        expiryYear: 2000,
      } as never),
    ).rejects.toMatchObject({
      response: { message: 'Cartão expirado' },
    });
  });

  it('rejects creation when the card limit is reached', async () => {
    const repo = createRepo();
    repo.count.mockResolvedValue(5);
    const service = new PaymentMethodsService(
      repo as unknown as Repository<PaymentMethod>,
    );

    await expect(
      service.create('user-1', {
        type: 'credit_card',
        cardNumber: '4111111111111111',
        holderName: 'Jane Doe',
        expiryMonth: 12,
        expiryYear: 2099,
      } as never),
    ).rejects.toMatchObject({
      response: { message: 'Limite de 5 cartões atingido' },
    });
  });

  it('creates a first card as default and normalizes holder name/brand', async () => {
    const repo = createRepo();
    repo.count.mockResolvedValue(0);
    const service = new PaymentMethodsService(
      repo as unknown as Repository<PaymentMethod>,
    );

    const saved = await service.create('user-1', {
      type: 'credit_card',
      cardNumber: '4111111111111111',
      holderName: '  jane doe  ',
      expiryMonth: 12,
      expiryYear: 2099,
    } as never);

    expect(repo.update).toHaveBeenCalledWith(
      { userId: 'user-1' },
      { isDefault: false },
    );
    expect(saved).toMatchObject({
      userId: 'user-1',
      brand: CardBrand.VISA,
      last4: '1111',
      holderName: 'JANE DOE',
      isDefault: true,
    });
  });

  it('detects AMEX and keeps non-default when explicitly requested', async () => {
    const repo = createRepo();
    repo.count.mockResolvedValue(2);
    const service = new PaymentMethodsService(
      repo as unknown as Repository<PaymentMethod>,
    );

    const saved = await service.create('user-1', {
      type: 'credit_card',
      cardNumber: '341111111111111',
      holderName: 'John Doe',
      expiryMonth: 12,
      expiryYear: 2099,
      setAsDefault: false,
    } as never);

    expect(repo.update).not.toHaveBeenCalled();
    expect(saved).toMatchObject({
      brand: CardBrand.AMEX,
      isDefault: false,
    });
  });

  it('updates default card when ownership is valid', async () => {
    const repo = createRepo();
    repo.findOne
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
      })
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        isDefault: true,
      });
    const service = new PaymentMethodsService(
      repo as unknown as Repository<PaymentMethod>,
    );

    const result = await service.setDefault('card-1', 'user-1');

    expect(repo.update).toHaveBeenNthCalledWith(
      1,
      { userId: 'user-1' },
      { isDefault: false },
    );
    expect(repo.update).toHaveBeenNthCalledWith(2, 'card-1', {
      isDefault: true,
    });
    expect(result).toMatchObject({ id: 'card-1', isDefault: true });
  });

  it('rejects setDefault for missing card or wrong owner', async () => {
    const repo = createRepo();
    const service = new PaymentMethodsService(
      repo as unknown as Repository<PaymentMethod>,
    );

    repo.findOne.mockResolvedValueOnce(null);
    await expect(service.setDefault('missing', 'user-1')).rejects.toMatchObject(
      {
        response: { message: 'Cartão não encontrado' },
      },
    );

    repo.findOne.mockResolvedValueOnce({ id: 'card-2', userId: 'other-user' });
    await expect(service.setDefault('card-2', 'user-1')).rejects.toMatchObject({
      response: { message: 'Este cartão não pertence a você' },
    });
  });

  it('removes a default card and promotes the next one', async () => {
    const repo = createRepo();
    repo.findOne
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        isDefault: true,
      })
      .mockResolvedValueOnce({
        id: 'card-2',
        userId: 'user-1',
      });
    const service = new PaymentMethodsService(
      repo as unknown as Repository<PaymentMethod>,
    );

    await service.remove('card-1', 'user-1');

    expect(repo.delete).toHaveBeenCalledWith('card-1');
    expect(repo.update).toHaveBeenCalledWith('card-2', { isDefault: true });
  });

  it('removes a non-default card without promotion', async () => {
    const repo = createRepo();
    repo.findOne.mockResolvedValueOnce({
      id: 'card-3',
      userId: 'user-1',
      isDefault: false,
    });
    const service = new PaymentMethodsService(
      repo as unknown as Repository<PaymentMethod>,
    );

    await service.remove('card-3', 'user-1');

    expect(repo.delete).toHaveBeenCalledWith('card-3');
    expect(repo.update).not.toHaveBeenCalled();
  });
});
