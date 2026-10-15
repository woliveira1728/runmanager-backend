import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FilterEventsDto } from './dto/filter-events.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Eventos')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Cadastrar nova corrida de rua (Organizador / Admin)',
    description:
      'Cria um novo evento esportivo vinculando automaticamente modalidades, percursos e lotes de inscrição.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Evento cadastrado com sucesso.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dados inválidos ou data no passado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Acesso negado para o perfil do usuário.',
  })
  async create(
    @CurrentUser('id') organizerId: string,
    @Body() createEventDto: CreateEventDto,
  ) {
    return this.eventsService.create(organizerId, createEventDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar eventos esportivos (Público / Vitrine)',
    description:
      'Retorna a lista de eventos com status PUBLISHED ou filtrados por termo de busca.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de eventos recuperada com sucesso.',
  })
  async findAll(@Query() filterDto: FilterEventsDto) {
    return this.eventsService.findAll(filterDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Get('my-events')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar eventos criados pelo organizador autenticado',
    description:
      'Retorna todos os eventos (rascunhos e publicados) pertencentes ao organizador logado.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Eventos do organizador recuperados com sucesso.',
  })
  async findMyEvents(@CurrentUser('id') organizerId: string) {
    return this.eventsService.findMyEvents(organizerId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obter detalhes de uma corrida de rua por ID (Público)',
    description:
      'Retorna o regulamento, modalidades e lotes de vagas disponíveis de um evento esportivo.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detalhes do evento localizados.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Evento não encontrado.',
  })
  async findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.eventsService.findById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Atualizar dados de um evento esportivo (Organizador / Admin)',
    description:
      'Permite ao organizador proprietário ou administrador alterar título, local e regulamento da prova.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Evento atualizado com sucesso.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Sem permissão para alterar este evento.',
  })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() updateDto: UpdateEventDto,
  ) {
    return this.eventsService.update(id, user.id, user.role, updateDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Patch(':id/publish')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Publicar evento esportivo para abertura de inscrições',
    description:
      'Altera o status do evento de DRAFT para PUBLISHED, tornando-o visível aos atletas.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Evento publicado com sucesso.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Evento sem modalidades ou lotes cadastrados.',
  })
  async publish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.eventsService.publish(id, user.id, user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Excluir evento esportivo sem inscrições (Organizador / Admin)',
    description:
      'Remove o evento esportivo caso nenhum atleta tenha se inscrito previamente.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Evento removido com sucesso.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'O evento já possui inscrições realizadas e não pode ser excluído.',
  })
  async delete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.eventsService.delete(id, user.id, user.role);
  }
}
