import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { Role, Gender, ShirtSize } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: any;
  let cryptoService: any;

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn<any>(),
        create: jest.fn<any>(),
      },
      athleteProfile: {
        findUnique: jest.fn<any>(),
        update: jest.fn<any>(),
      },
    };

    cryptoService = {
      encrypt: jest.fn<any>((val: string) => `enc:${val}`),
      decrypt: jest.fn<any>((val: string) =>
        val?.startsWith('enc:') ? val.replace('enc:', '') : val,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
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

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const validCreateUserDto = {
      name: 'Wilson Dias',
      email: 'wilson@teste.com',
      password: 'password123',
      role: Role.ATHLETE,
      athleteProfile: {
        cpf: '123.456.789-01',
        birthDate: '1995-05-20',
        gender: Gender.M,
        shirtSize: ShirtSize.M,
        emergencyContact: 'Maria 92988887777',
        medicalNotes: 'Nenhuma alergia',
        lgpdConsent: true,
      },
    };

    it('should create user and athlete profile with encryption and hash', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.athleteProfile.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'user-uuid',
          name: args.data.name,
          email: args.data.email,
          role: args.data.role,
          passwordHash: args.data.passwordHash,
          athleteProfile: {
            id: 'profile-uuid',
            cpf: args.data.athleteProfile.create.cpf,
            emergencyContact: args.data.athleteProfile.create.emergencyContact,
            medicalNotes: args.data.athleteProfile.create.medicalNotes,
            lgpdConsent: true,
          },
        }),
      );

      const result = await service.create(validCreateUserDto);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'wilson@teste.com' },
      });
      expect(prismaService.athleteProfile.findUnique).toHaveBeenCalledWith({
        where: { cpf: '12345678901' },
      });
      expect(cryptoService.encrypt).toHaveBeenCalledWith('Maria 92988887777');
      expect(cryptoService.encrypt).toHaveBeenCalledWith('Nenhuma alergia');
      expect(result.id).toBe('user-uuid');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.athleteProfile.emergencyContact).toBe('Maria 92988887777');
    });

    it('should throw ConflictException if email already registered', async () => {
      prismaService.user.findUnique.mockResolvedValue({ id: 'existing-id' });

      await expect(service.create(validCreateUserDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if CPF already registered', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.athleteProfile.findUnique.mockResolvedValue({
        id: 'existing-cpf',
      });

      await expect(service.create(validCreateUserDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if LGPD consent is false', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const dtoWithoutLgpd = {
        ...validCreateUserDto,
        athleteProfile: {
          ...validCreateUserDto.athleteProfile,
          lgpdConsent: false,
        },
      };

      await expect(service.create(dtoWithoutLgpd)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findById', () => {
    it('should return user and decrypted sensitive data', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-uuid',
        name: 'Wilson Dias',
        email: 'wilson@teste.com',
        role: Role.ATHLETE,
        passwordHash: 'secret-hash',
        athleteProfile: {
          cpf: '12345678901',
          emergencyContact: 'enc:Maria 92988887777',
          medicalNotes: 'enc:Nenhuma',
        },
      });

      const user = await service.findById('user-uuid');

      expect(user.id).toBe('user-uuid');
      expect(user).not.toHaveProperty('passwordHash');
      expect(user.athleteProfile.emergencyContact).toBe('Maria 92988887777');
    });

    it('should throw NotFoundException if user not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
