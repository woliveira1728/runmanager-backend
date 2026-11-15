import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventStatus, Role } from '@prisma/client';

describe('EventsService', () => {
  let service: EventsService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      event: {
        create: jest.fn<any>(),
        findMany: jest.fn<any>(),
        findUnique: jest.fn<any>(),
        update: jest.fn<any>(),
        delete: jest.fn<any>(),
      },
      registration: {
        findFirst: jest.fn<any>(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const validDto = {
      title: '1ª Corrida das Águas',
      description: 'Percursos de 5km e 10km na orla de Ponta Negra',
      eventDate: '2026-12-01T06:00:00.000Z',
      location: 'Ponta Negra, Manaus - AM',
      status: EventStatus.DRAFT,
      modalities: [
        {
          name: '5km Geral',
          minAge: 14,
          batches: [
            {
              batchNumber: 1,
              price: 80.0,
              maxSlots: 100,
              endDate: '2026-11-20T23:59:59.000Z',
            },
          ],
        },
      ],
    };

    it('should create event with modalities and batches successfully', async () => {
      prismaService.event.create.mockResolvedValue({
        id: 'event-uuid',
        ...validDto,
        organizerId: 'org-uuid',
      });

      const result = await service.create('org-uuid', validDto);

      expect(prismaService.event.create).toHaveBeenCalled();
      expect(result.id).toBe('event-uuid');
    });

    it('should throw BadRequestException if eventDate is in the past', async () => {
      const pastDto = {
        ...validDto,
        eventDate: '2020-01-01T00:00:00.000Z',
      };

      await expect(service.create('org-uuid', pastDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if batch endDate is after eventDate', async () => {
      const invalidBatchDto = {
        ...validDto,
        modalities: [
          {
            name: '5km',
            batches: [
              {
                batchNumber: 1,
                price: 80.0,
                maxSlots: 100,
                endDate: '2026-12-05T00:00:00.000Z', // Posterior a eventDate (01/12)
              },
            ],
          },
        ],
      };

      await expect(
        service.create('org-uuid', invalidBatchDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return published events by default', async () => {
      const mockEvents = [{ id: '1', title: 'Corrida A' }];
      prismaService.event.findMany.mockResolvedValue(mockEvents);

      const result = await service.findAll();

      expect(prismaService.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: EventStatus.PUBLISHED },
        }),
      );
      expect(result).toEqual(mockEvents);
    });

    it('should filter by search term when provided', async () => {
      prismaService.event.findMany.mockResolvedValue([]);

      await service.findAll({ search: 'Manaus' });

      expect(prismaService.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'Manaus', mode: 'insensitive' } },
              { location: { contains: 'Manaus', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return event if found', async () => {
      const mockEvent = { id: 'event-uuid', title: 'Corrida das Águas' };
      prismaService.event.findUnique.mockResolvedValue(mockEvent);

      const result = await service.findById('event-uuid');
      expect(result).toEqual(mockEvent);
    });

    it('should throw NotFoundException if event does not exist', async () => {
      prismaService.event.findUnique.mockResolvedValue(null);

      await expect(service.findById('unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const existingEvent = {
      id: 'event-uuid',
      organizerId: 'org-uuid',
      title: 'Título Original',
      modalities: [],
    };

    it('should update event when user is owner organizer', async () => {
      prismaService.event.findUnique.mockResolvedValue(existingEvent);
      prismaService.event.update.mockResolvedValue({
        ...existingEvent,
        title: 'Novo Título',
      });

      const result = await service.update(
        'event-uuid',
        'org-uuid',
        Role.ORGANIZER,
        { title: 'Novo Título' },
      );

      expect(result.title).toBe('Novo Título');
    });

    it('should update event when user is ADMIN even if not owner', async () => {
      prismaService.event.findUnique.mockResolvedValue(existingEvent);
      prismaService.event.update.mockResolvedValue({
        ...existingEvent,
        title: 'Atualizado por Admin',
      });

      const result = await service.update(
        'event-uuid',
        'admin-uuid',
        Role.ADMIN,
        { title: 'Atualizado por Admin' },
      );

      expect(result.title).toBe('Atualizado por Admin');
    });

    it('should throw ForbiddenException if user is not owner and not ADMIN', async () => {
      prismaService.event.findUnique.mockResolvedValue(existingEvent);

      await expect(
        service.update('event-uuid', 'other-org', Role.ORGANIZER, {
          title: 'Tentativa Hacker',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('publish', () => {
    it('should publish event when owner and has modalities with batches', async () => {
      const readyEvent = {
        id: 'event-uuid',
        organizerId: 'org-uuid',
        modalities: [
          {
            id: 'mod-1',
            registrationBatches: [{ id: 'b-1' }],
          },
        ],
      };
      prismaService.event.findUnique.mockResolvedValue(readyEvent);
      prismaService.event.update.mockResolvedValue({
        ...readyEvent,
        status: EventStatus.PUBLISHED,
      });

      const result = await service.publish(
        'event-uuid',
        'org-uuid',
        Role.ORGANIZER,
      );

      expect(prismaService.event.update).toHaveBeenCalledWith({
        where: { id: 'event-uuid' },
        data: { status: EventStatus.PUBLISHED },
      });
      expect(result.status).toBe(EventStatus.PUBLISHED);
    });

    it('should throw BadRequestException if event has no modalities', async () => {
      prismaService.event.findUnique.mockResolvedValue({
        id: 'event-uuid',
        organizerId: 'org-uuid',
        modalities: [],
      });

      await expect(
        service.publish('event-uuid', 'org-uuid', Role.ORGANIZER),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should delete event if no registrations exist', async () => {
      prismaService.event.findUnique.mockResolvedValue({
        id: 'event-uuid',
        organizerId: 'org-uuid',
      });
      prismaService.registration.findFirst.mockResolvedValue(null);
      prismaService.event.delete.mockResolvedValue({ id: 'event-uuid' });

      const result = await service.delete(
        'event-uuid',
        'org-uuid',
        Role.ORGANIZER,
      );

      expect(prismaService.event.delete).toHaveBeenCalledWith({
        where: { id: 'event-uuid' },
      });
      expect(result.id).toBe('event-uuid');
    });

    it('should throw ConflictException if event already has registrations', async () => {
      prismaService.event.findUnique.mockResolvedValue({
        id: 'event-uuid',
        organizerId: 'org-uuid',
      });
      prismaService.registration.findFirst.mockResolvedValue({
        id: 'reg-uuid',
      });

      await expect(
        service.delete('event-uuid', 'org-uuid', Role.ORGANIZER),
      ).rejects.toThrow(ConflictException);
    });
  });
});
