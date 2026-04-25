#!/bin/bash
# Start both servers from the project root

# Backend
cd api
cp -n .env.example .env 2>/dev/null || true
pip install -r requirements.txt -q
uvicorn server:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Frontend — no-cache server so phones always get fresh JS
python serve.py &
FRONTEND_PID=$!

echo ""
echo "  HORMUZ WARGAME"
echo "  ─────────────────────────────────"
echo "  Frontend : http://localhost:3000"
echo "  Backend  : http://localhost:8000"
echo "  API docs : http://localhost:8000/docs"
echo ""
echo "  Set ANTHROPIC_API_KEY in api/.env"
echo ""
echo "  Ctrl+C to stop both servers"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
