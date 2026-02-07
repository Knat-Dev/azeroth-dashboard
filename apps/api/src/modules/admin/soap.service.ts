import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SoapService {
  private readonly logger = new Logger(SoapService.name);
  private readonly host: string;
  private readonly port: number;
  private readonly user: string;
  private readonly password: string;

  constructor(private configService: ConfigService) {
    this.host = configService.get<string>('soap.host', 'localhost');
    this.port = configService.get<number>('soap.port', 7878);
    this.user = configService.get<string>('soap.user', 'admin');
    this.password = configService.get<string>('soap.password', 'admin');
  }

  async executeCommand(command: string): Promise<{ success: boolean; message: string }> {
    const url = `http://${this.host}:${this.port}/`;

    const envelope = `<?xml version="1.0" encoding="utf-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:ns1="urn:AC">
  <SOAP-ENV:Body>
    <ns1:executeCommand>
      <command>${this.escapeXml(command)}</command>
    </ns1:executeCommand>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

    try {
      const response = await axios.post(url, envelope, {
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        auth: { username: this.user, password: this.password },
        timeout: 10000,
      });

      const result = this.parseResponse(response.data);
      return { success: true, message: result };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const faultMessage = this.parseFault(error.response.data);
        this.logger.warn(`SOAP command failed: ${command} -> ${faultMessage}`);
        return { success: false, message: faultMessage };
      }
      this.logger.error(`SOAP connection error: ${error}`);
      return {
        success: false,
        message: 'Failed to connect to worldserver SOAP interface',
      };
    }
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private parseResponse(xml: string): string {
    const match = xml.match(/<result[^>]*>([\s\S]*?)<\/result>/);
    return match?.[1]?.trim() ?? xml;
  }

  private parseFault(xml: string): string {
    const match = xml.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/);
    return match?.[1]?.trim() ?? 'Unknown SOAP error';
  }
}
