import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async liveness() {
    return this.health.checkLiveness();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service not ready' })
  async readiness() {
    const result = await this.health.checkReadiness();
    if (result.status !== 'ready') {
      return { ...result, statusCode: 503 };
    }
    return result;
  }

  @Get('info')
  @ApiOperation({ summary: 'Service information' })
  @ApiResponse({ status: 200, description: 'Service info' })
  async info() {
    return this.health.getInfo();
  }
}