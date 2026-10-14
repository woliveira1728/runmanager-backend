import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateAthleteProfileDto } from './dto/update-athlete-profile.dto';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Cadastra um novo usuário no sistema com regras de integridade e LGPD.
   */
  async create(createUserDto: CreateUserDto) {
    const email = createUserDto.email.toLowerCase().trim();

    // 1. Validação de e-mail único
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException(
        'O e-mail informado já está cadastrado no sistema.',
      );
    }

    const role = createUserDto.role ?? Role.ATHLETE;
    let athleteProfileData = undefined;

    // 2. Validações e tratamento de perfil de atleta (se fornecido)
    if (createUserDto.athleteProfile) {
      const { athleteProfile } = createUserDto;

      if (!athleteProfile.lgpdConsent) {
        throw new BadRequestException(
          'O consentimento formal da LGPD é obrigatório para cadastrar o perfil de atleta.',
        );
      }

      const cpfClean = athleteProfile.cpf.replace(/\D/g, '');

      const existingProfile = await this.prisma.athleteProfile.findUnique({
        where: { cpf: cpfClean },
      });

      if (existingProfile) {
        throw new ConflictException(
          'O CPF informado já está cadastrado no sistema.',
        );
      }

      // Criptografia em repouso dos dados sensíveis de saúde e contato
      const encryptedEmergency = this.cryptoService.encrypt(
        athleteProfile.emergencyContact,
      );
      const encryptedMedical = athleteProfile.medicalNotes
        ? this.cryptoService.encrypt(athleteProfile.medicalNotes)
        : null;

      athleteProfileData = {
        cpf: cpfClean,
        birthDate: new Date(athleteProfile.birthDate),
        gender: athleteProfile.gender,
        shirtSize: athleteProfile.shirtSize,
        emergencyContact: encryptedEmergency ?? '',
        medicalNotes: encryptedMedical,
        lgpdConsent: true,
        lgpdConsentAt: new Date(),
      };
    }

    // 3. Hash criptográfico seguro da senha (bcrypt com fator de custo 10)
    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    // 4. Criação atômica no banco de dados
    const createdUser = await this.prisma.user.create({
      data: {
        name: createUserDto.name.trim(),
        email,
        passwordHash,
        role,
        ...(athleteProfileData && {
          athleteProfile: {
            create: athleteProfileData,
          },
        }),
      },
      include: {
        athleteProfile: true,
      },
    });

    return this.sanitizeUser(createdUser);
  }

  /**
   * Busca um usuário pelo e-mail com senha hash para o módulo de autenticação.
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        athleteProfile: true,
      },
    });
  }

  /**
   * Busca um usuário pelo ID e retorna perfil com dados sensíveis descriptografados.
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        athleteProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return this.sanitizeUser(user);
  }

  /**
   * Atualiza dados permitidos do perfil do atleta.
   */
  async updateAthleteProfile(userId: string, dto: UpdateAthleteProfileDto) {
    const profile = await this.prisma.athleteProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(
        'Perfil de atleta não encontrado para este usuário.',
      );
    }

    const dataToUpdate: any = {};

    if (dto.shirtSize) {
      dataToUpdate.shirtSize = dto.shirtSize;
    }

    if (dto.emergencyContact) {
      dataToUpdate.emergencyContact = this.cryptoService.encrypt(
        dto.emergencyContact,
      );
    }

    if (dto.medicalNotes !== undefined) {
      dataToUpdate.medicalNotes = dto.medicalNotes
        ? this.cryptoService.encrypt(dto.medicalNotes)
        : null;
    }

    const updatedProfile = await this.prisma.athleteProfile.update({
      where: { userId },
      data: dataToUpdate,
    });

    return {
      ...updatedProfile,
      emergencyContact: this.cryptoService.decrypt(
        updatedProfile.emergencyContact,
      ),
      medicalNotes: this.cryptoService.decrypt(updatedProfile.medicalNotes),
    };
  }

  /**
   * Remove campos sensíveis como passwordHash e descriptografa dados médicos
   * para apresentação segura ao usuário autorizado.
   */
  private sanitizeUser(user: any) {
    const { passwordHash: _passwordHash, ...sanitized } = user;

    if (sanitized.athleteProfile) {
      sanitized.athleteProfile = {
        ...sanitized.athleteProfile,
        emergencyContact: this.cryptoService.decrypt(
          sanitized.athleteProfile.emergencyContact,
        ),
        medicalNotes: this.cryptoService.decrypt(
          sanitized.athleteProfile.medicalNotes,
        ),
      };
    }

    return sanitized;
  }
}
