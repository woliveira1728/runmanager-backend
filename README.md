# RunManager API - Backend

> **Curso Superior de Tecnologia em Análise e Desenvolvimento de Sistemas (ADS)**  
> **Universidade Luterana do Brasil (ULBRA)**  
> **Disciplina:** Projeto Tecnológico em Desenvolvimento de Sistemas  
> **Autor:** Wilson Dias de Oliveira  

---

## 📌 Visão Geral

O **RunManager API** é o núcleo de serviços e regras de negócio da plataforma **RunManager**, concebida para modernizar a gestão de corridas de rua e eventos esportivos, eliminando gargalos no credenciamento em arena por meio de validação transacional e leitura de credenciais com **QR Code em tempo real**.

O projeto atende às diretrizes de engenharia de software da AP2, com arquitetura modular, persistência relacional com integridade estrita, conformidade com a **LGPD** para proteção de dados sensíveis e documentação interativa com **OpenAPI / Swagger**.

---

## 🚀 Tecnologias e Ferramentas

- **Linguagem & Runtime:** [Node.js](https://nodejs.org/) (v22+) & [TypeScript](https://www.typescriptlang.org/)
- **Framework Web:** [NestJS](https://nestjs.com/) (Arquitetura modular, injeção de dependência e desacoplamento)
- **Banco de Dados:** [PostgreSQL 16](https://www.postgresql.org/)
- **ORM:** [Prisma ORM](https://www.prisma.io/) (migrações declarativas, integridade referencial e tipagem estrita)
- **Documentação de API:** [Swagger (OpenAPI 3.0)](https://swagger.io/)
- **Autenticação & Segurança:** JWT (`@nestjs/jwt`, `passport-jwt`), `bcrypt` para hash criptográfica e RBAC (*Role-Based Access Control*)
- **Qualidade & Testes:** [Jest](https://jestjs.io/) para testes unitários automatizados
- **Conteinerização:** [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)

---

## 🗄️ Modelo Relacional de Dados

O banco de dados relacional foi modelado no PostgreSQL via Prisma contendo as seguintes entidades essenciais:

1. **`users`**: Armazenamento de credenciais e controle de papéis (`ADMIN`, `ORGANIZER`, `ATHLETE`).
2. **`athlete_profiles`**: Extensão 1:1 do usuário contendo dados esportivos e sensíveis de saúde criptografados em repouso com consentimento LGPD.
3. **`events`**: Cadastro de corridas de rua gerenciadas por organizadores.
4. **`modalities`**: Percursos e distâncias (ex: 5km, 10km, 21km) com idades mínimas regulamentares.
5. **`registration_batches`**: Lotes de vagas com controle transacional estrito de esgotamento e precificação.
6. **`registrations`**: Inscrição individual com número de peito, status de pagamento, token único de QR Code e confirmação de check-in na arena.
7. **`results`**: Importação de tempos oficiais (líquido e bruto) e cálculo de classificação geral e por categoria.

---

## ⚙️ Pré-requisitos

- **Node.js** >= 20.x (Recomendado v22+)
- **npm** >= 10.x
- **Docker** e **Docker Compose** instalados e em execução

---

## 🛠️ Passo a Passo para Execução Local

### 1. Clonar o Repositório e Instalar Dependências
```bash
git clone git@github.com:woliveira1728/runmanager-backend.git
cd runmanager-backend
npm install
```

### 2. Configurar Variáveis de Ambiente
Copie o arquivo de exemplo `.env.example` para `.env`:
```bash
cp .env.example .env
```

### 3. Iniciar o Banco de Dados com Docker
Inicie o contêiner do PostgreSQL via Docker Compose:
```bash
docker compose up -d
```

### 4. Executar Migrações e Gerar o Prisma Client
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 5. Iniciar a Aplicação
```bash
# Modo desenvolvimento (com hot-reload)
npm run start:dev

# Modo produção
npm run build
npm run start:prod
```

A API estará disponível em: `http://localhost:3001/api`

---

## 📖 Documentação Interativa (Swagger)

Com o servidor em execução, acesse a documentação interativa de todos os contratos e endpoints REST:

🔗 **Swagger UI:** [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

---

## 🧪 Testes Automatizados

Para executar os testes unitários:

```bash
# Executar todos os testes
npm test

# Executar testes em modo watch
npm run test:watch

# Gerar relatório de cobertura de código
npm run test:cov
```

---

## 📁 Estrutura de Pastas

```text
runmanager-backend/
├── prisma/
│   └── schema.prisma        # Modelo relacional e definições do Prisma ORM
├── src/
│   ├── prisma/              # Módulo e serviço de conexão com o banco
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── app.controller.ts    # Controladores de status e verificação da API
│   ├── app.controller.spec.ts # Testes unitários do controlador
│   ├── app.module.ts        # Módulo raiz da aplicação
│   ├── app.service.ts       # Serviços auxiliares de saúde da aplicação
│   └── main.ts              # Ponto de entrada com Swagger, CORS e Validações
├── docker-compose.yml       # Orquestração do contêiner PostgreSQL
├── .env.example             # Modelo das variáveis de ambiente
├── jest.config.ts           # Configuração de testes automatizados com Jest
├── package.json             # Dependências e scripts do projeto
└── tsconfig.json            # Configuração do TypeScript
```
