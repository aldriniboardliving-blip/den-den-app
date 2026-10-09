import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DeliveryScheduler } from './delivery.scheduler';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [DeliveryScheduler],
  exports: [DeliveryScheduler],
})
export class SchedulerModule {}