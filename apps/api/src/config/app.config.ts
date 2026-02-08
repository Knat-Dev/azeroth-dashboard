export default () => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === 'change-me') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'JWT_SECRET must be set in production. Generate one with: openssl rand -base64 32',
      );
    }
    console.warn(
      '[WARN] JWT_SECRET not set — using insecure default. Set JWT_SECRET in .env before deploying.',
    );
  }

  const soapUser = process.env.SOAP_USER ?? 'admin';
  const soapPassword = process.env.SOAP_PASSWORD ?? 'admin';
  if (
    soapUser === 'admin' &&
    soapPassword === 'admin' &&
    process.env.NODE_ENV === 'production'
  ) {
    console.warn(
      '[WARN] SOAP using default admin/admin credentials. Set SOAP_USER and SOAP_PASSWORD in .env.',
    );
  }

  return {
    jwt: {
      secret: jwtSecret ?? 'change-me-dev-only',
      expiresIn: '24h',
    },
    soap: {
      host: process.env.SOAP_HOST ?? 'localhost',
      port: parseInt(process.env.SOAP_PORT ?? '7878', 10),
      user: soapUser,
      password: soapPassword,
    },
    backup: {
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS ?? '30', 10),
      dir:
        process.env.BACKUP_DIR ??
        (process.env.NODE_ENV === 'production' ? '/backups' : './backups'),
    },
  };
};
