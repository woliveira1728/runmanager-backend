import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ShirtSize } from '@prisma/client';

export class UpdateAthleteProfileDto {
  @ApiPropertyOptional({
    description: 'Tamanho da camiseta para entrega de kit',
    enum: ShirtSize,
    example: ShirtSize.G,
  })
  @IsOptional()
  @IsEnum(ShirtSize, {
    message: 'Tamanho de camiseta inválido. Escolha PP, P, M, G ou GG.',
  })
  shirtSize?: ShirtSize;

  @ApiPropertyOptional({
    description: 'Contato de emergência com DDD válido (Nome e Telefone)',
    example: 'Carlos Oliveira - (92) 99222-3344',
  })
  @IsOptional()
  @IsString()
  @MinLength(3, {
    message: 'O contato de emergência deve ter no mínimo 3 caracteres.',
  })
  emergencyContact?: string;

  @ApiPropertyOptional({
    description:
      'Informações médicas relevantes (alergias, tipo sanguíneo, etc.)',
    example: 'Sem alergias conhecidas. Tipo O+.',
  })
  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @ApiPropertyOptional({
    description:
      'Confirmação do termo de consentimento LGPD para tratamento de dados sensíveis de saúde',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'O consentimento LGPD deve ser um valor booleano.' })
  lgpdConsent?: boolean;
}
