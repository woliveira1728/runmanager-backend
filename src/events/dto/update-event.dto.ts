import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { EventStatus } from '@prisma/client';

export class UpdateEventDto {
  @ApiPropertyOptional({
    description: 'Nome oficial da corrida de rua ou evento esportivo',
    example: '1ª Corrida das Águas de Manaus 2026 - Edição Atualizada',
  })
  @IsOptional()
  @IsString({ message: 'O título do evento deve ser uma string.' })
  @MinLength(3, { message: 'O título deve possuir no mínimo 3 caracteres.' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Regulamento oficial, orientações técnicas, kit e programação',
    example: 'Regulamento revisado com novas premiações por faixa etária.',
  })
  @IsOptional()
  @IsString({ message: 'A descrição do evento deve ser uma string.' })
  @MinLength(10, { message: 'A descrição deve possuir no mínimo 10 caracteres.' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Data e horário oficial da largada (formato ISO8601)',
    example: '2026-11-29T06:30:00.000Z',
  })
  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'A data do evento deve estar no formato ISO8601 válido.' },
  )
  eventDate?: string;

  @ApiPropertyOptional({
    description: 'Local de realização da arena e pórtico de largada/chegada',
    example: 'Complexo Turístico Ponta Negra - Anfiteatro, Manaus - AM',
  })
  @IsOptional()
  @IsString({ message: 'O local do evento deve ser uma string.' })
  @MinLength(3, { message: 'O local deve possuir no mínimo 3 caracteres.' })
  location?: string;

  @ApiPropertyOptional({
    description: 'Status do evento',
    enum: EventStatus,
  })
  @IsOptional()
  @IsEnum(EventStatus, { message: 'Status do evento inválido.' })
  status?: EventStatus;
}
