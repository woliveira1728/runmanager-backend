import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: any;
  let jwtService: any;

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn<any>(),
    };

    jwtService = {
      sign: jest.fn<any>().mockReturnValue('mocked-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should authenticate and return access token when credentials are valid', async () => {
      const password = 'plainPassword123';
      const passwordHash = await bcrypt.hash(password, 10);

      usersService.findByEmail.mockResolvedValue({
        id: 'user-uuid-1',
        name: 'Wilson Dias',
        email: 'wilson@teste.com',
        passwordHash,
        role: Role.ATHLETE,
      });

      const result = await service.login({
        email: 'wilson@teste.com',
        password,
      });

      expect(result).toHaveProperty('accessToken', 'mocked-jwt-token');
      expect(result.user).toEqual({
        id: 'user-uuid-1',
        name: 'Wilson Dias',
        email: 'wilson@teste.com',
        role: Role.ATHLETE,
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-uuid-1',
        email: 'wilson@teste.com',
        role: Role.ATHLETE,
      });
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'inexistente@teste.com',
          password: 'qualquerSenha',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      const passwordHash = await bcrypt.hash('senhaCorreta', 10);

      usersService.findByEmail.mockResolvedValue({
        id: 'user-uuid-1',
        name: 'Wilson Dias',
        email: 'wilson@teste.com',
        passwordHash,
        role: Role.ATHLETE,
      });

      await expect(
        service.login({
          email: 'wilson@teste.com',
          password: 'senhaErrada',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
