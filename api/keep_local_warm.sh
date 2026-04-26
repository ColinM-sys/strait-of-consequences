#!/bin/bash
# Keeps llama3.1:8b warm on this laptop's local Ollama (port 11434).
# Mirrors keep_4090_warm.sh but for the lenovo's RTX 4080 Laptop GPU.
while true; do
  curl -s -m 60 -X POST http://localhost:11434/api/generate \
    -H 'Content-Type: application/json' \
    -d '{"model":"llama3.1:8b","prompt":"ok","stream":false,"keep_alive":-1}' \
    -o /dev/null -w "[$(date +%H:%M:%S)] LOCAL llama3.1:8b warm-ping %{time_total}s\n"
  sleep 240
done
