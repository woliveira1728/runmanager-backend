import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateRegistrationDto {
  @ApiProperty({
    description: 'ID único (UUIDv4) do lote de inscrição selecionado',
    example: 'd9b2d63d-a233-4123-8472-bb798f029b31',
  })
  @IsUUID('4', { message: 'ID do lote de inscrição deve ser um UUID válido.' })
  @IsNotEmpty({ message: 'O ID do lote de inscrição é obrigatório.' })
  batchId: string;
}
