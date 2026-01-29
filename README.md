# MCP OVHcloud Web Hosting

Serveur MCP (Model Context Protocol) pour piloter les services OVHcloud Web Hosting via les APIs OVH.

## Fonctionnalités

- **8 tools read-only** pour consulter vos services Web Hosting
- **6 tools write** (désactivés par défaut) pour gérer vos services
- **2 modes d'authentification** : OAuth2 Service Account ou AK/AS/CK
- **Gestion des erreurs** avec mapping vers codes MCP standard
- **Rate limiting** côté client (token bucket)
- **Retries automatiques** avec backoff exponentiel
- **Logs structurés** (Pino) avec masquage des secrets
- **Audit logging** des appels de tools

## Prérequis

- Node.js >= 18.0.0
- Un compte OVHcloud avec au moins un service Web Hosting
- Credentials API OVH (voir sections Configuration ci-dessous)

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

## Configuration

### Mode A - OAuth2 Service Account (recommandé)

Ce mode est recommandé pour les automatisations internes et l'usage single-tenant.

#### 1. Créer un Service Account OVH

1. Connectez-vous à votre [Console OVHcloud](https://www.ovh.com/manager/)
2. Allez dans **Mon compte** → **Gestion des comptes** → **Comptes de service**
3. Cliquez sur **Créer un compte de service**
4. Notez le `Client ID` et le `Client Secret` générés

#### 2. Créer une Policy IAM

Créez une policy IAM pour autoriser l'accès aux endpoints Web Hosting :

```json
{
  "name": "webhosting-read",
  "description": "Accès lecture aux services Web Hosting",
  "permissions": {
    "allow": [
      {
        "action": "webHosting:apiovh:get"
      }
    ]
  },
  "resources": [
    {
      "urn": "urn:v1:eu:resource:webHosting:*"
    }
  ]
}
```

Pour les tools d'écriture, ajoutez :
```json
{
  "action": "webHosting:apiovh:create"
},
{
  "action": "webHosting:apiovh:update"
},
{
  "action": "webHosting:apiovh:delete"
}
```

#### 3. Configurer les variables d'environnement

```bash
OVH_AUTH_MODE=oauth2
OVH_API_REGION=eu
OVH_OAUTH_CLIENT_ID=votre-client-id
OVH_OAUTH_CLIENT_SECRET=votre-client-secret
OVH_OAUTH_SCOPE=all
```

### Mode B - AK/AS/CK (Application Key / Secret / Consumer Key)

Ce mode est utile pour la délégation de droits à des clients finaux (multi-tenant).

#### 1. Créer une Application OVH

1. Allez sur [https://eu.api.ovh.com/createApp/](https://eu.api.ovh.com/createApp/)
2. Remplissez le formulaire pour créer une application
3. Notez l'`Application Key` et l'`Application Secret`

#### 2. Obtenir un Consumer Key

```bash
curl -X POST https://eu.api.ovh.com/1.0/auth/credential \
  -H "X-Ovh-Application: VOTRE_APP_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "accessRules": [
      { "method": "GET", "path": "/hosting/web/*" },
      { "method": "POST", "path": "/hosting/web/*" },
      { "method": "PUT", "path": "/hosting/web/*" },
      { "method": "DELETE", "path": "/hosting/web/*" }
    ],
    "redirection": "https://votre-site.com/callback"
  }'
```

Réponse :
```json
{
  "validationUrl": "https://eu.api.ovh.com/auth/?credentialToken=xxx",
  "consumerKey": "yyy",
  "state": "zzz"
}
```

3. Visitez la `validationUrl` pour valider le Consumer Key

#### 3. Configurer les variables d'environnement

```bash
OVH_AUTH_MODE=akasck
OVH_API_REGION=eu
OVH_APP_KEY=votre-application-key
OVH_APP_SECRET=votre-application-secret
OVH_CONSUMER_KEY=votre-consumer-key
```

## Utilisation

### Démarrer le serveur MCP

```bash
# Mode production
npm start

# Mode développement
npm run dev
```

### Configuration dans Cursor

Ajoutez dans votre configuration MCP (`~/.cursor/mcp.json` ou settings) :

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

### Configuration dans Claude Desktop

Ajoutez dans `~/Library/Application Support/Claude/claude_desktop_config.json` :

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

## Exemples d'utilisation

### Lister les services

```
Appel: ovh.webhosting.listServices
Input: {}
```

### Obtenir les détails d'un service

```
Appel: ovh.webhosting.getService
Input: { "serviceName": "monsite.ovh" }
```

### Lister les bases de données

```
Appel: ovh.webhosting.listDatabases
Input: { "serviceName": "monsite.ovh", "mode": "classic" }
```

### Créer une base de données (write)

```
Appel: ovh.webhosting.createDatabase
Input: {
  "serviceName": "monsite.ovh",
  "capacity": "local",
  "type": "mysql",
  "user": "mydbuser"
}
```

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `OVH_AUTH_MODE` | Mode d'auth: `oauth2` ou `akasck` | `oauth2` |
| `OVH_API_REGION` | Région API: `eu` ou `ca` | `eu` |
| `OVH_OAUTH_CLIENT_ID` | Client ID OAuth2 (mode oauth2) | - |
| `OVH_OAUTH_CLIENT_SECRET` | Client Secret OAuth2 (mode oauth2) | - |
| `OVH_OAUTH_SCOPE` | Scope OAuth2 | `all` |
| `OVH_APP_KEY` | Application Key (mode akasck) | - |
| `OVH_APP_SECRET` | Application Secret (mode akasck) | - |
| `OVH_CONSUMER_KEY` | Consumer Key (mode akasck) | - |
| `OVH_HTTP_TIMEOUT_MS` | Timeout HTTP en ms | `30000` |
| `OVH_MAX_RETRIES` | Nombre max de retries | `3` |
| `ENABLE_WRITE_TOOLS` | Activer les tools d'écriture | `false` |
| `LOG_LEVEL` | Niveau de log | `info` |

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
```

## Points à valider

Certains endpoints ou paramètres nécessitent validation dans la console OVH :

1. **Endpoint création FTP/SSH user** : La documentation mentionne un endpoint incohérent.
2. **Paramètre `domain` dans `attachDomain`** : Marqué optionnel mais potentiellement requis.
3. **Actions IAM exactes** : La liste complète des actions IAM pour les writes est à déterminer.
4. **Rate limits OVH** : Non documentés, à déterminer empiriquement.

## Extension multi-tenant (futur)

Pour supporter plusieurs comptes OVH :

1. Stocker les credentials par tenant (KMS/Secret Manager)
2. Implémenter un middleware de routing tenant → auth provider
3. Utiliser le flow de délégation OAuth2 ou CK pour onboarder des clients

## Licence

MIT

## Ressources

- [Documentation API OVHcloud](https://eu.api.ovh.com/console/)
- [Guide Service Accounts OVH](https://help.ovhcloud.com/csm/en-api-service-account-connection)
- [Guide API OVH (AK/AS/CK)](https://help.ovhcloud.com/csm/fr-api-getting-started-ovhcloud-api)
- [Model Context Protocol](https://modelcontextprotocol.io/)


