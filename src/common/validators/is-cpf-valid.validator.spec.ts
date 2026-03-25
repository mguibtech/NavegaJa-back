import { IsCpfValid, IsCpfValidConstraint } from './is-cpf-valid.validator';

describe('IsCpfValidConstraint', () => {
  const validator = new IsCpfValidConstraint();

  it('accepts optional empty values', () => {
    expect(validator.validate(undefined)).toBe(true);
    expect(validator.validate(null)).toBe(true);
    expect(validator.validate('')).toBe(true);
  });

  it('rejects invalid CPF formats and sequences', () => {
    expect(validator.validate(123)).toBe(false);
    expect(validator.validate('123')).toBe(false);
    expect(validator.validate('111.111.111-11')).toBe(false);
    expect(validator.validate('529.982.247-24')).toBe(false);
  });

  it('accepts valid CPF values with and without punctuation', () => {
    expect(validator.validate('529.982.247-25')).toBe(true);
    expect(validator.validate('52998224725')).toBe(true);
  });

  it('returns a default validation message', () => {
    expect(validator.defaultMessage()).toContain('CPF');
  });
});

describe('IsCpfValid decorator', () => {
  it('registers class-validator metadata without throwing', () => {
    class TestDto {
      cpf: string;
    }

    expect(() => {
      IsCpfValid({ message: 'CPF inválido' })(
        TestDto.prototype as object,
        'cpf',
      );
    }).not.toThrow();
  });
});
