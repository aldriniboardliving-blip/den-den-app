import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RelayService } from '../relay/relay.service';

@Injectable()
export class DeliveryScheduler {
  private readonly logger = new Logger(DeliveryScheduler.name);

  constructor(private relay: RelayService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async retryFailedDeliveries() {
    try {
      const count = await this.relay.retryFailedDeliveries();
      if (count > 0) {
        this.logger.debug(`Retried ${count} failed deliveries`);
      }
    } catch (error) {
      this.logger.error('Failed to retry deliveries', error);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupExpiredRelayMessages() {
    try {
      const count = await this.relay.cleanupExpiredRelayMessages();
      if (count > 0) {
        this.logger.log(`Cleaned up ${count} expired relay messages`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired relay messages', error);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleAckTimeouts() {
    try {
      const count = await this.relay.handleAckTimeout();
      if (count > 0) {
        this.logger.warn(`Marked ${count} messages as failed due to ACK timeout`);
      }
    } catch (error) {
      this.logger.error('Failed to handle ACK timeouts', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async logRelayStats() {
    try {
      const stats = await this.relay.getRelayStats();
      this.logger.log(`Relay stats: ${JSON.stringify(stats)}`);
    } catch (error) {
      this.logger.error('Failed to get relay stats', error);
    }
  }
}