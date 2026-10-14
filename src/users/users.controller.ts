import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateAthleteProfileDto } from './dto/update-athlete-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Usuários')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cadastrar novo usuário / atleta',
    description:
      'Cria uma nova conta no sistema validando duplicidade de e-mail e CPF, criptografando dados médicos (LGPD) e gerando hash seguro de senha.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Usuário cadastrado com sucesso.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'E-mail ou CPF já cadastrado no sistema.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dados inválidos ou falta de consentimento LGPD.',
  })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obter dados do usuário autenticado',
    description:
      'Retorna as informações de cadastro e perfil do atleta do usuário logado (com dados sensíveis descriptografados para o titular).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dados do perfil recuperados com sucesso.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Token de autenticação não fornecido ou expirado.',
  })
  async getMe(@CurrentUser('id') userId: string) {
    return this.usersService.findById(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/profile')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Atualizar dados de perfil do atleta autenticado',
    description:
      'Permite atualizar tamanho da camiseta, contato de emergência e notas médicas com nova criptografia.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Perfil atualizado com sucesso.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Perfil de atleta não encontrado.',
  })
  async updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body() updateDto: UpdateAthleteProfileDto,
  ) {
    return this.usersService.updateAthleteProfile(userId, updateDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.ORGANIZER)
  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Buscar usuário por ID (Admin / Organizador)',
    description:
      'Permite que administradores ou organizadores visualizem informações de um usuário específico.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usuário localizado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Acesso negado para o perfil do usuário logado.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Usuário não encontrado.',
  })
  async getById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
