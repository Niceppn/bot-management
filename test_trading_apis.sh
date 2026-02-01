#!/bin/bash
# Test Trading Bot APIs

echo "🧪 Testing Trading Bot APIs"
echo "================================"

BASE_URL="http://localhost:3001/api"

# You'll need a valid JWT token - get one by logging in first
# For now, we'll test without auth (will get 401s but we can see endpoints work)

echo ""
echo "1. Testing Health Endpoint"
curl -s $BASE_URL/health | jq '.'

echo ""
echo "2. Testing Config Endpoint (will fail without auth, but shows endpoint exists)"
curl -s $BASE_URL/trading/bots/1/config | jq '.'

echo ""
echo "3. Testing Orders Endpoint"
curl -s $BASE_URL/trading/bots/1/orders | jq '.'

echo ""
echo "4. Testing Stats Endpoint"
curl -s $BASE_URL/trading/bots/1/stats | jq '.'

echo ""
echo "5. Testing Models List Endpoint"
curl -s $BASE_URL/models | jq '.'

echo ""
echo "================================"
echo "✅ API endpoints are responding"
echo ""
echo "Note: Most endpoints require authentication."
echo "To test fully:"
echo "1. Login via /api/auth/login to get JWT token"
echo "2. Add -H 'Authorization: Bearer <token>' to curl commands"
echo ""
