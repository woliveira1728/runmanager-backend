import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ImportResultsDto,
  RecordSingleResultDto,
  TIME_HHMMSS_REGEX,
} from './dto/record-result.dto';
import { PaymentStatus, Role } from '@prisma/client';

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Converte string HH:MM:SS em total de segundos para comparação e ordenação.
   */
  public timeToSeconds(time: string): number {
    const [hh, mm, ss] = time.trim().split(':').map(Number);
    return hh * 3600 + mm * 60 + ss;
  }

  /**
   * Valida formato HH:MM:SS e coerência cronológica (tempo líquido <= tempo bruto) (Exceção 7B).
   */
  public validateTimeValues(
    grossTime: string,
    netTime: string,
    contextLabel = '',
  ): void {
    const prefix = contextLabel ? `${contextLabel}: ` : '';
    const cleanGross = (grossTime || '').trim();
    const cleanNet = (netTime || '').trim();

    if (!TIME_HHMMSS_REGEX.test(cleanGross)) {
      throw new BadRequestException(
        `Exceção 7B: ${prefix}Formato de tempo bruto inválido ("${grossTime}"). Utilize o padrão HH:MM:SS (ex: 00:25:30).`,
      );
    }

    if (!TIME_HHMMSS_REGEX.test(cleanNet)) {
      throw new BadRequestException(
        `Exceção 7B: ${prefix}Formato de tempo líquido inválido ("${netTime}"). Utilize o padrão HH:MM:SS (ex: 00:25:10).`,
      );
    }

    if (this.timeToSeconds(cleanNet) > this.timeToSeconds(cleanGross)) {
      throw new BadRequestException(
        `Exceção 7B: ${prefix}O tempo líquido (${cleanNet}) não pode ser superior ao tempo bruto (${cleanGross}).`,
      );
    }
  }

  /**
   * Determina a faixa etária oficial (regra CBAt) do atleta na data da prova.
   */
  public calculateAgeCategory(
    birthDate: Date | string | null | undefined,
    eventDate: Date | string,
    gender: string | null | undefined,
  ): string {
    const genderPrefix = gender || 'GERAL';
    if (!birthDate) {
      return `${genderPrefix}_ADULTO`;
    }

    const birth = new Date(birthDate);
    const evDate = new Date(eventDate);
    let age = evDate.getFullYear() - birth.getFullYear();
    const mDiff = evDate.getMonth() - birth.getMonth();
    if (mDiff < 0 || (mDiff === 0 && evDate.getDate() < birth.getDate())) {
      age--;
    }

    if (age < 18) return `${genderPrefix}_SUB18`;
    if (age <= 29) return `${genderPrefix}_18_29`;
    if (age <= 39) return `${genderPrefix}_30_39`;
    if (age <= 49) return `${genderPrefix}_40_49`;
    if (age <= 59) return `${genderPrefix}_50_59`;
    return `${genderPrefix}_60_MAIS`;
  }

  /**
   * Faz o parse de um conteúdo CSV (colunas: bib_number, gross_time, net_time)
   * em itens tipados e validados contra a Exceção 7B.
   */
  public parseCsvContent(csvContent: string): RecordSingleResultDto[] {
    const lines = csvContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      throw new BadRequestException(
        'Exceção 7B: O arquivo CSV enviado está vazio.',
      );
    }

    const parsedItems: RecordSingleResultDto[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(/[,;]/).map((c) => c.trim());

      // Ignora linha de cabeçalho se a primeira coluna não for numérica na linha 1
      if (i === 0 && isNaN(Number(cols[0]))) {
        continue;
      }

      if (cols.length < 3) {
        throw new BadRequestException(
          `Exceção 7B: Linha ${i + 1} inválida ("${line}"). O CSV deve conter 3 colunas: bib_number,gross_time,net_time.`,
        );
      }

      const bibNumber = Number(cols[0]);
      if (!Number.isInteger(bibNumber) || bibNumber < 1) {
        throw new BadRequestException(
          `Exceção 7B: Linha ${i + 1} possui número de peito inválido ("${cols[0]}").`,
        );
      }

      const grossTime = cols[1];
      const netTime = cols[2];

      this.validateTimeValues(
        grossTime,
        netTime,
        `Linha ${i + 1} (Peito #${bibNumber})`,
      );

      parsedItems.push({
        bibNumber,
        grossTime,
        netTime,
      });
    }

    if (parsedItems.length === 0) {
      throw new BadRequestException(
        'Exceção 7B: Nenhum registro de tempo encontrado após o cabeçalho do CSV.',
      );
    }

    return parsedItems;
  }

  /**
   * Recalcula as classificações geral (overallPos) e por faixa etária/sexo (categoryPos)
   * dentro de cada modalidade do evento, usando tempo líquido e desempate por tempo bruto e número de peito.
   */
  private async recalculatePositions(tx: any, eventId: string) {
    const allResults = await tx.result.findMany({
      where: {
        registration: {
          eventId,
        },
      },
      include: {
        registration: {
          include: {
            batch: {
              include: {
                modality: true,
              },
            },
            event: true,
            athlete: {
              include: {
                athleteProfile: true,
              },
            },
          },
        },
      },
    });

    // Agrupa por modalidade
    const byModality = new Map<string, any[]>();
    for (const r of allResults) {
      const modId = r.registration.batch.modalityId;
      if (!byModality.has(modId)) {
        byModality.set(modId, []);
      }
      byModality.get(modId)!.push(r);
    }

    for (const [, modalityResults] of byModality.entries()) {
      // Ordena por netTime ASC, desempate por grossTime ASC e bibNumber ASC
      modalityResults.sort((a, b) => {
        const netDiff =
          this.timeToSeconds(a.netTime) - this.timeToSeconds(b.netTime);
        if (netDiff !== 0) return netDiff;

        const grossDiff =
          this.timeToSeconds(a.grossTime) - this.timeToSeconds(b.grossTime);
        if (grossDiff !== 0) return grossDiff;

        return (
          (a.registration.bibNumber ?? 999999) -
          (b.registration.bibNumber ?? 999999)
        );
      });

      const categoryCounters = new Map<string, number>();

      for (let idx = 0; idx < modalityResults.length; idx++) {
        const resItem = modalityResults[idx];
        const overallPos = idx + 1;

        const profile = resItem.registration.athlete?.athleteProfile;
        const catKey = this.calculateAgeCategory(
          profile?.birthDate,
          resItem.registration.event.eventDate,
          profile?.gender,
        );

        const nextCatPos = (categoryCounters.get(catKey) ?? 0) + 1;
        categoryCounters.set(catKey, nextCatPos);

        if (
          resItem.overallPos !== overallPos ||
          resItem.categoryPos !== nextCatPos
        ) {
          await tx.result.update({
            where: { id: resItem.id },
            data: {
              overallPos,
              categoryPos: nextCatPos,
            },
          });
        }
      }
    }
  }

  /**
   * Registra ou atualiza individualmente o tempo oficial de um atleta pelo número de peito (UC07).
   */
  async recordSingleResult(
    eventId: string,
    organizerId: string,
    userRole: Role,
    dto: RecordSingleResultDto,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Evento esportivo não encontrado.');
    }

    if (userRole !== Role.ADMIN && event.organizerId !== organizerId) {
      throw new ForbiddenException(
        'Você não tem permissão para registrar tempos oficiais nesta prova.',
      );
    }

    this.validateTimeValues(
      dto.grossTime,
      dto.netTime,
      `Peito #${dto.bibNumber}`,
    );

    const registration = await this.prisma.registration.findFirst({
      where: {
        eventId,
        bibNumber: dto.bibNumber,
        paymentStatus: PaymentStatus.CONFIRMED,
      },
    });

    if (!registration) {
      throw new NotFoundException(
        `Exceção 7A: Número de peito #${dto.bibNumber} não pertence a nenhuma inscrição confirmada neste evento.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.result.upsert({
        where: { registrationId: registration.id },
        update: {
          grossTime: dto.grossTime.trim(),
          netTime: dto.netTime.trim(),
          importedAt: new Date(),
        },
        create: {
          registrationId: registration.id,
          grossTime: dto.grossTime.trim(),
          netTime: dto.netTime.trim(),
          overallPos: 1,
          categoryPos: 1,
        },
      });

      await this.recalculatePositions(tx, eventId);

      return tx.result.findUnique({
        where: { registrationId: registration.id },
        include: {
          registration: {
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
                      birthDate: true,
                      shirtSize: true,
                    },
                  },
                },
              },
              batch: {
                include: {
                  modality: true,
                },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Importa tempos oficiais em lote via CSV ou array de objetos (UC07).
   * Valida formato de tempos (Exceção 7B) e números de peito inexistentes (Exceção 7A).
   */
  async importResults(
    eventId: string,
    organizerId: string,
    userRole: Role,
    dto: ImportResultsDto,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Evento esportivo não encontrado.');
    }

    if (userRole !== Role.ADMIN && event.organizerId !== organizerId) {
      throw new ForbiddenException(
        'Você não tem permissão para importar resultados nesta prova.',
      );
    }

    let items: RecordSingleResultDto[] = [];
    if (dto.csvContent && dto.csvContent.trim().length > 0) {
      items = this.parseCsvContent(dto.csvContent);
    } else if (dto.items && dto.items.length > 0) {
      for (const item of dto.items) {
        this.validateTimeValues(
          item.grossTime,
          item.netTime,
          `Peito #${item.bibNumber}`,
        );
      }
      items = dto.items;
    } else {
      throw new BadRequestException(
        'Forneça o conteúdo CSV (csvContent) ou a lista de tempos (items) para importação.',
      );
    }

    // Verifica números de peito duplicados dentro do mesmo arquivo
    const seenBibs = new Set<number>();
    for (const item of items) {
      if (seenBibs.has(item.bibNumber)) {
        throw new BadRequestException(
          `Exceção 7B: O número de peito #${item.bibNumber} está duplicado no lote de importação.`,
        );
      }
      seenBibs.add(item.bibNumber);
    }

    // Busca todas as inscrições confirmadas do evento
    const confirmedRegistrations = await this.prisma.registration.findMany({
      where: {
        eventId,
        paymentStatus: PaymentStatus.CONFIRMED,
        bibNumber: { not: null },
      },
    });

    const regByBib = new Map<number, (typeof confirmedRegistrations)[0]>();
    for (const reg of confirmedRegistrations) {
      if (reg.bibNumber !== null) {
        regByBib.set(reg.bibNumber, reg);
      }
    }

    const validItems: Array<{
      registrationId: string;
      bibNumber: number;
      grossTime: string;
      netTime: string;
    }> = [];
    const invalidBibs: number[] = [];

    for (const item of items) {
      const reg = regByBib.get(item.bibNumber);
      if (!reg) {
        invalidBibs.push(item.bibNumber);
      } else {
        validItems.push({
          registrationId: reg.id,
          bibNumber: item.bibNumber,
          grossTime: item.grossTime.trim(),
          netTime: item.netTime.trim(),
        });
      }
    }

    if (invalidBibs.length > 0 && !dto.ignoreInvalidBibs) {
      throw new BadRequestException({
        message: `Exceção 7A: Foram encontrados ${invalidBibs.length} número(s) de peito sem inscrição confirmada no evento (${invalidBibs.map((b) => `#${b}`).join(', ')}). Confirme se deseja importar apenas os ${validItems.length} registro(s) válido(s).`,
        code: 'EXCEPTION_7A_INVALID_BIBS',
        invalidBibs,
        validCount: validItems.length,
      });
    }

    if (validItems.length === 0) {
      throw new BadRequestException(
        'Exceção 7A: Nenhum número de peito válido foi encontrado no arquivo para este evento.',
      );
    }

    const results = await this.prisma.$transaction(async (tx) => {
      for (const valid of validItems) {
        await tx.result.upsert({
          where: { registrationId: valid.registrationId },
          update: {
            grossTime: valid.grossTime,
            netTime: valid.netTime,
            importedAt: new Date(),
          },
          create: {
            registrationId: valid.registrationId,
            grossTime: valid.grossTime,
            netTime: valid.netTime,
            overallPos: 1,
            categoryPos: 1,
          },
        });
      }

      await this.recalculatePositions(tx, eventId);

      return tx.result.findMany({
        where: {
          registration: {
            eventId,
          },
        },
        include: {
          registration: {
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
                      birthDate: true,
                      shirtSize: true,
                    },
                  },
                },
              },
              batch: {
                include: {
                  modality: true,
                },
              },
            },
          },
        },
        orderBy: [{ overallPos: 'asc' }],
      });
    });

    return {
      importedCount: validItems.length,
      skippedInvalidBibs: invalidBibs,
      results,
    };
  }

  /**
   * Lista os resultados oficiais e classificações de um evento esportivo.
   */
  async findByEvent(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Evento esportivo não encontrado.');
    }

    const results = await this.prisma.result.findMany({
      where: {
        registration: {
          eventId,
        },
      },
      include: {
        registration: {
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
                    birthDate: true,
                    shirtSize: true,
                  },
                },
              },
            },
            batch: {
              include: {
                modality: true,
              },
            },
          },
        },
      },
      orderBy: [{ overallPos: 'asc' }],
    });

    return results.map((r) => ({
      ...r,
      ageCategory: this.calculateAgeCategory(
        r.registration.athlete?.athleteProfile?.birthDate,
        event.eventDate,
        r.registration.athlete?.athleteProfile?.gender,
      ),
    }));
  }
}
