# RunManager API - Backend

> **Curso Superior de Tecnologia em Análise e Desenvolvimento de Sistemas (ADS)**  
> **Universidade Luterana do Brasil (ULBRA)**  
> **Disciplina:** Projeto Tecnológico em Desenvolvimento de Sistemas  
> **Autor:** Wilson Dias de Oliveira  

---

## 📌 Visão Geral

O **RunManager API** é o servidor de regras de negócio e persistência da plataforma **RunManager**, voltada ao gerenciamento de corridas de rua, controle transacional de inscrições por lotes, credenciamento em arena via leitura de **QR Code** e apuração de tempos oficiais.

### 🔗 Repositórios Relacionados
- **Backend API (este repositório):** `https://github.com/woliveira1728/runmanager-backend`
- **Frontend Web (Next.js):** `https://github.com/woliveira1728/runmanager-frontend`

---

## 🔑 Credenciais de Teste para Avaliação (População via Seed)

Ao executar o comando `npm run prisma:seed`, o banco de dados é populado automaticamente com os 3 perfis de acesso (RBAC) e uma corrida demonstrativa publicada (*"1ª Corrida das Águas de Manaus 2026"*):

| Perfil (Role) | E-mail de Acesso | Senha | Recursos Disponíveis |
| :--- | :--- | :--- | :--- |
| **Atleta (`ATHLETE`)** | `atleta@runmanager.com` | `senha123` | Inscrição em lotes, edição de perfil/LGPD, bilhete digital com QR Code (`RM-DEMO2026MANAUS01`) e visualização de tempo oficial. |
| **Organizador (`ORGANIZER`)** | `organizador@runmanager.com` | `senha123` | Cadastro/publicação de provas, confirmação/cancelamento manual de inscrições, check-in por QR Code e importação de tempos via CSV. |
| **Administrador (`ADMIN`)** | `admin@runmanager.com` | `senha123` | Governança geral de eventos, inscrições, resultados e consulta de usuários. |

---

## 🚀 Tecnologias Utilizadas

