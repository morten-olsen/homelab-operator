# homelab-operator

A Kubernetes operator designed for homelab environments that simplifies the
management of PostgreSQL databases and Kubernetes secrets. Built with TypeScript
and designed to run efficiently in resource-constrained environments.

## Features

- **PostgreSQL Database Management**: Automatically create and manage PostgreSQL
  databases and roles
- **Secret Management**: Generate and manage Kubernetes secrets with
  configurable data
- **Owner References**: Automatic cleanup when resources are deleted
- **Status Tracking**: Comprehensive status conditions and error reporting
- **Lightweight**: Minimal resource footprint suitable for homelab environments

## Architecture

The operator manages two main Custom Resource Definitions (CRDs):

### PostgresDatabase

Manages PostgreSQL databases and their associated roles:

- Creates a PostgreSQL role with a secure random password
- Creates a database owned by that role
- Generates a Kubernetes secret containing database credentials
- Ensures proper cleanup through owner references

### SecretRequest

Generates Kubernetes secrets with configurable data:

- Supports custom secret names
- Configurable data fields with various encodings
- Automatic secret lifecycle management

## Installation

### Prerequisites

- Kubernetes cluster (1.20+)
- PostgreSQL instance accessible from the cluster
- Helm 3.x (for chart-based installation)

### Using Helm Chart

1. Clone the repository:

```bash
git clone <repository-url>
cd homelab-operator
```

2. Install using Helm:

```bash
helm install homelab-operator ./chart \
  --set-string env.POSTGRES_HOST=<your-postgres-host> \
  --set-string env.POSTGRES_USER=<admin-user> \
  --set-string env.POSTGRES_PASSWORD=<admin-password>
```

### Using kubectl

1. Build and push the Docker image:

```bash
docker build -t your-registry/homelab-operator:latest .
docker push your-registry/homelab-operator:latest
```

2. Apply the Kubernetes manifests:

```bash
kubectl apply -f chart/templates/
```

## Configuration

The operator is configured through environment variables:

| Variable            | Description                              | Required | Default |
| ------------------- | ---------------------------------------- | -------- | ------- |
| `POSTGRES_HOST`     | PostgreSQL server hostname               | Yes      | -       |
| `POSTGRES_USER`     | PostgreSQL admin username                | Yes      | -       |
| `POSTGRES_PASSWORD` | PostgreSQL admin password                | Yes      | -       |
| `POSTGRES_PORT`     | PostgreSQL server port                   | No       | 5432    |
| `LOG_LEVEL`         | Logging level (debug, info, warn, error) | No       | info    |

## Usage

### PostgreSQL Database

Create a PostgreSQL database with an associated role:

```yaml
apiVersion: homelab.mortenolsen.pro/v1
kind: PostgresDatabase
metadata:
  name: my-app-db
  namespace: my-namespace
spec: {}
```

This will create:

- A PostgreSQL role named `my-app-db`
- A PostgreSQL database named `my-namespace_my-app-db` owned by the role
- A Kubernetes secret `postgres-database-my-app-db` containing:
  - `name`: Base64-encoded database name
  - `user`: Base64-encoded username
  - `password`: Base64-encoded password

### Secret Request

Generate a Kubernetes secret with custom data:

```yaml
apiVersion: homelab.mortenolsen.pro/v1
kind: SecretRequest
metadata:
  name: my-secret
  namespace: my-namespace
spec:
  secretName: app-config
  data:
    - key: api-key
      value: "my-api-key"
      encoding: base64
    - key: database-url
      value: "postgresql://user:pass@host:5432/db"
    - key: random-token
      length: 32
      chars: "abcdefghijklmnopqrstuvwxyz0123456789"
```

### Accessing Created Resources

To retrieve database credentials:

```bash
# Get the secret
kubectl get secret postgres-database-my-app-db -o jsonpath='{.data.user}' | base64 -d
kubectl get secret postgres-database-my-app-db -o jsonpath='{.data.password}' | base64 -d
kubectl get secret postgres-database-my-app-db -o jsonpath='{.data.name}' | base64 -d
```

## Development

### Prerequisites

- [Bun](https://bun.sh/) runtime
- [pnpm](https://pnpm.io/) package manager
- Docker (for building images)
- Access to a Kubernetes cluster for testing

### Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd homelab-operator
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up development environment:

```bash
cp .env.example .env
# Edit .env with your PostgreSQL connection details
```

### Running Locally

For development, you can run the operator locally against a remote cluster:

```bash
# Ensure kubectl is configured for your development cluster
export KUBECONFIG=~/.kube/config

# Set PostgreSQL connection environment variables
export POSTGRES_HOST=localhost
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=yourpassword

# Run the operator
bun run src/index.ts
```

### Development with Docker Compose

A development environment with PostgreSQL is provided:

```bash
docker-compose -f docker-compose.dev.yaml up -d
```

### Building

Build the Docker image:

```bash
docker build -t homelab-operator:latest .
```

### Testing

```bash
# Run linting
pnpm run test:lint

# Apply test resources
kubectl apply -f test.yaml
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and add tests
4. Run linting: `pnpm run test:lint`
5. Commit your changes: `git commit -am 'Add new feature'`
6. Push to the branch: `git push origin feature/new-feature`
7. Submit a pull request

## Project Structure

```
├── chart/                 # Helm chart for deployment
├── src/
│   ├── crds/             # Custom Resource Definitions
│   │   ├── postgres/     # PostgreSQL database management
│   │   └── secrets/      # Secret generation
│   ├── custom-resource/   # Base CRD framework
│   ├── database/         # Database migrations
│   ├── services/         # Core services
│   │   ├── config/       # Configuration management
│   │   ├── k8s.ts        # Kubernetes API client
│   │   ├── log/          # Logging service
│   │   ├── postgres/     # PostgreSQL service
│   │   └── secrets/      # Secret management
│   └── utils/            # Utilities and constants
├── Dockerfile            # Container build configuration
└── docker-compose.dev.yaml  # Development environment
```

## License

This project is licensed under the MIT License - see the LICENSE file for
details.

## Support

For support and questions:

- Create an issue in the GitHub repository
- Check existing issues for similar problems
- Review the logs using `kubectl logs -l app=homelab-operator`

## Status Monitoring

Monitor the operator status:

```bash
# Check operator logs
kubectl logs -l app=homelab-operator -f

# Check CRD status
kubectl get postgresdatabases
kubectl get secretrequests

# Describe resources for detailed status
kubectl describe postgresdatabase my-app-db
kubectl describe secretrequest my-secret
```
