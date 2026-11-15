import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn<any>()
              .mockReturnValue('runmanager_lgpd_secret_key_32b!'),
          },
        },
      ],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt and decrypt text successfully', () => {
    const plainText =
      'Hipertenso, Alérgico a Penicilina (Contato: Mãe 92988887777)';
    const encrypted = service.encrypt(plainText);

    expect(encrypted).not.toBeNull();
    expect(encrypted).not.toEqual(plainText);
    expect(encrypted).toContain(':');

    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toEqual(plainText);
  });

  it('should handle null and undefined gracefully', () => {
    expect(service.encrypt(null)).toBeNull();
    expect(service.encrypt(undefined)).toBeNull();
    expect(service.decrypt(null)).toBeNull();
    expect(service.decrypt(undefined)).toBeNull();
  });
});
