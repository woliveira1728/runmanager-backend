import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AuthenticatedUserDto {
  @ApiProperty({ example: 'b947c69a-6c17-47b2-bd74-4b4458db4c5b' })
  id: string;

  @ApiProperty({ example: 'Wilson Dias de Oliveira' })
  name: string;

  @ApiProperty({ example: 'woliveira1728@rede.ulbra.br' })
  email: string;

  @ApiProperty({ enum: Role, example: Role.ATHLETE })
  role: Role;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'Token JWT de acesso (Bearer)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({ type: AuthenticatedUserDto })
  user: AuthenticatedUserDto;
}
