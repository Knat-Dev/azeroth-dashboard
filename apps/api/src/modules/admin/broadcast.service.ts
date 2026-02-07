import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Autobroadcast } from '../../entities/auth/autobroadcast.entity.js';
import { SoapService } from './soap.service.js';

@Injectable()
export class BroadcastService {
  constructor(
    @InjectRepository(Autobroadcast, 'auth')
    private autobroadcastRepo: Repository<Autobroadcast>,
    private soapService: SoapService,
  ) {}

  async sendBroadcast(
    message: string,
    type: 'announce' | 'notify' | 'both',
  ) {
    const results = [];
    if (type === 'announce' || type === 'both') {
      results.push(await this.soapService.executeCommand(`.announce ${message}`));
    }
    if (type === 'notify' || type === 'both') {
      results.push(await this.soapService.executeCommand(`.notify ${message}`));
    }
    return results;
  }

  async listAutobroadcasts() {
    return this.autobroadcastRepo.find({ order: { id: 'ASC' } });
  }

  async createAutobroadcast(text: string, weight = 1, realmid = -1) {
    const entry = this.autobroadcastRepo.create({ text, weight, realmid });
    return this.autobroadcastRepo.save(entry);
  }

  async updateAutobroadcast(
    id: number,
    data: Partial<{ text: string; weight: number }>,
  ) {
    await this.autobroadcastRepo.update({ id }, data);
    return this.autobroadcastRepo.findOneBy({ id });
  }

  async deleteAutobroadcast(id: number) {
    await this.autobroadcastRepo.delete({ id });
    return { message: 'Autobroadcast deleted' };
  }

  async reloadAutobroadcast() {
    return this.soapService.executeCommand('.reload autobroadcast');
  }
}
