import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
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
    description: 'Contato de emergência (Nome e Telefone)',
    example: 'Carlos Oliveira - (92) 99222-3344',
  })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional({
    description:
      'Informações médicas relevantes (alergias, tipo sanguíneo, etc.)',
    example: 'Sem alergias conhecidas. Tipo O+.',
  })
  @IsOptional()
  @IsString()
  medicalNotes?: string;
}
