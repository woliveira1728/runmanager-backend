import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EventStatus } from '@prisma/client';

export class FilterEventsDto {
  @ApiPropertyOptional({
    description: 'Filtrar por status do evento',
    enum: EventStatus,
  })
  @IsOptional()
  @IsEnum(EventStatus, { message: 'Status do evento inválido.' })
  status?: EventStatus;

  @ApiPropertyOptional({
    description: 'Buscar por termo no título ou localização da prova',
    example: 'Manaus',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
