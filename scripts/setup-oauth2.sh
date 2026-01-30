#!/bin/bash
# Guide de configuration OAuth2 Service Account pour OVHcloud

echo "=== Configuration OAuth2 Service Account OVHcloud ==="
echo ""
echo "1. Créer un Service Account sur https://www.ovh.com/manager/"
echo "   Mon compte → Gestion des comptes → Comptes de service"
echo ""
echo "2. Créer une Policy IAM avec les permissions webHosting:apiovh:*"
echo ""
echo "3. Configurer les variables d'environnement :"
echo "   OVH_AUTH_MODE=oauth2"
echo "   OVH_OAUTH_CLIENT_ID=<client-id>"
echo "   OVH_OAUTH_CLIENT_SECRET=<client-secret>"
echo ""
echo "Documentation : https://help.ovhcloud.com/csm/en-api-service-account-connection"
