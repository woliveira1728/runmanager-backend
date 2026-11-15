import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FilterEventsDto } from './dto/filter-events.dto';
import { EventStatus, Role } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria um novo evento esportivo com suas modalidades e lotes de inscrição.
   */
  async create(organizerId: string, dto: CreateEventDto) {
    const eventDate = new Date(dto.eventDate);
    const now = new Date();

    if (isNaN(eventDate.getTime())) {
      throw new BadRequestException('Data do evento inválida.');
    }

    if (eventDate <= now) {
      throw new BadRequestException(
        'A data de realização do evento deve ser no futuro.',
      );
    }

    // Validação de datas dos lotes
    for (const modality of dto.modalities) {
      for (const batch of modality.batches) {
        const batchEndDate = new Date(batch.endDate);
        if (isNaN(batchEndDate.getTime())) {
          throw new BadRequestException(
            `Data limite inválida para o lote ${batch.batchNumber} da modalidade "${modality.name}".`,
          );
        }
        if (batchEndDate > eventDate) {
          throw new BadRequestException(
            `O encerramento do lote ${batch.batchNumber} não pode ultrapassar a data da largada da prova.`,
          );
        }
      }
    }

    return this.prisma.event.create({
      data: {
        organizerId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        eventDate,
        location: dto.location.trim(),
        status: dto.status ?? EventStatus.DRAFT,
        modalities: {
          create: dto.modalities.map((mod) => ({
            name: mod.name.trim(),
            minAge: mod.minAge ?? 0,
            registrationBatches: {
              create: mod.batches.map((batch) => ({
                batchNumber: batch.batchNumber,
                price: batch.price,
                maxSlots: batch.maxSlots,
                endDate: new Date(batch.endDate),
              })),
            },
          })),
        },
      },
      include: {
        modalities: {
          include: {
            registrationBatches: {
              orderBy: { batchNumber: 'asc' },
            },
          },
        },
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Lista eventos para visualização pública ou filtrada.
   */
  async findAll(filter?: FilterEventsDto) {
    const where: any = {};

    if (filter?.status) {
      where.status = filter.status;
    } else {
      // Por padrão em consultas públicas, exibe eventos publicados
      where.status = EventStatus.PUBLISHED;
    }

    if (filter?.search) {
      const search = filter.search.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.event.findMany({
      where,
      orderBy: { eventDate: 'asc' },
      include: {
        modalities: {
          include: {
            registrationBatches: {
              orderBy: { batchNumber: 'asc' },
            },
          },
        },
        organizer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Busca um evento detalhado por ID.
   */
  async findById(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        modalities: {
          include: {
            registrationBatches: {
              orderBy: { batchNumber: 'asc' },
            },
          },
        },
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado.');
    }

    return event;
  }

  /**
   * Lista todos os eventos cadastrados pelo organizador logado.
   */
  async findMyEvents(organizerId: string) {
    return this.prisma.event.findMany({
      where: { organizerId },
      orderBy: { createdAt: 'desc' },
      include: {
        modalities: {
          include: {
            registrationBatches: {
              orderBy: { batchNumber: 'asc' },
            },
          },
        },
      },
    });
  }

  /**
   * Atualiza dados de um evento (restrito ao organizador dono ou ADMIN).
   */
  async update(
    id: string,
    userId: string,
    userRole: Role,
    dto: UpdateEventDto,
  ) {
    const event = await this.findById(id);

    if (event.organizerId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar este evento.',
      );
    }

    const dataToUpdate: any = {};

    if (dto.title) dataToUpdate.title = dto.title.trim();
    if (dto.description) dataToUpdate.description = dto.description.trim();
    if (dto.location) dataToUpdate.location = dto.location.trim();
    if (dto.status) dataToUpdate.status = dto.status;

    if (dto.eventDate) {
      const newDate = new Date(dto.eventDate);
      if (isNaN(newDate.getTime()) || newDate <= new Date()) {
        throw new BadRequestException(
          'A nova data do evento deve estar no futuro.',
        );
      }
      dataToUpdate.eventDate = newDate;
    }

    return this.prisma.event.update({
      where: { id },
      data: dataToUpdate,
      include: {
        modalities: {
          include: {
            registrationBatches: true,
          },
        },
      },
    });
  }

  /**
   * Publica o evento tornando-o visível aos atletas para inscrições.
   */
  async publish(id: string, userId: string, userRole: Role) {
    const event = await this.findById(id);

    if (event.organizerId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para publicar este evento.',
      );
    }

    if (!event.modalities || event.modalities.length === 0) {
      throw new BadRequestException(
        'O evento deve possuir ao menos uma modalidade configurada para ser publicado.',
      );
    }

    const hasBatches = event.modalities.some(
      (m) => m.registrationBatches && m.registrationBatches.length > 0,
    );
    if (!hasBatches) {
      throw new BadRequestException(
        'O evento deve possuir ao menos um lote de inscrições configurado para ser publicado.',
      );
    }

    return this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.PUBLISHED },
    });
  }

  /**
   * Remove um evento caso ainda não possua inscrições associadas.
   */
  async delete(id: string, userId: string, userRole: Role) {
    const event = await this.findById(id);

    if (event.organizerId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para remover este evento.',
      );
    }

    const hasRegistrations = await this.prisma.registration.findFirst({
      where: { batch: { modality: { eventId: id } } },
    });

    if (hasRegistrations) {
      throw new ConflictException(
        'Não é possível excluir um evento que já possui inscrições de atletas realizadas.',
      );
    }

    return this.prisma.event.delete({
      where: { id },
    });
  }
}
