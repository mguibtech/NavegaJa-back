import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsCpfValid', async: false })
export class IsCpfValidConstraint implements ValidatorConstraintInterface {
  validate(cpf: unknown): boolean {
    if (cpf === null || cpf === undefined || cpf === '') return true; // deixar @IsOptional() cuidar da ausência

    if (typeof cpf !== 'string') return false;

    // Remove pontos e traço
    const cleaned = cpf.replace(/[.\-]/g, '');

    // Deve ter exatamente 11 dígitos
    if (!/^\d{11}$/.test(cleaned)) return false;

    // Rejeita sequências iguais (ex: 111.111.111-11)
    if (/^(\d)\1{10}$/.test(cleaned)) return false;

    // Primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned[i]) * (10 - i);
    }
    let remainder = sum % 11;
    const digit1 = remainder < 2 ? 0 : 11 - remainder;
    if (parseInt(cleaned[9]) !== digit1) return false;

    // Segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleaned[i]) * (11 - i);
    }
    remainder = sum % 11;
    const digit2 = remainder < 2 ? 0 : 11 - remainder;
    if (parseInt(cleaned[10]) !== digit2) return false;

    return true;
  }

  defaultMessage(): string {
    return 'CPF inválido. Informe um CPF válido no formato 000.000.000-00 ou apenas os 11 dígitos.';
  }
}

export function IsCpfValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCpfValidConstraint,
    });
  };
}
