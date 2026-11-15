import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventStatus } from '@prisma/client';
import { CreateModalityDto } from './create-modality.dto';

export class CreateEventDto {
  @ApiProperty({
    description: 'Nome oficial da corrida de rua ou evento esportivo',
    example: '1ª Corrida das Águas de Manaus 2026',
  })
  @IsString({ message: 'O título do evento deve ser uma string.' })
  @IsNotEmpty({ message: 'O título do evento é obrigatório.' })
  @MinLength(3, { message: 'O título deve possuir no mínimo 3 caracteres.' })
  title: string;

  @ApiProperty({
    description: 'Regulamento oficial, orientações técnicas, kit e programação',
    example:
      'Corrida rústica com percursos de 5km e 10km na orla de Ponta Negra. Entrega de kits no dia anterior mediante apresentação de QR Code oficial.',
  })
  @IsString({ message: 'A descrição do evento deve ser uma string.' })
  @IsNotEmpty({ message: 'A descrição ou regulamento é obrigatória.' })
  @MinLength(10, { message: 'A descrição deve possuir no mínimo 10 caracteres.' })
  description: string;

  @ApiProperty({
    description: 'Data e horário oficial da largada (formato ISO8601)',
    example: '2026-11-29T06:00:00.000Z',
  })
  @IsNotEmpty({ message: 'A data do evento é obrigatória.' })
  @IsISO8601(
    { strict: true },
    { message: 'A data do evento deve estar no formato ISO8601 válido.' },
  )
  eventDate: string;

  @ApiProperty({
    description: 'Local de realização da arena, entrega de kits e pórtico de largada/chegada',
    example: 'Complexo Turístico Ponta Negra, Manaus - AM',
  })
  @IsString({ message: 'O local do evento deve ser uma string.' })
  @IsNotEmpty({ message: 'O local do evento é obrigatório.' })
  @MinLength(3, { message: 'O local deve possuir no mínimo 3 caracteres.' })
  location: string;

  @ApiPropertyOptional({
    description: 'Status de publicação do evento',
    enum: EventStatus,
    default: EventStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(EventStatus, { message: 'Status do evento inválido.' })
  status?: EventStatus;

  @ApiProperty({
    description: 'Modalidades e percursos do evento (mínimo de 1 modalidade)',
    type: [CreateModalityDto],
  })
  @IsArray({ message: 'As modalidades devem ser enviadas em uma lista.' })
  @ArrayMinSize(1, {
    message: 'O evento deve possuir no mínimo 1 modalidade/percurso cadastrado.',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateModalityDto)
  modalities: CreateModalityDto[];
}
