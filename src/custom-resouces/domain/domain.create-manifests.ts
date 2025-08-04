type CreateGatewayManifestOptions = {
  name: string;
  namespace: string;
  ref: ExpectedAny;
  gateway: string;
  domain: string;
  secretName: string;
};
const createGatewayManifest = (options: CreateGatewayManifestOptions) => ({
  apiVersion: 'networking.istio.io/v1alpha3',
  kind: 'Gateway',
  metadata: {
    name: options.name,
    namespace: options.namespace,
    ownerReferences: [options.ref],
  },
  spec: {
    selector: {
      istio: options.gateway,
    },
    servers: [
      {
        port: {
          number: 80,
          name: 'http',
          protocol: 'HTTP',
        },
        hosts: [`*.${options.domain}`],
        tls: {
          httpsRedirect: true,
        },
      },
      {
        port: {
          number: 443,
          name: 'https',
          protocol: 'HTTPS',
        },
        hosts: [`*.${options.domain}`],
        tls: {
          mode: 'SIMPLE' as const,
          credentialName: options.secretName,
        },
      },
    ],
  },
});

type CreateCertificateManifestOptions = {
  name: string;
  namespace: string;
  domain: string;
  secretName: string;
  issuer: string;
};
const createCertificateManifest = (options: CreateCertificateManifestOptions) => ({
  apiVersion: 'cert-manager.io/v1',
  kind: 'Certificate',
  metadata: {
    name: options.name,
    namespace: 'istio-ingress',
  },
  spec: {
    secretName: options.secretName,
    dnsNames: [`*.${options.domain}`],
    issuerRef: {
      name: options.issuer,
      kind: 'ClusterIssuer',
    },
  },
});

export { createGatewayManifest, createCertificateManifest };
