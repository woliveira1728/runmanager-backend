import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export const TIME_HHMMSS_REGEX = /^\d{2}:[0-5]\d:[0-5]\d$/;

export class RecordSingleResultDto {
  @ApiProperty({
    example: 101,
    description: 'Número de peito do atleta inscrito na prova',
  })
  @Type(() => Number)
  @IsInt({ message: 'O número de peito deve ser um número inteiro.' })
  @Min(1, { message: 'O número de peito deve ser maior ou igual a 1.' })
  bibNumber!: number;

  @ApiProperty({
    example: '00:24:45',
    description: 'Tempo bruto oficial no formato HH:MM:SS',
  })
  @IsNotEmpty({ message: 'O tempo bruto é obrigatório.' })
  @IsString()
  @Matches(TIME_HHMMSS_REGEX, {
    message:
      'Exceção 7B: Formato de tempo bruto inválido. Utilize o padrão HH:MM:SS (ex: 00:24:45).',
  })
  grossTime!: string;

  @ApiProperty({
    example: '00:24:12',
    description: 'Tempo líquido oficial no formato HH:MM:SS',
  })
  @IsNotEmpty({ message: 'O tempo líquido é obrigatório.' })
  @IsString()
  @Matches(TIME_HHMMSS_REGEX, {
    message:
      'Exceção 7B: Formato de tempo líquido inválido. Utilize o padrão HH:MM:SS (ex: 00:24:12).',
  })
  netTime!: string;
}

export class ImportResultsDto {
  @ApiPropertyOptional({
    example: 'bib_number,gross_time,net_time\n101,00:24:45,00:24:12',
    description:
      'Conteúdo texto em formato CSV com colunas bib_number, gross_time e net_time',
  })
  @IsOptional()
  @IsString()
  csvContent?: string;

  @ApiPropertyOptional({
    type: [RecordSingleResultDto],
    description: 'Lista estruturada de tempos a importar em lote',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordSingleResultDto)
  items?: RecordSingleResultDto[];

  @ApiPropertyOptional({
    example: false,
    description:
      'Quando true, ignora números de peito inexistentes (Exceção 7A) e importa apenas os atletas válidos confirmados no evento',
  })
  @IsOptional()
  @IsBoolean()
  ignoreInvalidBibs?: boolean;
}
