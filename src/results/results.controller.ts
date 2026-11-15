import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ResultsService } from './results.service';
import {
  ImportResultsDto,
  RecordSingleResultDto,
} from './dto/record-result.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Role } from '@prisma/client';

@ApiTags('Resultados e Tempos Oficiais (UC07)')
@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post('event/:eventId/manual')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Registrar ou atualizar individualmente o tempo oficial de um atleta pelo número de peito (UC07)',
    description:
      'Valida o formato HH:MM:SS (Exceção 7B), verifica a existência do número de peito confirmado na prova (Exceção 7A) e recalcula as posições geral e por faixa etária.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tempo oficial registrado e classificação recalculada.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Exceção 7B: Formato de tempo inválido ou líquido > bruto.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Exceção 7A: Número de peito não encontrado no evento.',
  })
  async recordSingleResult(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser('id') organizerId: string,
    @CurrentUser('role') userRole: Role,
    @Body() dto: RecordSingleResultDto,
  ) {
    return this.resultsService.recordSingleResult(
      eventId,
      organizerId,
      userRole,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post('event/:eventId/import')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Importar tempos oficiais em lote via CSV ou lista estruturada (UC07)',
    description:
      'Processa arquivo CSV (bib_number,gross_time,net_time), valida formato HH:MM:SS (Exceção 7B), reporta números de peito inexistentes (Exceção 7A) e atualiza o ranking.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Resultados importados e classificações atualizadas.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Exceção 7A (números de peito inválidos pendentes de confirmação) ou Exceção 7B (formato de tempo inválido).',
  })
  async importResults(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser('id') organizerId: string,
    @CurrentUser('role') userRole: Role,
    @Body() dto: ImportResultsDto,
  ) {
    return this.resultsService.importResults(
      eventId,
      organizerId,
      userRole,
      dto,
    );
  }

  @Public()
  @Get('event/:eventId')
  @ApiOperation({
    summary: 'Listar resultados oficiais e classificação de um evento',
    description:
      'Retorna a classificação oficial do evento ordenada por tempo líquido, com desempate por tempo bruto e posição por faixa etária.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de resultados oficiais recuperada com sucesso.',
  })
  async findByEvent(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.resultsService.findByEvent(eventId);
  }
}
