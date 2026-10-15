import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRegistrationBatchDto {
  @ApiProperty({
    description: 'Número sequencial do lote de inscrições (1, 2, 3...)',
    example: 1,
    minimum: 1,
  })
  @IsInt({ message: 'O número do lote deve ser um número inteiro.' })
  @Min(1, { message: 'O lote deve ser no mínimo 1.' })
  @Type(() => Number)
  batchNumber: number;

  @ApiProperty({
    description: 'Valor da taxa de inscrição em reais (BRL)',
    example: 85.0,
    minimum: 0,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'O preço deve ser um número com até 2 casas decimais.' },
  )
  @Min(0, { message: 'O valor da inscrição não pode ser negativo.' })
  @Type(() => Number)
  price: number;

  @ApiProperty({
    description: 'Capacidade máxima de vagas disponíveis neste lote',
    example: 250,
    minimum: 1,
  })
  @IsInt({ message: 'A quantidade de vagas deve ser um número inteiro.' })
  @Min(1, { message: 'O lote deve possuir no mínimo 1 vaga disponível.' })
  @Type(() => Number)
  maxSlots: number;

  @ApiProperty({
    description: 'Data limite para encerramento ou virada deste lote (formato ISO8601)',
    example: '2026-11-20T23:59:59.000Z',
  })
  @IsNotEmpty({ message: 'A data de encerramento do lote é obrigatória.' })
  @IsISO8601(
    { strict: true },
    { message: 'A data limite do lote deve estar no formato ISO8601 válido.' },
  )
  endDate: string;
}
