# MCP OVHcloud Web Hosting

Serveur MCP (Model Context Protocol) pour piloter les services OVHcloud Web Hosting via les APIs OVH.

## Fonctionnalités

- **8 tools read-only** pour consulter vos services Web Hosting
- **6 tools write** (désactivés par défaut) pour gérer vos services
- **2 modes de transport** : stdio (Cursor, Claude Desktop) ou HTTP (SHAI)
- **3 modes d'authentification** : Bearer passthrough, OAuth2 Service Account, AK/AS/CK
- **Gestion des erreurs** avec mapping vers codes MCP standard
- **Rate limiting** côté client (token bucket)
- **Retries automatiques** avec backoff exponentiel
- **Logs structurés** (Pino) avec masquage des secrets
- **Audit logging** des appels de tools

## Prérequis

- Node.js >= 18.0.0
- Un compte OVHcloud avec au moins un service Web Hosting
- Credentials API OVH (selon le mode d'authentification choisi)

## Installation

```bash
# Cloner le repo
git clone <repository-url>
cd mcp-ovh-webhosting

# Installer les dépendances
npm install

# Copier la configuration exemple
cp env.example .env

# Compiler le TypeScript
npm run build
```

## Modes de Transport

### Mode stdio (défaut)

Pour les clients MCP locaux comme Cursor ou Claude Desktop.

```bash
# Démarrer en mode stdio
npm start
# ou
npm run dev
```

### Mode HTTP (pour SHAI)

Pour les clients HTTP comme SHAI. Expose un endpoint `/mcp` avec SSE.

```bash
# Démarrer en mode HTTP
npm run start:http
# ou
MCP_TRANSPORT=http npm start
# ou
MCP_TRANSPORT=http MCP_HTTP_PORT=8080 npm run dev
```

Le serveur affiche :
```
MCP Server is running on http://0.0.0.0:8080/mcp
```

## Configuration avec SHAI

### 1. Démarrer le serveur MCP sur votre SDEV

```bash
cd mcp-ovh-webhosting
MCP_TRANSPORT=http MCP_HTTP_PORT=<VOTRE_PORT_SDEV> npm run start:http
```

Remplacez `<VOTRE_PORT_SDEV>` par un port dans la plage autorisée de votre SDEV :
```bash
cat /etc/ovh.conf.d/sdev.conf | grep "SDEV_PORT_"
```

### 2. Configurer l'agent SHAI

Créez le fichier `~/.config/shai/agents/ovh_webhosting.config` :

```json
{
  "name": "ovh_webhosting",
  "description": "Agent pour piloter OVHcloud Web Hosting",
  "llm_provider": {
    "provider": "ovhcloud",
    "env_vars": {
      "OVH_API_KEY": "votre_AI_endpoints_token"
    },
    "model": "Qwen3-Coder-30B-A3B-Instruct",
    "tool_method": "FunctionCall"
  },
  "tools": {
    "builtin": ["*"],
    "builtin_excluded": [],
    "mcp": {
      "ovh": {
        "config": {
          "type": "http",
          "url": "http://gw2sdev-docker.ovh.net:<VOTRE_PORT_SDEV>/mcp",
          "bearer_token": "votre_token_api_ovh"
        },
        "enabled_tools": ["*"],
        "excluded_tools": []
      }
    }
  },
  "system_prompt": "{{CODER_BASE}}",
  "max_tokens": 1000000,
  "temperature": 0.0
}
```

### 3. Lancer SHAI

```bash
shai agent ovh_webhosting
```

Vous verrez les tools MCP disponibles :
```
░ MCP 'ovh' connected (authenticated)
░ mcp(ovh): ovh.webhosting.listServices, ovh.webhosting.getService, ...
```

## Modes d'authentification OVH

### Mode Bearer (passthrough) - Recommandé pour SHAI

Le token est passé par le client MCP (SHAI) et transmis tel quel à l'API OVH.

```bash
# Configuration minimale pour mode HTTP + Bearer
MCP_TRANSPORT=http
OVH_AUTH_MODE=bearer  # Défaut en mode HTTP
OVH_API_REGION=eu
```

Le `bearer_token` configuré dans SHAI est automatiquement utilisé pour authentifier les appels à l'API OVH.

### Mode OAuth2 Service Account

Pour les automatisations internes sans SHAI.

```bash
OVH_AUTH_MODE=oauth2
OVH_API_REGION=eu
OVH_OAUTH_CLIENT_ID=votre-client-id
OVH_OAUTH_CLIENT_SECRET=votre-client-secret
OVH_OAUTH_SCOPE=all
```

#### Créer un Service Account

1. Connectez-vous à la [Console OVHcloud](https://www.ovh.com/manager/)
2. **Mon compte** → **Gestion des comptes** → **Comptes de service**
3. **Créer un compte de service**
4. Notez le `Client ID` et `Client Secret`

#### Créer une Policy IAM

```json
{
  "name": "webhosting-full-access",
  "description": "Accès complet aux services Web Hosting",
  "permissions": {
    "allow": [
      { "action": "webHosting:apiovh:get" },
      { "action": "webHosting:apiovh:create" },
      { "action": "webHosting:apiovh:update" },
      { "action": "webHosting:apiovh:delete" }
    ]
  },
  "resources": [
    { "urn": "urn:v1:eu:resource:webHosting:*" }
  ]
}
```

### Mode AK/AS/CK

Pour la délégation de droits ou l'usage avec des applications existantes.

```bash
OVH_AUTH_MODE=akasck
OVH_API_REGION=eu
OVH_APP_KEY=votre-application-key
OVH_APP_SECRET=votre-application-secret
OVH_CONSUMER_KEY=votre-consumer-key
```

## Configuration dans Cursor / Claude Desktop

Pour les clients MCP locaux, utilisez le mode stdio :

### Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "ovh-webhosting": {
      "command": "node",
      "args": ["/chemin/vers/mcp-ovh-webhosting/dist/server.js"],
      "env": {
        "OVH_AUTH_MODE": "oauth2",
        "OVH_API_REGION": "eu",
        "OVH_OAUTH_CLIENT_ID": "votre-client-id",
        "OVH_OAUTH_CLIENT_SECRET": "votre-client-secret"
      }
    }
  }
}
```

### Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "ovh-webhosting": {
      "command": "node",
      "args": ["/chemin/vers/mcp-ovh-webhosting/dist/server.js"],
      "env": {
        "OVH_AUTH_MODE": "oauth2",
        "OVH_API_REGION": "eu",
        "OVH_OAUTH_CLIENT_ID": "votre-client-id",
        "OVH_OAUTH_CLIENT_SECRET": "votre-client-secret"
      }
    }
  }
}
```

