import {
  PrismaClient,
  Role,
  Gender,
  ShirtSize,
  EventStatus,
  PaymentStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createCipheriv, randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

function encryptLgpd(plainText: string): string {
  const rawKey = process.env.ENCRYPTION_KEY ?? 'runmanager_lgpd_secret_key_32b!';
  const key = Buffer.alloc(32);
  key.write(rawKey.padEnd(32, '0').slice(0, 32), 'utf-8');

  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

async function main() {
  console.log('🌱 Iniciando seed oficial do banco de dados RunManager...');

  const passwordHash = await bcrypt.hash('senha123', 10);

  // 1. Administrador
  const admin = await prisma.user.upsert({
    where: { email: 'admin@runmanager.com' },
    update: {},
    create: {
      name: 'Administrador RunManager',
      email: 'admin@runmanager.com',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  // 2. Organizador de Eventos
  const organizer = await prisma.user.upsert({
    where: { email: 'organizador@runmanager.com' },
    update: {},
    create: {
      name: 'Assessoria Esportiva Manaus Run',
      email: 'organizador@runmanager.com',
      passwordHash,
      role: Role.ORGANIZER,
    },
  });

  // 3. Atleta Demonstrativo com consentimento LGPD e dados criptografados
  const athlete = await prisma.user.upsert({
    where: { email: 'atleta@runmanager.com' },
    update: {},
    create: {
      name: 'Wilson Dias de Oliveira',
      email: 'atleta@runmanager.com',
      passwordHash,
      role: Role.ATHLETE,
      athleteProfile: {
        create: {
          cpf: '12345678909',
          birthDate: new Date('1995-05-20'),
          gender: Gender.M,
          shirtSize: ShirtSize.M,
          emergencyContact: encryptLgpd('Maria Oliveira - (92) 98111-2233'),
          medicalNotes: encryptLgpd('Tipo Sanguíneo O+. Sem alergias.'),
          lgpdConsent: true,
          lgpdConsentAt: new Date(),
        },
      },
    },
    include: { athleteProfile: true },
  });

  // 4. Evento Esportivo Publicado (se não existir)
  const existingEvent = await prisma.event.findFirst({
    where: { title: '1ª Corrida das Águas de Manaus 2026' },
  });

  if (!existingEvent) {
    const eventDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // +30 dias
    const batchEndDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 20); // +20 dias

    const createdEvent = await prisma.event.create({
      data: {
        organizerId: organizer.id,
        title: '1ª Corrida das Águas de Manaus 2026',
        description:
          'Prova oficial homologada na Orla da Ponta Negra com hidratação a cada 2,5km, chip descartável, camisa poliamida e medalha finisher.',
        eventDate,
        location: 'Complexo Turístico da Ponta Negra, Manaus - AM',
        status: EventStatus.PUBLISHED,
        modalities: {
          create: [
            {
              name: '5km Corrida Geral',
              minAge: 14,
              registrationBatches: {
                create: [
                  {
                    batchNumber: 1,
                    price: 85.0,
                    maxSlots: 200,
                    filledSlots: 1,
                    endDate: batchEndDate,
                  },
                ],
              },
            },
            {
              name: '10km Performance',
              minAge: 18,
              registrationBatches: {
                create: [
                  {
                    batchNumber: 1,
                    price: 110.0,
                    maxSlots: 150,
                    filledSlots: 0,
                    endDate: batchEndDate,
                  },
                ],
              },
            },
          ],
        },
      },
      include: {
        modalities: {
          include: {
            registrationBatches: true,
          },
        },
      },
    });

    const firstBatch = createdEvent.modalities[0].registrationBatches[0];

    await prisma.registration.create({
      data: {
        athleteId: athlete.id,
        batchId: firstBatch.id,
        eventId: createdEvent.id,
        bibNumber: 101,
        paymentStatus: PaymentStatus.CONFIRMED,
        qrCodeHash: 'RM-DEMO2026MANAUS01',
        checkedIn: false,
      },
    });
  }

  console.log('✅ Seed concluído com sucesso!');
  console.log(`   - Admin: ${admin.email} (senha: senha123)`);
  console.log(`   - Organizador: ${organizer.email} (senha: senha123)`);
  console.log(`   - Atleta: ${athlete.email} (senha: senha123)`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
