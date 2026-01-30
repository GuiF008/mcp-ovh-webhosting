#!/bin/bash
# Guide de configuration AK/AS/CK pour OVHcloud

echo "=== Configuration AK/AS/CK OVHcloud ==="
echo ""
echo "1. Créer une application sur https://eu.api.ovh.com/createApp/"
echo ""
echo "2. Générer un Consumer Key :"
echo '   curl -X POST https://eu.api.ovh.com/1.0/auth/credential \'
echo '     -H "X-Ovh-Application: VOTRE_APP_KEY" \'
echo '     -H "Content-Type: application/json" \'
echo '     -d '"'"'{"accessRules":[{"method":"GET","path":"/hosting/web/*"}]}'"'"
echo ""
echo "3. Valider le Consumer Key via l'URL retournée"
echo ""
echo "4. Configurer les variables d'environnement :"
echo "   OVH_AUTH_MODE=akasck"
echo "   OVH_APP_KEY=<app-key>"
echo "   OVH_APP_SECRET=<app-secret>"
echo "   OVH_CONSUMER_KEY=<consumer-key>"
