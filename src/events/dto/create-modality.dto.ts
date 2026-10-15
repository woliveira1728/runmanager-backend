import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateRegistrationBatchDto } from './create-registration-batch.dto';

export class CreateModalityDto {
  @ApiProperty({
    description: 'Identificação do percurso ou modalidade esportiva',
    example: '5km Corrida de Rua',
  })
  @IsString({ message: 'O nome da modalidade deve ser uma string.' })
  @IsNotEmpty({ message: 'O nome da modalidade é obrigatório.' })
  name: string;

  @ApiPropertyOptional({
    description: 'Idade mínima regulamentar exigida para participação (em anos)',
    example: 14,
    default: 0,
  })
  @IsOptional()
  @IsInt({ message: 'A idade mínima deve ser um número inteiro.' })
  @Min(0, { message: 'A idade mínima não pode ser negativa.' })
  @Type(() => Number)
  minAge?: number;

  @ApiProperty({
    description: 'Lotes de vagas e valores associados a esta modalidade (mínimo 1 lote)',
    type: [CreateRegistrationBatchDto],
  })
  @IsArray({ message: 'Os lotes devem ser informados em uma lista.' })
  @ArrayMinSize(1, {
    message: 'A modalidade deve possuir no mínimo 1 lote de inscrições configurado.',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateRegistrationBatchDto)
  batches: CreateRegistrationBatchDto[];
}
