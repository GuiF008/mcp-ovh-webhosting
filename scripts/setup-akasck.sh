#!/bin/bash
# =============================================================================
# Script de configuration AK/AS/CK (Application Key/Secret + Consumer Key)
# Mode recommandé pour la délégation de droits (multi-tenant)
# =============================================================================

set -e

echo "=== Configuration AK/AS/CK OVHcloud ==="
echo ""

# Variables
REGION="${OVH_API_REGION:-eu}"
API_BASE="https://${REGION}.api.ovh.com/1.0"

echo "Région API: $REGION"
echo "URL de base: $API_BASE"
echo ""

# Vérifier si les credentials sont déjà configurés
if [ -n "$OVH_APP_KEY" ] && [ -n "$OVH_APP_SECRET" ] && [ -n "$OVH_CONSUMER_KEY" ]; then
    echo "✓ Credentials AK/AS/CK détectés dans l'environnement"
    echo "  App Key: ${OVH_APP_KEY:0:8}..."
    echo "  Consumer Key: ${OVH_CONSUMER_KEY:0:8}..."
    echo ""
else
    echo "⚠ Credentials AK/AS/CK non détectés (ou incomplets)"
    echo ""
fi

echo "=== Étapes de configuration ==="
echo ""

echo "1. CRÉER UNE APPLICATION"
echo "   a. Allez sur https://${REGION}.api.ovh.com/createApp/"
echo "   b. Connectez-vous avec votre compte OVH"
echo "   c. Remplissez le formulaire :"
echo "      - Application name: mcp-ovh-webhosting"
echo "      - Application description: Serveur MCP pour Web Hosting"
echo "   d. Notez l'Application Key (AK) et l'Application Secret (AS)"
echo ""

echo "2. GÉNÉRER UN CONSUMER KEY"
echo "   Exécutez la commande suivante (remplacez VOTRE_APP_KEY) :"
echo ""

# Access rules pour read-only
echo "   Pour accès READ-ONLY :"
cat << 'EOF'
curl -X POST https://eu.api.ovh.com/1.0/auth/credential \
  -H "X-Ovh-Application: VOTRE_APP_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "accessRules": [
      { "method": "GET", "path": "/hosting/web/*" }
    ],
    "redirection": "https://www.ovh.com"
  }'
EOF
echo ""

# Access rules pour full access
echo "   Pour accès COMPLET (read + write) :"
cat << 'EOF'
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
    "redirection": "https://www.ovh.com"
  }'
EOF
echo ""

echo "   La réponse contiendra :"
cat << 'EOF'
{
  "validationUrl": "https://eu.api.ovh.com/auth/?credentialToken=xxx",
  "consumerKey": "yyy",
  "state": "pending"
}
EOF
echo ""

echo "3. VALIDER LE CONSUMER KEY"
echo "   a. Copiez la validationUrl de la réponse"
echo "   b. Ouvrez cette URL dans votre navigateur"
echo "   c. Connectez-vous et validez les droits demandés"
echo "   d. Choisissez la durée de validité (unlimited recommandé)"
echo ""

echo "4. CONFIGURER L'ENVIRONNEMENT"
echo "   Créez ou modifiez le fichier .env avec :"
echo ""
cat << 'EOF'
OVH_AUTH_MODE=akasck
OVH_API_REGION=eu
OVH_APP_KEY=votre-application-key
OVH_APP_SECRET=votre-application-secret
OVH_CONSUMER_KEY=votre-consumer-key
EOF
echo ""

echo "5. TESTER LA CONFIGURATION"
echo "   npm run dev"
echo ""

echo "=== Access Rules recommandées pour Web Hosting ==="
echo ""
echo "  Lecture uniquement (safe) :"
echo "    { \"method\": \"GET\", \"path\": \"/hosting/web/*\" }"
echo ""
echo "  Accès complet :"
echo "    { \"method\": \"GET\", \"path\": \"/hosting/web/*\" }"
echo "    { \"method\": \"POST\", \"path\": \"/hosting/web/*\" }"
echo "    { \"method\": \"PUT\", \"path\": \"/hosting/web/*\" }"
echo "    { \"method\": \"DELETE\", \"path\": \"/hosting/web/*\" }"
echo ""

echo "=== Délégation multi-tenant ==="
echo ""
echo "Pour permettre à des clients finaux d'utiliser le serveur MCP :"
echo ""
echo "1. Créez une seule Application (AK/AS) pour votre service"
echo "2. Pour chaque client :"
echo "   a. Générez un Consumer Key avec les droits appropriés"
echo "   b. Envoyez la validationUrl au client"
echo "   c. Le client valide les droits depuis son compte OVH"
echo "   d. Stockez le consumerKey associé au client"
echo ""
echo "Chaque client a ainsi son propre consumerKey qui accède"
echo "uniquement à ses services Web Hosting."
echo ""

echo "=== Documentation ==="
echo ""
echo "  - Premiers pas API OVH: https://help.ovhcloud.com/csm/fr-api-getting-started-ovhcloud-api"
echo "  - Délégation de droits: https://help.ovhcloud.com/csm/fr-api-api-rights-delegation"
echo "  - Console API OVH: https://${REGION}.api.ovh.com/console/"
echo ""

echo "Configuration terminée. N'oubliez pas de :"
echo "  1. Créer l'application sur ${REGION}.api.ovh.com/createApp/"
echo "  2. Générer et valider le Consumer Key"
echo "  3. Configurer le fichier .env avec vos credentials"
echo "  4. Ne jamais commiter vos credentials dans le repo"


