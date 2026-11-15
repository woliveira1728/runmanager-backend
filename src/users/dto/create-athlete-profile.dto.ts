import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { Gender, ShirtSize } from '@prisma/client';
import { IsValidCpf } from '../../common/validators/cpf.validator';

export class CreateAthleteProfileDto {
  @ApiProperty({
    description: 'CPF do atleta (apenas números ou com pontuação)',
    example: '123.456.789-09',
  })
  @IsString()
  @IsNotEmpty({ message: 'O CPF é obrigatório.' })
  @Matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, {
    message: 'CPF em formato inválido. Use 11 dígitos ou 000.000.000-00',
  })
  @IsValidCpf()
  cpf: string;

  @ApiProperty({
    description: 'Data de nascimento do atleta (formato AAAA-MM-DD)',
    example: '1995-05-20',
  })
  @IsNotEmpty({ message: 'A data de nascimento é obrigatória.' })
  @IsISO8601(
    { strict: true },
    {
      message:
        'A data de nascimento deve estar em formato ISO válido (AAAA-MM-DD).',
    },
  )
  birthDate: string;

  @ApiProperty({
    description: 'Gênero biológico para categorização de prova',
    enum: Gender,
    example: Gender.M,
  })
  @IsEnum(Gender, {
    message: 'Gênero inválido. Escolha M, F ou OUTRO.',
  })
  gender: Gender;

  @ApiProperty({
    description: 'Tamanho da camiseta para entrega de kit',
    enum: ShirtSize,
    example: ShirtSize.M,
  })
  @IsEnum(ShirtSize, {
    message: 'Tamanho de camiseta inválido. Escolha PP, P, M, G ou GG.',
  })
  shirtSize: ShirtSize;

  @ApiProperty({
    description: 'Contato de emergência (Nome e Telefone)',
    example: 'Maria Oliveira - (92) 98111-2233',
  })
  @IsString()
  @IsNotEmpty({ message: 'O contato de emergência é obrigatório.' })
  emergencyContact: string;

  @ApiPropertyOptional({
    description:
      'Informações médicas relevantes (alergias, tipo sanguíneo, etc.)',
    example: 'Alérgico a dipirona. Hipertenso leve.',
  })
  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @ApiProperty({
    description: 'Consentimento formal LGPD para tratamento de dados sensíveis',
    example: true,
  })
  @IsBoolean({ message: 'O consentimento LGPD deve ser um booleano.' })
  lgpdConsent: boolean;
}
