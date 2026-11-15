import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

export class UpdatePaymentStatusDto {
  @ApiProperty({
    enum: PaymentStatus,
    example: PaymentStatus.CONFIRMED,
    description:
      'Novo status de pagamento da inscrição (PENDING, CONFIRMED ou CANCELLED)',
  })
  @IsNotEmpty({ message: 'O status de pagamento é obrigatório.' })
  @IsEnum(PaymentStatus, {
    message:
      'Status de pagamento inválido. Valores permitidos: PENDING, CONFIRMED, CANCELLED.',
  })
  paymentStatus!: PaymentStatus;
}
