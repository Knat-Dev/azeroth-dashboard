import { Module, forwardRef } from '@nestjs/common';
import { DockerModule } from '../docker/docker.module.js';
import { AdminModule } from '../admin/admin.module.js';
import { WebhookModule } from '../webhook/webhook.module.js';
import { ServerModule } from '../server/server.module.js';
import { MonitorService } from './monitor.service.js';
import { EventService } from './event.service.js';

@Module({
  imports: [
    DockerModule,
    forwardRef(() => AdminModule),
    forwardRef(() => WebhookModule),
    forwardRef(() => ServerModule),
  ],
  providers: [MonitorService, EventService],
  exports: [MonitorService, EventService],
})
export class MonitorModule {}
