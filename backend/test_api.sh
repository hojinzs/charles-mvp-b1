#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "1. Adding Keyword..."
curl -s -X POST "$BASE_URL/keywords" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"네이버 광고","url":"example.com"}' | jq .

echo "\n2. Enqueueing Job..."
curl -s -X POST "$BASE_URL/jobs/enqueue" \
  -H "Content-Type: application/json" \
  -d '{"keywordId":1, "keyword":"네이버 광고", "targetUrl":"example.com"}' | jq .

echo "\n3. Checking Queue Status..."
curl -s "$BASE_URL/jobs/queue" | jq .

echo "\n4. Waiting for job to process (10s)..."
sleep 10

echo "\n5. Checking Rankings..."
curl -s "$BASE_URL/rankings" | jq .

echo "\nDone."