## Tools disponibles

### Read-only (MVP)

| Tool | Description | Endpoint OVH |
|------|-------------|--------------|
| `ovh.webhosting.listServices` | Liste tous les services Web Hosting | `GET /hosting/web/` |
| `ovh.webhosting.getService` | Détails d'un service | `GET /hosting/web/{serviceName}` |
| `ovh.webhosting.getActiveConfiguration` | Configuration active | `GET /hosting/web/{serviceName}/configuration` |
| `ovh.webhosting.listDatabases` | Liste les bases de données | `GET /hosting/web/{serviceName}/database` |
| `ovh.webhosting.listFtpUsers` | Liste les utilisateurs FTP/SSH | `GET /hosting/web/{serviceName}/user` |
| `ovh.webhosting.listModuleCatalog` | Catalogue des modules | `GET /hosting/web/moduleList` |
| `ovh.webhosting.getModuleCatalogItem` | Détails d'un module | `GET /hosting/web/moduleList/{id}` |
| `ovh.webhosting.listDatabaseDumps` | Liste les dumps d'une BDD | `GET /hosting/web/{serviceName}/database/{name}/dump` |

### Write (nécessite ENABLE_WRITE_TOOLS=true)

| Tool | Description | Endpoint OVH |
|------|-------------|--------------|
| `ovh.webhosting.attachDomain` | Attache un domaine | `POST /hosting/web/{serviceName}/attachedDomain` |
| `ovh.webhosting.installSsl` | Installe un certificat SSL | `POST /hosting/web/{serviceName}/ssl` |
| `ovh.webhosting.createDatabase` | Crée une base de données | `POST /hosting/web/{serviceName}/database` |
| `ovh.webhosting.createDatabaseDump` | Crée un dump de BDD | `POST /hosting/web/{serviceName}/database/{name}/dump` |
| `ovh.webhosting.restoreDatabaseDump` | **[DESTRUCTIF]** Restaure un dump | `POST /hosting/web/{serviceName}/database/{name}/dump/{id}/restore` |
| `ovh.webhosting.installModule` | Installe un module (WordPress, etc.) | `POST /hosting/web/{serviceName}/module` |

