#!/bin/bash
# Replace API_BASE placeholder with the environment variable
API_URL="${API_BASE:-}"
sed -i "s|%%API_BASE%%|${API_URL}|g" config.js
echo "API_BASE set to: ${API_URL}"
