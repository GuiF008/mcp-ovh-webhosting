#!/bin/bash
# =============================================================================
# Script de configuration OAuth2 Service Account pour OVHcloud
# =============================================================================

set -e

echo "=== Configuration OAuth2 Service Account OVHcloud ==="
echo ""

# Vérifier si les credentials sont déjà configurés
if [ -n "$OVH_OAUTH_CLIENT_ID" ] && [ -n "$OVH_OAUTH_CLIENT_SECRET" ]; then
    echo "✓ Credentials OAuth2 détectés dans l'environnement"
    echo "  Client ID: ${OVH_OAUTH_CLIENT_ID:0:8}..."
    echo ""
else
    echo "⚠ Credentials OAuth2 non détectés"
    echo ""
fi

echo "=== Étapes de configuration ==="
echo ""

echo "1. CRÉER UN SERVICE ACCOUNT"
echo "   a. Connectez-vous à https://www.ovh.com/manager/"
echo "   b. Allez dans: Mon compte → Gestion des comptes → Comptes de service"
echo "   c. Cliquez sur 'Créer un compte de service'"
echo "   d. Notez le Client ID et Client Secret générés"
echo ""

echo "2. CRÉER UNE POLICY IAM"
echo "   a. Dans la console OVH, allez dans: Mon compte → IAM → Policies"
echo "   b. Créez une nouvelle policy avec le JSON suivant:"
echo ""
cat << 'EOF'
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
EOF
echo ""

echo "   Pour accès read-only uniquement:"
echo ""
cat << 'EOF'
{
  "name": "webhosting-read-only",
  "description": "Accès lecture aux services Web Hosting",
  "permissions": {
    "allow": [
      { "action": "webHosting:apiovh:get" }
    ]
  },
  "resources": [
    { "urn": "urn:v1:eu:resource:webHosting:*" }
  ]
}
EOF
echo ""

echo "3. ASSOCIER LA POLICY AU SERVICE ACCOUNT"
echo "   a. Allez dans: Mon compte → IAM → Identities"
echo "   b. Sélectionnez votre service account"
echo "   c. Ajoutez la policy créée à l'étape 2"
echo ""

echo "4. CONFIGURER L'ENVIRONNEMENT"
echo "   Créez ou modifiez le fichier .env avec:"
echo ""
cat << 'EOF'
OVH_AUTH_MODE=oauth2
OVH_API_REGION=eu
OVH_OAUTH_CLIENT_ID=votre-client-id
OVH_OAUTH_CLIENT_SECRET=votre-client-secret
OVH_OAUTH_SCOPE=all
EOF
echo ""

echo "5. TESTER LA CONFIGURATION"
echo "   npm run dev"
echo ""

echo "=== Actions IAM disponibles pour Web Hosting ==="
echo ""
echo "  - webHosting:apiovh:get      : Lecture (GET)"
echo "  - webHosting:apiovh:create   : Création (POST)"
echo "  - webHosting:apiovh:update   : Modification (PUT)"
echo "  - webHosting:apiovh:delete   : Suppression (DELETE)"
echo ""

echo "=== Ressources ==="
echo ""
echo "  Format URN: urn:v1:{region}:resource:webHosting:{serviceName}"
echo "  Exemples:"
echo "    - urn:v1:eu:resource:webHosting:*           (tous les services)"
echo "    - urn:v1:eu:resource:webHosting:monsite.ovh (service spécifique)"
echo ""

echo "=== Documentation ==="
echo ""
echo "  - Guide Service Accounts: https://help.ovhcloud.com/csm/en-api-service-account-connection"
echo "  - Console API OVH: https://eu.api.ovh.com/console/"
echo ""

echo "Configuration terminée. N'oubliez pas de :"
echo "  1. Créer le service account et la policy dans la console OVH"
echo "  2. Configurer le fichier .env avec vos credentials"
echo "  3. Ne jamais commiter vos credentials dans le repo"


