import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ResultsService } from './results.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, Role } from '@prisma/client';

describe('ResultsService (UC07 - Importar e Registrar Tempos Oficiais)', () => {
  let service: ResultsService;
  let prismaService: any;

  const mockOrganizerId = '22222222-2222-2222-2222-222222222222';
  const mockEventId = '44444444-4444-4444-4444-444444444444';
  const mockModalityId = '55555555-5555-5555-5555-555555555555';

  const mockEvent = {
    id: mockEventId,
    organizerId: mockOrganizerId,
    title: '1ª Corrida das Águas de Manaus 2026',
    eventDate: new Date('2026-12-01T10:00:00Z'),
  };

  beforeEach(async () => {
    prismaService = {
      event: {
        findUnique: jest.fn<any>(),
      },
      registration: {
        findFirst: jest.fn<any>(),
        findMany: jest.fn<any>(),
      },
      result: {
        upsert: jest.fn<any>(),
        findUnique: jest.fn<any>(),
        findMany: jest.fn<any>(),
        update: jest.fn<any>(),
      },
      $transaction: jest.fn<any>((cb: any) => cb(prismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResultsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<ResultsService>(ResultsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateTimeValues (Exceção 7B)', () => {
    it('deve aceitar tempos válidos no formato HH:MM:SS com netTime <= grossTime', () => {
      expect(() =>
        service.validateTimeValues('00:25:30', '00:25:10', 'Peito #101'),
      ).not.toThrow();
    });

    it('deve rejeitar formato inválido de tempo bruto (Exceção 7B)', () => {
      expect(() =>
        service.validateTimeValues('25:30', '00:25:10', 'Peito #101'),
      ).toThrow(BadRequestException);
    });

    it('deve rejeitar formato inválido de tempo líquido (Exceção 7B)', () => {
      expect(() =>
        service.validateTimeValues('00:25:30', '00:65:10', 'Peito #101'),
      ).toThrow(BadRequestException);
    });

    it('deve rejeitar quando o tempo líquido for maior que o tempo bruto (Exceção 7B)', () => {
      expect(() =>
        service.validateTimeValues('00:25:00', '00:25:15', 'Peito #101'),
      ).toThrow(BadRequestException);
    });
  });

  describe('recordSingleResult (Digitação Individual - UC07)', () => {
    it('deve rejeitar se o evento não existir', async () => {
      prismaService.event.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.recordSingleResult(mockEventId, mockOrganizerId, Role.ORGANIZER, {
          bibNumber: 101,
          grossTime: '00:24:30',
          netTime: '00:24:10',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve bloquear organizador que não é proprietário da prova', async () => {
      prismaService.event.findUnique.mockResolvedValueOnce(mockEvent);

      await expect(
        service.recordSingleResult(
          mockEventId,
          'outro-organizador',
          Role.ORGANIZER,
          {
            bibNumber: 101,
            grossTime: '00:24:30',
            netTime: '00:24:10',
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve rejeitar número de peito inexistente no evento (Exceção 7A)', async () => {
      prismaService.event.findUnique.mockResolvedValueOnce(mockEvent);
      prismaService.registration.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.recordSingleResult(mockEventId, mockOrganizerId, Role.ORGANIZER, {
          bibNumber: 999,
          grossTime: '00:24:30',
          netTime: '00:24:10',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve salvar o tempo oficial e recalcular a classificação com sucesso', async () => {
      prismaService.event.findUnique.mockResolvedValueOnce(mockEvent);
      prismaService.registration.findFirst.mockResolvedValueOnce({
        id: 'reg-101',
        eventId: mockEventId,
        bibNumber: 101,
        paymentStatus: PaymentStatus.CONFIRMED,
      });

      prismaService.result.upsert.mockResolvedValueOnce({
        id: 'res-1',
        registrationId: 'reg-101',
        grossTime: '00:24:30',
        netTime: '00:24:10',
        overallPos: 1,
        categoryPos: 1,
      });

      prismaService.result.findMany.mockResolvedValueOnce([
        {
          id: 'res-1',
          registrationId: 'reg-101',
          grossTime: '00:24:30',
          netTime: '00:24:10',
          overallPos: 1,
          categoryPos: 1,
          registration: {
            bibNumber: 101,
            batch: { modalityId: mockModalityId },
            event: mockEvent,
            athlete: {
              athleteProfile: {
                birthDate: new Date('1995-05-20'),
                gender: 'M',
              },
            },
          },
        },
      ]);

      prismaService.result.findUnique.mockResolvedValueOnce({
        id: 'res-1',
        registrationId: 'reg-101',
        grossTime: '00:24:30',
        netTime: '00:24:10',
        overallPos: 1,
        categoryPos: 1,
      });

      const saved = await service.recordSingleResult(
        mockEventId,
        mockOrganizerId,
        Role.ORGANIZER,
        {
          bibNumber: 101,
          grossTime: '00:24:30',
          netTime: '00:24:10',
        },
      );

      expect(prismaService.result.upsert).toHaveBeenCalled();
      expect(saved?.netTime).toBe('00:24:10');
    });
  });

  describe('importResults (Importação de CSV em Lote - UC07)', () => {
    it('deve rejeitar CSV com formato de tempo inválido (Exceção 7B)', async () => {
      prismaService.event.findUnique.mockResolvedValueOnce(mockEvent);

      const badCsv = 'bib_number,gross_time,net_time\n101,00:24:30,INVALIDO';

      await expect(
        service.importResults(mockEventId, mockOrganizerId, Role.ORGANIZER, {
          csvContent: badCsv,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve alertar números de peito inexistentes quando ignoreInvalidBibs=false (Exceção 7A)', async () => {
      prismaService.event.findUnique.mockResolvedValueOnce(mockEvent);
      prismaService.registration.findMany.mockResolvedValueOnce([
        {
          id: 'reg-101',
          bibNumber: 101,
          paymentStatus: PaymentStatus.CONFIRMED,
        },
      ]);

      const csvWithInvalidBib =
        'bib_number,gross_time,net_time\n101,00:24:30,00:24:10\n999,00:28:00,00:27:45';

      await expect(
        service.importResults(mockEventId, mockOrganizerId, Role.ORGANIZER, {
          csvContent: csvWithInvalidBib,
          ignoreInvalidBibs: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve importar apenas registros válidos quando ignoreInvalidBibs=true (Exceção 7A confirmada) e desempatar tempo líquido pelo tempo bruto', async () => {
      prismaService.event.findUnique.mockResolvedValueOnce(mockEvent);
      prismaService.registration.findMany.mockResolvedValueOnce([
        {
          id: 'reg-101',
          bibNumber: 101,
          paymentStatus: PaymentStatus.CONFIRMED,
        },
        {
          id: 'reg-102',
          bibNumber: 102,
          paymentStatus: PaymentStatus.CONFIRMED,
        },
      ]);

      prismaService.result.upsert.mockResolvedValue({});

      // Simula empate no tempo líquido (00:24:10), mas #102 tem menor tempo bruto (00:24:15 vs 00:24:30)
      prismaService.result.findMany
        .mockResolvedValueOnce([
          {
            id: 'res-101',
            registrationId: 'reg-101',
            grossTime: '00:24:30',
            netTime: '00:24:10',
            overallPos: 0,
            categoryPos: 0,
            registration: {
              bibNumber: 101,
              batch: { modalityId: mockModalityId },
              event: mockEvent,
              athlete: {
                athleteProfile: {
                  birthDate: new Date('1995-05-20'),
                  gender: 'M',
                },
              },
            },
          },
          {
            id: 'res-102',
            registrationId: 'reg-102',
            grossTime: '00:24:15',
            netTime: '00:24:10',
            overallPos: 0,
            categoryPos: 0,
            registration: {
              bibNumber: 102,
              batch: { modalityId: mockModalityId },
              event: mockEvent,
              athlete: {
                athleteProfile: {
                  birthDate: new Date('1992-03-10'),
                  gender: 'M',
                },
              },
            },
          },
        ])
        .mockResolvedValueOnce([
          { id: 'res-102', overallPos: 1, categoryPos: 1 },
          { id: 'res-101', overallPos: 2, categoryPos: 2 },
        ]);

      const csv =
        'bib_number,gross_time,net_time\n101,00:24:30,00:24:10\n102,00:24:15,00:24:10\n888,00:30:00,00:29:50';

      const response = await service.importResults(
        mockEventId,
        mockOrganizerId,
        Role.ORGANIZER,
        {
          csvContent: csv,
          ignoreInvalidBibs: true,
        },
      );

      expect(response.importedCount).toBe(2);
      expect(response.skippedInvalidBibs).toEqual([888]);
      // Verifica que #102 ficou em 1º lugar no desempate por tempo bruto
      expect(prismaService.result.update).toHaveBeenCalledWith({
        where: { id: 'res-102' },
        data: { overallPos: 1, categoryPos: 1 },
      });
      expect(prismaService.result.update).toHaveBeenCalledWith({
        where: { id: 'res-101' },
        data: { overallPos: 2, categoryPos: 2 },
      });
    });
  });
});
