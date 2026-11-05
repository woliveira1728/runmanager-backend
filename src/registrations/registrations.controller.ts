import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RegistrationsService } from './registrations.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { CheckInDto } from './dto/check-in.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Inscrições e Check-in')
@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Realizar inscrição em lote de evento esportivo (Atleta)',
    description:
      'Reserva atomicamente uma vaga no lote, valida duplicidade e idade mínima, gerando o número de peito e o hash do QR Code para check-in na arena.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Inscrição confirmada com sucesso.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Perfil incompleto, lote encerrado, idade inferior à permitida ou evento finalizado.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Vagas esgotadas ou inscrição duplicada no mesmo evento.',
  })
  async create(
    @CurrentUser('id') athleteId: string,
    @Body() dto: CreateRegistrationDto,
  ) {
    return this.registrationsService.create(athleteId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-registrations')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar inscrições do atleta autenticado',
    description:
      'Retorna todas as provas em que o atleta logado está inscrito, incluindo número de peito, QR Code e status.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de inscrições do atleta recuperada com sucesso.',
  })
  async findMyRegistrations(@CurrentUser('id') athleteId: string) {
    return this.registrationsService.findMyRegistrations(athleteId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Validar check-in e entrega de kit por QR Code (Organizador / Admin)',
    description:
      'Valida o hash do QR Code na arena, confirma a entrega do kit e registra a presença oficial do atleta na prova.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Check-in realizado com sucesso e kit liberado.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'QR Code não cadastrado no sistema.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Check-in já realizado anteriormente para esta inscrição.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Organizador não possui permissão para gerenciar esta prova.',
  })
  async checkIn(
    @CurrentUser('id') organizerId: string,
    @CurrentUser('role') userRole: Role,
    @Body() dto: CheckInDto,
  ) {
    return this.registrationsService.checkIn(organizerId, userRole, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Get('event/:eventId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar todos os inscritos de um evento (Organizador / Admin)',
    description:
      'Retorna a lista completa de participantes inscritos para exportação ou conferência de arena.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de inscritos do evento recuperada com sucesso.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Acesso negado para organizadores terceiros.',
  })
  async findByEvent(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser('id') organizerId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.registrationsService.findByEvent(
      eventId,
      organizerId,
      userRole,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obter detalhes de uma inscrição específica',
    description:
      'Retorna os dados completos da inscrição para o próprio atleta titular, organizador da prova ou administrador.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Inscrição encontrada com sucesso.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Inscrição não encontrada.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Sem autorização para visualizar inscrições de outros atletas.',
  })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.registrationsService.findById(id, userId, userRole);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Patch(':id/payment-status')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Confirmar ou cancelar manualmente o pagamento de uma inscrição (Organizador / Admin)',
    description:
      'Atualiza o status de pagamento (PENDING, CONFIRMED, CANCELLED) e ajusta transacionalmente a ocupação de vagas do lote.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Status de pagamento atualizado com sucesso.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Status inválido ou inscrição com check-in já realizado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Organizador sem permissão para esta prova.',
  })
  async updatePaymentStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') organizerId: string,
    @CurrentUser('role') userRole: Role,
    @Body() dto: UpdatePaymentStatusDto,
  ) {
    return this.registrationsService.updatePaymentStatus(
      id,
      organizerId,
      userRole,
      dto,
    );
  }
}
