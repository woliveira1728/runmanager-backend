import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { EventStatus, PaymentStatus, Role } from '@prisma/client';

describe('RegistrationsService', () => {
  let service: RegistrationsService;
  let prismaService: any;
  let cryptoService: any;

  const mockAthleteId = '11111111-1111-1111-1111-111111111111';
  const mockOrganizerId = '22222222-2222-2222-2222-222222222222';
  const mockBatchId = '33333333-3333-3333-3333-333333333333';
  const mockEventId = '44444444-4444-4444-4444-444444444444';

  const futureEventDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 dias no futuro
  const futureBatchDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 15); // 15 dias no futuro

  const mockUserWithAthlete = {
    id: mockAthleteId,
    name: 'Atleta Teste',
    email: 'atleta@teste.com',
    athleteProfile: {
      id: 'prof-1',
      cpf: '12345678901',
      birthDate: new Date('1995-05-20'),
      gender: 'M',
      shirtSize: 'M',
      emergencyContact: 'encrypted:contact',
    },
  };

  const mockBatch = {
    id: mockBatchId,
    batchNumber: 1,
    price: 85.0,
    maxSlots: 100,
    filledSlots: 10,
    endDate: futureBatchDate,
    modality: {
      id: 'mod-1',
      name: '5km Geral',
      minAge: 16,
      eventId: mockEventId,
      event: {
        id: mockEventId,
        organizerId: mockOrganizerId,
        title: 'Maratona de Manaus',
        eventDate: futureEventDate,
        status: EventStatus.PUBLISHED,
      },
    },
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn<any>(),
      },
      registrationBatch: {
        findUnique: jest.fn<any>(),
        update: jest.fn<any>(),
      },
      registration: {
        findFirst: jest.fn<any>(),
        findUnique: jest.fn<any>(),
        findMany: jest.fn<any>(),
        create: jest.fn<any>(),
        update: jest.fn<any>(),
      },
      event: {
        findUnique: jest.fn<any>(),
      },
      $transaction: jest.fn<any>((cb: any) => cb(prismaService)),
    };

    cryptoService = {
      encrypt: jest.fn<any>((v: string) => `enc:${v}`),
      decrypt: jest.fn<any>((v: string) => v.replace('encrypted:', '')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: CryptoService,
          useValue: cryptoService,
        },
      ],
    }).compile();

    service = module.get<RegistrationsService>(RegistrationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create (UC05 - Inscrição com Controle de Vagas)', () => {
    it('deve rejeitar inscrição se o usuário não possuir perfil de atleta', async () => {
      prismaService.user.findUnique.mockResolvedValueOnce({
        id: mockAthleteId,
        athleteProfile: null,
      });

      await expect(
        service.create(mockAthleteId, { batchId: mockBatchId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar se o lote de inscrição não existir', async () => {
      prismaService.user.findUnique.mockResolvedValueOnce(mockUserWithAthlete);
      prismaService.registrationBatch.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.create(mockAthleteId, { batchId: mockBatchId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve rejeitar se o evento não estiver publicado (status DRAFT)', async () => {
      prismaService.user.findUnique.mockResolvedValueOnce(mockUserWithAthlete);
      prismaService.registrationBatch.findUnique.mockResolvedValueOnce({
        ...mockBatch,
        modality: {
          ...mockBatch.modality,
          event: {
            ...mockBatch.modality.event,
            status: EventStatus.DRAFT,
          },
        },
      });

      await expect(
        service.create(mockAthleteId, { batchId: mockBatchId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar se a data do evento já tiver passado', async () => {
      prismaService.user.findUnique.mockResolvedValueOnce(mockUserWithAthlete);
      prismaService.registrationBatch.findUnique.mockResolvedValueOnce({
        ...mockBatch,
        modality: {
          ...mockBatch.modality,
          event: {
            ...mockBatch.modality.event,
            eventDate: new Date('2020-01-01T00:00:00Z'),
          },
        },
      });

      await expect(
        service.create(mockAthleteId, { batchId: mockBatchId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar se o lote de inscrição já estiver expirado', async () => {
      prismaService.user.findUnique.mockResolvedValueOnce(mockUserWithAthlete);
      prismaService.registrationBatch.findUnique.mockResolvedValueOnce({
        ...mockBatch,
        endDate: new Date('2020-01-01T00:00:00Z'),
      });

      await expect(
        service.create(mockAthleteId, { batchId: mockBatchId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar se as vagas do lote estiverem esgotadas', async () => {
      prismaService.user.findUnique.mockResolvedValueOnce(mockUserWithAthlete);
      prismaService.registrationBatch.findUnique.mockResolvedValueOnce({
        ...mockBatch,
        maxSlots: 50,
        filledSlots: 50,
      });

      await expect(
        service.create(mockAthleteId, { batchId: mockBatchId }),
      ).rejects.toThrow(ConflictException);
    });

    it('deve rejeitar se o atleta não atingir a idade mínima da modalidade', async () => {
      prismaService.user.findUnique.mockResolvedValueOnce({
        ...mockUserWithAthlete,
        athleteProfile: {
          ...mockUserWithAthlete.athleteProfile,
          birthDate: new Date('2018-01-01'), // Criança com ~8 anos
        },
      });
      prismaService.registrationBatch.findUnique.mockResolvedValueOnce({
        ...mockBatch,
        modality: {
          ...mockBatch.modality,
          minAge: 18,
        },
      });

      await expect(
        service.create(mockAthleteId, { batchId: mockBatchId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar se o atleta já possuir inscrição ativa no mesmo evento', async () => {
      prismaService.user.findUnique.mockResolvedValueOnce(mockUserWithAthlete);
      prismaService.registrationBatch.findUnique.mockResolvedValueOnce(mockBatch);
      prismaService.registration.findFirst.mockResolvedValueOnce({
        id: 'reg-existing',
        athleteId: mockAthleteId,
        paymentStatus: PaymentStatus.CONFIRMED,
      });

      await expect(
        service.create(mockAthleteId, { batchId: mockBatchId }),
      ).rejects.toThrow(ConflictException);
    });

    it('deve criar a inscrição com sucesso, alocando vaga atômica, número de peito e hash QR Code', async () => {
      prismaService.user.findUnique.mockResolvedValueOnce(mockUserWithAthlete);
      // Busca inicial do lote
      prismaService.registrationBatch.findUnique
        .mockResolvedValueOnce(mockBatch) // Busca de validação
        .mockResolvedValueOnce(mockBatch); // Busca dentro da transação
      // Nenhuma inscrição anterior encontrada para o atleta
      prismaService.registration.findFirst
        .mockResolvedValueOnce(null) // Duplicidade
        .mockResolvedValueOnce({ bibNumber: 105 }); // Último número de peito cadastrado

      prismaService.registrationBatch.update.mockResolvedValueOnce({
        ...mockBatch,
        filledSlots: 11,
      });

      prismaService.registration.create.mockResolvedValueOnce({
        id: 'reg-new',
        athleteId: mockAthleteId,
        batchId: mockBatchId,
        bibNumber: 106,
        paymentStatus: PaymentStatus.CONFIRMED,
        qrCodeHash: 'RM-A1B2C3D4E5F6G7H8',
        checkedIn: false,
        batch: mockBatch,
        athlete: mockUserWithAthlete,
      });

      const result = await service.create(mockAthleteId, { batchId: mockBatchId });

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(prismaService.registrationBatch.update).toHaveBeenCalledWith({
        where: { id: mockBatchId },
        data: { filledSlots: { increment: 1 } },
      });
      expect(prismaService.registration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            athleteId: mockAthleteId,
            batchId: mockBatchId,
            eventId: mockEventId,
            bibNumber: 106,
            paymentStatus: PaymentStatus.CONFIRMED,
            checkedIn: false,
          }),
        }),
      );
      expect(result.id).toBe('reg-new');
      expect(result.bibNumber).toBe(106);
    });
  });

  describe('findMyRegistrations', () => {
    it('deve retornar a lista de inscrições do atleta autenticado', async () => {
      prismaService.registration.findMany.mockResolvedValueOnce([
        { id: 'reg-1', athleteId: mockAthleteId },
      ]);

      const result = await service.findMyRegistrations(mockAthleteId);
      expect(result).toHaveLength(1);
      expect(prismaService.registration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { athleteId: mockAthleteId },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('findByEvent', () => {
    it('deve rejeitar se o evento não existir', async () => {
      prismaService.event.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.findByEvent(mockEventId, mockOrganizerId, Role.ORGANIZER),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve bloquear se o organizador não for o dono do evento', async () => {
      prismaService.event.findUnique.mockResolvedValueOnce({
        id: mockEventId,
        organizerId: 'outro-organizador-id',
      });

      await expect(
        service.findByEvent(mockEventId, mockOrganizerId, Role.ORGANIZER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve permitir acesso para o organizador proprietário ou administrador', async () => {
      prismaService.event.findUnique.mockResolvedValueOnce({
        id: mockEventId,
        organizerId: mockOrganizerId,
      });
      prismaService.registration.findMany.mockResolvedValueOnce([
        { id: 'reg-1', bibNumber: 101 },
      ]);

      const result = await service.findByEvent(
        mockEventId,
        mockOrganizerId,
        Role.ORGANIZER,
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('checkIn (UC06 - Check-in por QR Code na Arena)', () => {
    const validQrCode = 'RM-TESTE123456';
    const mockCheckInRegistration = {
      id: 'reg-check',
      qrCodeHash: validQrCode,
      checkedIn: false,
      checkedInAt: null,
      paymentStatus: PaymentStatus.CONFIRMED,
      batch: mockBatch,
      athlete: mockUserWithAthlete,
    };

    it('deve rejeitar se o hash de QR Code não for encontrado', async () => {
      prismaService.registration.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.checkIn(mockOrganizerId, Role.ORGANIZER, {
          qrCodeHash: validQrCode,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve rejeitar se o organizador não tiver permissão para a prova', async () => {
      prismaService.registration.findUnique.mockResolvedValueOnce(
        mockCheckInRegistration,
      );

      await expect(
        service.checkIn('outro-organizador', Role.ORGANIZER, {
          qrCodeHash: validQrCode,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve rejeitar se a inscrição estiver pendente de pagamento', async () => {
      prismaService.registration.findUnique.mockResolvedValueOnce({
        ...mockCheckInRegistration,
        paymentStatus: PaymentStatus.PENDING,
      });

      await expect(
        service.checkIn(mockOrganizerId, Role.ORGANIZER, {
          qrCodeHash: validQrCode,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar se o atleta já tiver realizado check-in anteriormente (duplo check-in)', async () => {
      prismaService.registration.findUnique.mockResolvedValueOnce({
        ...mockCheckInRegistration,
        checkedIn: true,
        checkedInAt: new Date('2026-10-15T08:00:00Z'),
      });

      await expect(
        service.checkIn(mockOrganizerId, Role.ORGANIZER, {
          qrCodeHash: validQrCode,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('deve registrar o check-in com sucesso, marcando presença e liberando kit', async () => {
      prismaService.registration.findUnique.mockResolvedValueOnce(
        mockCheckInRegistration,
      );
      prismaService.registration.update.mockResolvedValueOnce({
        ...mockCheckInRegistration,
        checkedIn: true,
        checkedInAt: new Date(),
      });

      const result = await service.checkIn(mockOrganizerId, Role.ORGANIZER, {
        qrCodeHash: validQrCode,
      });

      expect(prismaService.registration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reg-check' },
          data: expect.objectContaining({
            checkedIn: true,
          }),
        }),
      );
      expect(result.checkedIn).toBe(true);
    });
  });
});
