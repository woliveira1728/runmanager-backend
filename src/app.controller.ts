import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Status')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Verifica a integridade e status da API' })
  @ApiResponse({ status: 200, description: 'API em funcionamento' })
  getHealth() {
    return this.appService.getStatus();
  }

  @Get()
  @ApiOperation({ summary: 'Informações gerais da API' })
  @ApiResponse({ status: 200, description: 'Metadados da plataforma' })
  getRoot() {
    return this.appService.getStatus();
  }
}
