import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CheckInDto {
  @ApiProperty({
    description: 'Hash criptográfico do QR Code impresso no comprovante do atleta',
    example: 'RM-A39DF81C024E40E5B18D3C4F817A29B0',
  })
  @IsString({ message: 'O hash do QR Code deve ser uma string.' })
  @IsNotEmpty({ message: 'O hash do QR Code é obrigatório para check-in.' })
  qrCodeHash: string;
}
