function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env, fill in real values, and restart the dev server.`
    );
  }
  return value;
}

export const env = {
  auth0Domain: required('EXPO_PUBLIC_AUTH0_DOMAIN', process.env.EXPO_PUBLIC_AUTH0_DOMAIN),
  auth0ClientId: required('EXPO_PUBLIC_AUTH0_CLIENT_ID', process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID),
  auth0Audience: process.env.EXPO_PUBLIC_AUTH0_AUDIENCE,
  apiUrl: required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
};
