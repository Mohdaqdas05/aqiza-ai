export type AuthProviderId = "google" | "github";

type AuthEnvironment = {
  AUTH_GOOGLE_ID?: string;
  AUTH_GOOGLE_SECRET?: string;
  AUTH_GITHUB_ID?: string;
  AUTH_GITHUB_SECRET?: string;
};

function credentialsPresent(clientId: string | undefined, clientSecret: string | undefined): boolean {
  return Boolean(clientId?.trim() && clientSecret?.trim());
}

export function getConfiguredAuthProviders(environment: AuthEnvironment = process.env as AuthEnvironment): AuthProviderId[] {
  const providers: AuthProviderId[] = [];

  if (credentialsPresent(environment.AUTH_GOOGLE_ID, environment.AUTH_GOOGLE_SECRET)) {
    providers.push("google");
  }
  if (credentialsPresent(environment.AUTH_GITHUB_ID, environment.AUTH_GITHUB_SECRET)) {
    providers.push("github");
  }

  return providers;
}