- **Runtime e Linguagem:** [Node.js](https://nodejs.org/) (v22+) & [TypeScript](https://www.typescriptlang.org/)
- **Framework Backend:** [NestJS 12](https://nestjs.com/) (Arquitetura modular com injeção de dependência)
- **Banco de Dados:** [PostgreSQL 16](https://www.postgresql.org/)
- **ORM e Migrações:** [Prisma ORM 6](https://www.prisma.io/)
- **Documentação da API:** [Swagger / OpenAPI 3.0](https://swagger.io/) (`/api/docs`)
- **Autenticação e Segurança:** JWT (`@nestjs/jwt`, `passport-jwt`), `bcrypt` (hash de senhas), controle de acesso por papéis (`RolesGuard`) e criptografia simétrica autenticada **AES-256-GCM** (`node:crypto`) para dados sensíveis de saúde/emergência (LGPD)
- **Testes Automatizados:** [Jest](https://jestjs.io/) (77 testes unitários em 8 suítes + teste E2E)
- **Ambiente Local:** [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)

---

## 🗄️ Script de Criação do Banco de Dados e Modelagem Relacional

O esquema relacional completo encontra-se disponível em dois formatos no diretório `prisma/`:
1. **Script SQL Consolidado (DDL):** [`prisma/database_schema.sql`](./prisma/database_schema.sql) — contém todos os comandos `CREATE TYPE`, `CREATE TABLE`, `CREATE UNIQUE INDEX` (incluindo `UNIQUE(event_id, athlete_id)`) e `ADD CONSTRAINT FOREIGN KEY`.
2. **Schema Declarativo Prisma e Migrações:** [`prisma/schema.prisma`](./prisma/schema.prisma) e histórico versionado em `prisma/migrations/`.
3. **Script de População Inicial (Seed):** [`prisma/seed.ts`](./prisma/seed.ts).

### Entidades do Banco de Dados
1. **`users`**: Credenciais de acesso e papel no sistema (`ADMIN`, `ORGANIZER`, `ATHLETE`).
2. **`athlete_profiles`**: Dados esportivos (CPF, nascimento, sexo, camiseta) e dados sensíveis de saúde/emergência criptografados em repouso com registro de consentimento LGPD.
3. **`events`**: Corridas de rua criadas e gerenciadas por organizadores (`DRAFT`, `PUBLISHED`, `FINISHED`).
4. **`modalities`**: Percursos vinculados ao evento (ex.: `5km`, `10km`, `21km`) e idade mínima regulamentar.
5. **`registration_batches`**: Lotes de inscrição com preço, data limite (`end_date`) e contadores de vagas (`max_slots` e `filled_slots`).
6. **`registrations`**: Inscrições com restrição `UNIQUE(event_id, athlete_id)`, número de peito sequencial (`bib_number`), status de pagamento (`PENDING`, `CONFIRMED`, `CANCELLED`), hash do QR Code (`qr_code_hash`) e registro de check-in (`checked_in`, `checked_in_at`).
7. **`results`**: Tempos oficiais bruto (`gross_time`) e líquido (`net_time`) no formato `HH:MM:SS`, colocação geral na modalidade (`overall_pos`) e colocação na faixa etária CBAt (`category_pos`).

---

## ⚙️ Configuração das Variáveis de Ambiente (`.env.example`)

Por segurança, o arquivo `.env` não é versionado no Git (configurado no `.gitignore`). Copie o arquivo `.env.example` para `.env` e preencha os valores conforme a tabela abaixo:

| Variável | Descrição | Valor de Exemplo (Desenvolvimento) |
| :--- | :--- | :--- |
| `PORT` | Porta HTTP de execução da API NestJS | `3001` |
| `NODE_ENV` | Ambiente de execução (`development`, `test`, `production`) | `development` |
| `CORS_ORIGIN` | Lista de URLs permitidas no CORS (separadas por vírgula) | `http://localhost:3000` |
| `DATABASE_URL` | String de conexão com o banco PostgreSQL | `postgresql://usuario:senha@localhost:5432/runmanager_db?schema=public` |
| `JWT_SECRET` | Chave secreta para assinatura dos tokens JWT | `substitua_por_sua_chave_secreta_jwt_aqui` |
| `JWT_EXPIRES_IN` | Tempo de expiração do token JWT | `7d` |
| `ENCRYPTION_KEY` | Chave de 32 bytes para criptografia AES-256-GCM (LGPD) | `substitua_chave_32_bytes_aes256!` |

---

## 🛠️ Passo a Passo para Execução Local

### 1. Clonar o Repositório e Instalar Dependências
```bash
git clone https://github.com/woliveira1728/runmanager-backend.git
cd runmanager-backend
npm install
```

### 2. Configurar Variáveis de Ambiente e Subir o Banco (Docker)
```bash
cp .env.example .env
docker compose up -d
```

### 3. Aplicar Migrações e Executar o Seed de Teste
```bash
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

### 4. Iniciar o Servidor da API
```bash
# Modo desenvolvimento
npm run start:dev

# Modo produção
npm run build
npm run start:prod
```

- **Endpoint Base da API:** `http://localhost:3001/api`
- **Documentação Interativa Swagger:** `http://localhost:3001/api/docs`

---

## 🧪 Execução dos Testes Automatizados

```bash
# Executar suíte de testes unitários (Jest)
npm test

# Executar verificação estática de tipos e linting (Oxlint)
npm run lint

# Executar testes End-to-End (E2E)
npm run test:e2e
```

---

## 📁 Estrutura de Pastas do Código-Fonte

```text
runmanager-backend/
├── prisma/
│   ├── migrations/              # Histórico de migrações SQL do PostgreSQL
│   ├── database_schema.sql      # Script DDL SQL consolidado de criação do banco
│   ├── schema.prisma            # Modelagem declarativa do Prisma ORM
│   └── seed.ts                  # População inicial com usuários de teste e evento demo
├── src/
│   ├── auth/                    # Autenticação JWT, Strategies, Guards RBAC e Decorators (UC01)
│   ├── common/
│   │   ├── crypto/              # Criptografia AES-256-GCM para dados sensíveis LGPD (RNF01)
│   │   └── validators/          # Validador de dígitos verificadores de CPF (Módulo 11)
│   ├── events/                  # Gestão de eventos, modalidades e lotes de inscrição (UC04)
│   ├── prisma/                  # Módulo global de conexão com o PostgreSQL
│   ├── registrations/           # Reserva transacional de vagas, pagamento e check-in QR Code (UC05/UC06)
│   ├── results/                 # Importação CSV e registro de tempos oficiais e ranking CBAt (UC07)
│   ├── users/                   # Cadastro de usuários, manutenção de perfil e consentimento LGPD (UC02/UC03)
│   ├── app.controller.ts        # Verificação de integridade e health check (/api/health)
│   ├── app.module.ts            # Módulo raiz da aplicação
│   └── main.ts                  # Configuração de CORS, ValidationPipe global e Swagger OpenAPI
├── test/                        # Testes integrados End-to-End (E2E)
├── docker-compose.yml           # Contêiner PostgreSQL 16 Alpine para ambiente local
├── .env.example                 # Modelo documentado de variáveis de ambiente (sem credenciais reais)
├── .gitignore                   # Exclusão de .env, node_modules e artefatos de build
└── package.json                 # Scripts de build, testes, migração e deploy
```
