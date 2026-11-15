-- =============================================================================
-- RunManager - Script Oficial de Criação do Banco de Dados (DDL PostgreSQL 16)
-- Curso Superior de Tecnologia em Análise e Desenvolvimento de Sistemas (ULBRA)
-- Autor: Wilson Dias de Oliveira
-- =============================================================================

-- 1. Tipos Enumerados (Domínios)
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ORGANIZER', 'ATHLETE');
CREATE TYPE "Gender" AS ENUM ('M', 'F', 'OUTRO');
CREATE TYPE "ShirtSize" AS ENUM ('PP', 'P', 'M', 'G', 'GG');
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'FINISHED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- 2. Tabela de Usuários e Controle de Acesso (RBAC - UC01/UC02)
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ATHLETE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- 3. Tabela de Perfis Esportivos e Dados Sensíveis LGPD (UC02/UC03)
-- Nota: emergency_contact e medical_notes são armazenados criptografados com AES-256-GCM
CREATE TABLE "athlete_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "cpf" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "shirt_size" "ShirtSize" NOT NULL,
    "emergency_contact" TEXT NOT NULL,
    "medical_notes" TEXT,
    "lgpd_consent" BOOLEAN NOT NULL DEFAULT false,
    "lgpd_consent_at" TIMESTAMP(3),

    CONSTRAINT "athlete_profiles_pkey" PRIMARY KEY ("id")
);

-- 4. Tabela de Eventos Esportivos / Corridas de Rua (UC04)
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "organizer_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- 5. Tabela de Modalidades / Percursos do Evento (UC04)
CREATE TABLE "modalities" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "min_age" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "modalities_pkey" PRIMARY KEY ("id")
);

-- 6. Tabela de Lotes de Inscrição e Controle Transacional de Vagas (UC04/UC05)
CREATE TABLE "registration_batches" (
    "id" UUID NOT NULL,
    "modality_id" UUID NOT NULL,
    "batch_number" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "max_slots" INTEGER NOT NULL,
    "filled_slots" INTEGER NOT NULL DEFAULT 0,
    "end_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_batches_pkey" PRIMARY KEY ("id")
);

-- 7. Tabela de Inscrições e Credenciamento por QR Code na Arena (UC05/UC06)
CREATE TABLE "registrations" (
    "id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "bib_number" INTEGER,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "qr_code_hash" TEXT NOT NULL,
    "checked_in" BOOLEAN NOT NULL DEFAULT false,
    "checked_in_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- 8. Tabela de Resultados e Tempos Oficiais de Prova (UC07)
CREATE TABLE "results" (
    "id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "gross_time" TEXT NOT NULL,
    "net_time" TEXT NOT NULL,
    "overall_pos" INTEGER NOT NULL,
    "category_pos" INTEGER NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- 9. Índices de Unicidade e Restrições de Integridade
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "athlete_profiles_user_id_key" ON "athlete_profiles"("user_id");
CREATE UNIQUE INDEX "athlete_profiles_cpf_key" ON "athlete_profiles"("cpf");
CREATE UNIQUE INDEX "registrations_qr_code_hash_key" ON "registrations"("qr_code_hash");
CREATE UNIQUE INDEX "registrations_event_id_athlete_id_key" ON "registrations"("event_id", "athlete_id");
CREATE UNIQUE INDEX "results_registration_id_key" ON "results"("registration_id");

-- 10. Chaves Estrangeiras (Integridade Referencial)
ALTER TABLE "athlete_profiles"
    ADD CONSTRAINT "athlete_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "events"
    ADD CONSTRAINT "events_organizer_id_fkey"
    FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "modalities"
    ADD CONSTRAINT "modalities_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "registration_batches"
    ADD CONSTRAINT "registration_batches_modality_id_fkey"
    FOREIGN KEY ("modality_id") REFERENCES "modalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "registrations"
    ADD CONSTRAINT "registrations_athlete_id_fkey"
    FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "registrations"
    ADD CONSTRAINT "registrations_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "registration_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "registrations"
    ADD CONSTRAINT "registrations_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "results"
    ADD CONSTRAINT "results_registration_id_fkey"
    FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
