import { Module, forwardRef } from '@nestjs/common';
import { MonitorModule } from '../monitor/monitor.module.js';
import { WebhookService } from './webhook.service.js';

@Module({
  imports: [forwardRef(() => MonitorModule)],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
