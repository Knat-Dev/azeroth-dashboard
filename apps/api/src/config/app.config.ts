export default () => ({
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me',
    expiresIn: '24h',
  },
  soap: {
    host: process.env.SOAP_HOST ?? 'localhost',
    port: parseInt(process.env.SOAP_PORT ?? '7878', 10),
  },
  backup: {
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS ?? '30', 10),
    dir: process.env.BACKUP_DIR ?? (process.env.NODE_ENV === 'production' ? '/backups' : './backups'),
  },
});