## Variables d'environnement

### Transport MCP

| Variable | Description | Défaut |
|----------|-------------|--------|
| `MCP_TRANSPORT` | Mode de transport: `stdio` ou `http` | `stdio` |
| `MCP_HTTP_PORT` | Port HTTP (mode http) | `8080` |
| `MCP_HTTP_PATH` | Chemin de l'endpoint MCP | `/mcp` |
| `MCP_HTTP_HOST` | Host HTTP | `0.0.0.0` |

### Authentification OVH

| Variable | Description | Défaut |
|----------|-------------|--------|
| `OVH_AUTH_MODE` | Mode d'auth: `bearer`, `oauth2`, `akasck` | `bearer` (http) / `oauth2` (stdio) |
| `OVH_API_REGION` | Région API: `eu` ou `ca` | `eu` |
| `OVH_OAUTH_CLIENT_ID` | Client ID OAuth2 (mode oauth2) | - |
| `OVH_OAUTH_CLIENT_SECRET` | Client Secret OAuth2 (mode oauth2) | - |
| `OVH_OAUTH_SCOPE` | Scope OAuth2 | `all` |
| `OVH_APP_KEY` | Application Key (mode akasck) | - |
| `OVH_APP_SECRET` | Application Secret (mode akasck) | - |
| `OVH_CONSUMER_KEY` | Consumer Key (mode akasck) | - |

### Configuration HTTP OVH

| Variable | Description | Défaut |
|----------|-------------|--------|
| `OVH_HTTP_TIMEOUT_MS` | Timeout HTTP en ms | `30000` |
| `OVH_MAX_RETRIES` | Nombre max de retries | `3` |

### Features

| Variable | Description | Défaut |
|----------|-------------|--------|
| `ENABLE_WRITE_TOOLS` | Activer les tools d'écriture | `false` |
| `LOG_LEVEL` | Niveau de log | `info` |

## Endpoints HTTP

En mode HTTP, le serveur expose :

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/mcp` | GET | SSE endpoint pour connexion MCP |
| `/mcp` | POST | Messages MCP |
| `/health` | GET | Health check |
| `/info` | GET | Informations sur le serveur et les tools |

## Développement

```bash
# Lancer les tests
npm test

# Tests en mode watch
npm run test:watch

# Linting
npm run lint

# Formatage
npm run format

# Build
npm run build
```

## Points à valider

Certains endpoints ou paramètres nécessitent validation dans la console OVH :

1. **Endpoint création FTP/SSH user** : La documentation mentionne un endpoint incohérent.
2. **Paramètre `domain` dans `attachDomain`** : Marqué optionnel mais potentiellement requis.
3. **Actions IAM exactes** : La liste complète des actions IAM pour les writes est à déterminer.
4. **Rate limits OVH** : Non documentés, à déterminer empiriquement.

## Licence

MIT

## Ressources

- [Documentation API OVHcloud](https://eu.api.ovh.com/console/)
- [Guide Service Accounts OVH](https://help.ovhcloud.com/csm/en-api-service-account-connection)
- [Guide API OVH (AK/AS/CK)](https://help.ovhcloud.com/csm/fr-api-getting-started-ovhcloud-api)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [SHAI Documentation](https://stash.ovh.net/)
