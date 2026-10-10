import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus() {
    return {
      name: 'RunManager API',
      version: '1.0.0',
      status: 'online',
      description: 'Plataforma de Gestão de Eventos Esportivos e Credenciamento na Arena',
      institution: 'ULBRA - Análise e Desenvolvimento de Sistemas',
      timestamp: new Date().toISOString(),
    };
  }
}
