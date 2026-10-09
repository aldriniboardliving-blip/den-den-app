import { Module } from '@nestjs/common';
import { SignalStore } from './signal/signal-store';
import { SignalService } from './signal/signal.service';

@Module({
  providers: [SignalStore, SignalService],
  exports: [SignalStore, SignalService],
})
export class CryptoModule {}