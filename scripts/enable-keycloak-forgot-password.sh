#!/bin/bash
# Script to enable Forgot Password and Email Password Change Confirmation in Keycloak chatbot-realm

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

echo "Obtaining Keycloak Master Admin token..."
TOKEN_RESPONSE=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=${ADMIN_USER}" \
  -d "password=${ADMIN_PASSWORD}")

ADMIN_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "Error: Failed to obtain Keycloak Admin token. Check credentials."
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "Successfully authenticated with Keycloak Admin API."
echo "Enabling resetPasswordAllowed & Email Event Notifications on chatbot-realm..."

UPDATE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${KEYCLOAK_URL}/admin/realms/chatbot-realm" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "resetPasswordAllowed": true,
    "eventsEnabled": true,
    "eventsListeners": ["jboss-logging", "email"]
  }')

if [ "$UPDATE_RESPONSE" -eq 204 ] || [ "$UPDATE_RESPONSE" -eq 200 ]; then
  echo "SUCCESS: Forgot Password & Password Change Email Notifications enabled for chatbot-realm!"
else
  echo "Failed to update realm. HTTP Status: $UPDATE_RESPONSE"
  exit 1
fi
