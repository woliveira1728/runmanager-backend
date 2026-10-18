import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { CheckInDto } from './dto/check-in.dto';
import { EventStatus, PaymentStatus, Role } from '@prisma/client';
import { randomBytes } from 'node:crypto';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Realiza a inscrição atômica de um atleta em um lote de prova esportiva (UC05).
   * Controla vagas com transação no banco, gera hash exclusivo para QR Code e número de peito.
   */
  async create(athleteId: string, dto: CreateRegistrationDto) {
    // 1. Verifica se o usuário possui perfil de atleta cadastrado
    const user = await this.prisma.user.findUnique({
      where: { id: athleteId },
      include: { athleteProfile: true },
    });

    if (!user || !user.athleteProfile) {
      throw new BadRequestException(
        'É necessário possuir um perfil de atleta com CPF e dados esportivos cadastrados para realizar a inscrição.',
      );
    }

    // 2. Busca o lote de inscrição e a modalidade/evento vinculados
    const batch = await this.prisma.registrationBatch.findUnique({
      where: { id: dto.batchId },
      include: {
        modality: {
          include: {
            event: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Lote de inscrição não encontrado.');
    }

    const event = batch.modality.event;

    // 3. Validação do status e data da prova
    if (event.status !== EventStatus.PUBLISHED) {
      throw new BadRequestException(
        'As inscrições para este evento esportivo não estão abertas.',
      );
    }

    const now = new Date();
    if (event.eventDate <= now) {
      throw new BadRequestException('Este evento esportivo já foi realizado.');
    }

    // 4. Validação de prazo e disponibilidade do lote
    if (batch.endDate < now) {
      throw new BadRequestException(
        'O prazo limite deste lote de inscrição já foi encerrado.',
      );
    }

    if (batch.filledSlots >= batch.maxSlots) {
      throw new ConflictException(
        'Vagas esgotadas para este lote de inscrição.',
      );
    }

    // 5. Validação de idade mínima regulamentar
    const birthDate = new Date(user.athleteProfile.birthDate);
    const eventDate = new Date(event.eventDate);
    let age = eventDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = eventDate.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && eventDate.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    if (batch.modality.minAge > 0 && age < batch.modality.minAge) {
      throw new BadRequestException(
        `Idade mínima para a modalidade "${batch.modality.name}" é de ${batch.modality.minAge} anos. Idade do atleta na data da prova: ${age} anos.`,
      );
    }

    // 6. Prevenção de duplicidade: atleta não pode ter inscrição ativa no mesmo evento
    const existingRegistration = await this.prisma.registration.findFirst({
      where: {
        athleteId,
        paymentStatus: {
          not: PaymentStatus.CANCELLED,
        },
        batch: {
          modality: {
            eventId: event.id,
          },
        },
      },
    });

    if (existingRegistration) {
      throw new ConflictException(
        'Você já possui uma inscrição ativa nesta corrida de rua.',
      );
    }

    // 7. Transação atômica para alocação de vaga, número de peito e hash QR Code
    return this.prisma.$transaction(async (tx) => {
      // Revalida dentro da transação para prevenir race conditions
      const currentBatch = await tx.registrationBatch.findUnique({
        where: { id: dto.batchId },
      });

      if (!currentBatch || currentBatch.filledSlots >= currentBatch.maxSlots) {
        throw new ConflictException(
          'Vagas esgotadas para este lote de inscrição.',
        );
      }

      // Incrementa atomicamente o contador de vagas preenchidas
      await tx.registrationBatch.update({
        where: { id: dto.batchId },
        data: {
          filledSlots: { increment: 1 },
        },
      });

      // Calcula o próximo número de peito sequencial para o evento (iniciando em 101)
      const lastRegistration = await tx.registration.findFirst({
        where: {
          batch: {
            modality: {
              eventId: event.id,
            },
          },
          bibNumber: { not: null },
        },
        orderBy: { bibNumber: 'desc' },
        select: { bibNumber: true },
      });

      const bibNumber = (lastRegistration?.bibNumber ?? 100) + 1;

      // Gera hash criptográfico único com alta entropia para o QR Code de check-in
      const qrCodeHash = `RM-${randomBytes(16).toString('hex').toUpperCase()}`;

      return tx.registration.create({
        data: {
          athleteId,
          batchId: dto.batchId,
          eventId: event.id,
          bibNumber,
          paymentStatus: PaymentStatus.CONFIRMED,
          qrCodeHash,
          checkedIn: false,
        },
        include: {
          batch: {
            include: {
              modality: {
                include: {
                  event: {
                    select: {
                      id: true,
                      title: true,
                      eventDate: true,
                      location: true,
                    },
                  },
                },
              },
            },
          },
          athlete: {
            select: {
              id: true,
              name: true,
              email: true,
              athleteProfile: {
                select: {
                  shirtSize: true,
                  gender: true,
                  cpf: true,
                },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Lista todas as inscrições do atleta autenticado.
   */
  async findMyRegistrations(athleteId: string) {
    return this.prisma.registration.findMany({
      where: { athleteId },
      include: {
        batch: {
          include: {
            modality: {
              include: {
                event: {
                  select: {
                    id: true,
                    title: true,
                    eventDate: true,
                    location: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
        result: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Consulta os detalhes de uma inscrição específica com validação de permissão.
   */
  async findById(registrationId: string, userId: string, userRole: Role) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        batch: {
          include: {
            modality: {
              include: {
                event: true,
              },
            },
          },
        },
        athlete: {
          select: {
            id: true,
            name: true,
            email: true,
            athleteProfile: {
              select: {
                shirtSize: true,
                gender: true,
                cpf: true,
                emergencyContact: true,
              },
            },
          },
        },
        result: true,
      },
    });

    if (!registration) {
      throw new NotFoundException('Inscrição não encontrada.');
    }

    const event = registration.batch.modality.event;
    const isOwner = registration.athleteId === userId;
    const isEventOrganizer = event.organizerId === userId;
    const isAdmin = userRole === Role.ADMIN;

    if (!isOwner && !isEventOrganizer && !isAdmin) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar esta inscrição.',
      );
    }

    // Se o próprio atleta ou organizador estiver visualizando, descriptografa contato de emergência
    if (
      (isOwner || isEventOrganizer || isAdmin) &&
      registration.athlete.athleteProfile?.emergencyContact
    ) {
      try {
        const decrypted = this.cryptoService.decrypt(
          registration.athlete.athleteProfile.emergencyContact,
        );
        if (decrypted) {
          registration.athlete.athleteProfile.emergencyContact = decrypted;
        }
      } catch {
        // Preserva em caso de teste ou falha de chave
      }
    }

    return registration;
  }

  /**
   * Lista todas as inscrições de um evento específico para o organizador.
   */
  async findByEvent(eventId: string, organizerId: string, userRole: Role) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Evento esportivo não encontrado.');
    }

    if (userRole !== Role.ADMIN && event.organizerId !== organizerId) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar os inscritos deste evento.',
      );
    }

    return this.prisma.registration.findMany({
      where: {
        batch: {
          modality: {
            eventId,
          },
        },
      },
      include: {
        athlete: {
          select: {
            id: true,
            name: true,
            email: true,
            athleteProfile: {
              select: {
                cpf: true,
                gender: true,
                shirtSize: true,
                birthDate: true,
              },
            },
          },
        },
        batch: {
          include: {
            modality: true,
          },
        },
        result: true,
      },
      orderBy: [{ bibNumber: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Realiza o check-in e entrega de kits na arena validando o QR Code (UC06).
   */
  async checkIn(organizerId: string, userRole: Role, dto: CheckInDto) {
    const registration = await this.prisma.registration.findUnique({
      where: { qrCodeHash: dto.qrCodeHash.trim() },
      include: {
        batch: {
          include: {
            modality: {
              include: {
                event: true,
              },
            },
          },
        },
        athlete: {
          include: {
            athleteProfile: true,
          },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException(
        'Inscrição não encontrada para o QR Code fornecido.',
      );
    }

    const event = registration.batch.modality.event;

    // Apenas o organizador do evento ou ADMIN pode realizar o check-in na arena
    if (userRole !== Role.ADMIN && event.organizerId !== organizerId) {
      throw new ForbiddenException(
        'Você não tem permissão para realizar o check-in nesta prova esportiva.',
      );
    }

    if (registration.paymentStatus !== PaymentStatus.CONFIRMED) {
      throw new BadRequestException(
        'Inscrição com pagamento pendente. Não é possível realizar o check-in.',
      );
    }

    if (registration.checkedIn) {
      const checkInDate = registration.checkedInAt
        ? new Date(registration.checkedInAt).toLocaleString('pt-BR')
        : 'anteriormente';
      throw new ConflictException(
        `Check-in e entrega de kit já realizados para este atleta (${checkInDate}).`,
      );
    }

    const updated = await this.prisma.registration.update({
      where: { id: registration.id },
      data: {
        checkedIn: true,
        checkedInAt: new Date(),
      },
      include: {
        batch: {
          include: {
            modality: {
              include: {
                event: true,
              },
            },
          },
        },
        athlete: {
          select: {
            id: true,
            name: true,
            email: true,
            athleteProfile: {
              select: {
                cpf: true,
                shirtSize: true,
                gender: true,
                emergencyContact: true,
              },
            },
          },
        },
      },
    });

    if (updated.athlete.athleteProfile?.emergencyContact) {
      try {
        const decrypted = this.cryptoService.decrypt(
          updated.athlete.athleteProfile.emergencyContact,
        );
        if (decrypted) {
          updated.athlete.athleteProfile.emergencyContact = decrypted;
        }
      } catch {
        // Preserva se falhar
      }
    }

    return updated;
  }
}
