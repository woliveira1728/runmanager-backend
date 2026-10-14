import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';
import { CreateAthleteProfileDto } from './create-athlete-profile.dto';

export class CreateUserDto {
  @ApiProperty({
    description: 'Nome completo do usuário',
    example: 'Wilson Dias de Oliveira',
  })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  @MinLength(2, { message: 'O nome deve ter no mínimo 2 caracteres.' })
  name: string;

  @ApiProperty({
    description: 'Endereço de e-mail (usado para autenticação)',
    example: 'woliveira1728@rede.ulbra.br',
  })
  @IsEmail({}, { message: 'Formato de e-mail inválido.' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  email: string;

  @ApiProperty({
    description: 'Senha de acesso (mínimo de 6 caracteres)',
    example: 'senhaForte@2026',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'A senha deve possuir no mínimo 6 caracteres.' })
  password: string;

  @ApiPropertyOptional({
    description: 'Perfil de permissão no sistema (RBAC)',
    enum: Role,
    default: Role.ATHLETE,
    example: Role.ATHLETE,
  })
  @IsOptional()
  @IsEnum(Role, { message: 'Papel de usuário inválido.' })
  role?: Role;

  @ApiPropertyOptional({
    description:
      'Dados complementares do perfil do atleta (obrigatório se perfil for ATHLETE)',
    type: CreateAthleteProfileDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAthleteProfileDto)
  athleteProfile?: CreateAthleteProfileDto;
}
