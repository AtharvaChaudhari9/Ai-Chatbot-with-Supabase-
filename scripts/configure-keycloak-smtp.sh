#!/bin/bash
# Script to configure SMTP Email Server settings in Keycloak for chatbot-realm

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

SMTP_HOST="${1:-smtp.gmail.com}"
SMTP_PORT="${2:-587}"
SMTP_FROM="${3:-noreply@cognexa.ai}"
SMTP_USER="${4:-}"
SMTP_PASSWORD="${5:-}"

if [ -z "$SMTP_USER" ] || [ -z "$SMTP_PASSWORD" ]; then
  echo "Usage: $0 <SMTP_HOST> <SMTP_PORT> <SMTP_FROM_EMAIL> <SMTP_USERNAME> <SMTP_PASSWORD>"
  echo "Example for Gmail: $0 smtp.gmail.com 587 your-email@gmail.com your-email@gmail.com 'your-app-password'"
  exit 1
fi

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

echo "Configuring SMTP Server on chatbot-realm..."

UPDATE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X PUT "${KEYCLOAK_URL}/admin/realms/chatbot-realm" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"resetPasswordAllowed\": true,
    \"smtpServer\": {
      \"host\": \"${SMTP_HOST}\",
      \"port\": \"${SMTP_PORT}\",
      \"from\": \"${SMTP_FROM}\",
      \"fromDisplayName\": \"Cognexa AI\",
      \"auth\": \"true\",
      \"ssl\": \"false\",
      \"starttls\": \"true\",
      \"user\": \"${SMTP_USER}\",
      \"password\": \"${SMTP_PASSWORD}\"
    }
  }")

HTTP_STATUS=$(echo "$UPDATE_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)

if [ "$HTTP_STATUS" -eq 204 ] || [ "$HTTP_STATUS" -eq 200 ]; then
  echo "SUCCESS: SMTP Server configured successfully for chatbot-realm!"
  echo "Keycloak can now send password reset emails."
else
  echo "Failed to configure SMTP. HTTP Status: $HTTP_STATUS"
  echo "Details: $UPDATE_RESPONSE"
  exit 1
fi
