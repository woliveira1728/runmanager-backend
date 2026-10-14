import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const rawKey =
      this.configService.get<string>('ENCRYPTION_KEY') ??
      'runmanager_lgpd_secret_key_32b!';

    // Assegura 32 bytes (256 bits) para o algoritmo aes-256-gcm
    this.key = Buffer.alloc(32);
    this.key.write(rawKey.padEnd(32, '0').slice(0, 32), 'utf-8');
  }

  /**
   * Criptografa uma string usando AES-256-GCM (criptografia autenticada).
   * Retorna o formato: iv:authTag:encryptedContent em hexadecimal.
   */
  encrypt(plainText: string | null | undefined): string | null {
    if (!plainText) {
      return null;
    }

    try {
      const iv = randomBytes(16);
      const cipher = createCipheriv(this.algorithm, this.key, iv);

      const encrypted = Buffer.concat([
        cipher.update(plainText, 'utf8'),
        cipher.final(),
      ]);

      const authTag = cipher.getAuthTag();

      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
    } catch (error) {
      this.logger.error('Erro ao criptografar dados sensíveis LGPD', error);
      throw new Error('Falha no processo de criptografia de segurança.');
    }
  }

  /**
   * Descriptografa uma string criptografada no formato iv:authTag:encryptedContent.
   */
  decrypt(cipherText: string | null | undefined): string | null {
    if (!cipherText) {
      return null;
    }

    // Se não estiver no formato esperado (ex: texto legado ou não criptografado), retorna o próprio texto
    const parts = cipherText.split(':');
    if (parts.length !== 3) {
      return cipherText;
    }

    try {
      const [ivHex, authTagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const encrypted = Buffer.from(encryptedHex, 'hex');

      const decipher = createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      this.logger.error('Erro ao descriptografar dados sensíveis LGPD', error);
      throw new Error('Falha no processo de descriptografia de segurança.');
    }
  }
}
