class ConfigService {
  public get postgres() {
    const host = process.env.POSTGRES_HOST;
    const user = process.env.POSTGRES_USER;
    const password = process.env.POSTGRES_PASSWORD;
    const port = process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432;

    if (!host || !user || !password) {
      throw new Error('POSTGRES_HOST, POSTGRES_USER, and POSTGRES_PASSWORD must be set');
    }

    return { host, user, password, port };
  }

  public get authentik() {
    const url = process.env.AUTHENTIK_URL;
    const token = process.env.AUTHENTIK_TOKEN;

    if (!url || !token) {
      throw new Error('AUTHENTIK_URL and AUTHENTIK_TOKEN must be set');
    }

    return { url, token };
  }
}

export { ConfigService };
