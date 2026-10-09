import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DevicesModule } from './devices/devices.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { RelayModule } from './relay/relay.module';
import { DeliveryModule } from './delivery/delivery.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { MultiDeviceModule } from './multidevice/multidevice.module';
import { DatabaseModule } from './common/database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    DevicesModule,
    ConversationsModule,
    MessagesModule,
    RelayModule,
    DeliveryModule,
    AttachmentsModule,
    NotificationsModule,
    HealthModule,
    RealtimeModule,
    SchedulerModule,
    MultiDeviceModule,
  ],
})
export class AppModule {}