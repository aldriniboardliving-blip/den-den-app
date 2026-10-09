import { Module } from '@nestjs/common';
import { MultiDeviceService } from './multidevice.service';
import { MultiDeviceController } from './multidevice.controller';
import { DevicesModule } from '../devices/devices.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { CryptoModule } from '../crypto/crypto.module';

@Module({
  imports: [DevicesModule, ConversationsModule, MessagesModule, CryptoModule],
  providers: [MultiDeviceService],
  controllers: [MultiDeviceController],
  exports: [MultiDeviceService],
})
export class MultiDeviceModule {}