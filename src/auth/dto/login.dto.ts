import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'E-mail cadastrado do usuário',
    example: 'woliveira1728@rede.ulbra.br',
  })
  @IsEmail({}, { message: 'Formato de e-mail inválido.' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  email: string;

  @ApiProperty({
    description: 'Senha de acesso',
    example: 'senhaForte@2026',
  })
  @IsString()
  @MinLength(6, { message: 'A senha deve possuir no mínimo 6 caracteres.' })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  password: string;
}
