const localDatabaseUrl = "file:./prisma/dev.db";

export function resolveDatabaseUrl(databaseUrl: string | undefined, isVercel: boolean): string {
  const configuredUrl = databaseUrl?.trim();
  if (isVercel && (!configuredUrl || /^file:/i.test(configuredUrl))) {
    throw new Error("Vercel requires a durable DATABASE_URL. Configure a managed libSQL database before building or serving AqizaAI.");
  }
  return configuredUrl || localDatabaseUrl;
}
