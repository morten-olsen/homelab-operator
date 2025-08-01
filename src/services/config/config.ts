class ConfigService {
  public get istio() {
    const gateway = process.env.ISTIO_GATEWAY;
    if (!gateway) {
      throw new Error('ISTIO_GATEWAY must be set');
    }
    return {
      gateway: process.env.ISTIO_GATEWAY,
    };
  }

  public get certManager() {
    const certManager = process.env.CERT_MANAGER;
    if (!certManager) {
      throw new Error('CERT_MANAGER must be set');
    }
    return certManager;
  }

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
}

export { ConfigService };
