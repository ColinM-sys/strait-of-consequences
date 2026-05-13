#!/bin/bash
# Keep llama3.1:8b + hormuz-vision warm on the 4090 desktop during demos.
# Run this in the background — pings every 4 minutes.
while true; do
  curl -s -m 90 -X POST http://100.75.51.87:11434/api/generate \
    -H 'Content-Type: application/json' \
    -d '{"model":"llama3.1:8b","prompt":"ok","stream":false,"keep_alive":-1}' \
    -o /dev/null -w "[$(date +%H:%M:%S)] llama3.1:8b warm-ping %{time_total}s\n"
  curl -s -m 120 -X POST http://100.75.51.87:11434/api/generate \
    -H 'Content-Type: application/json' \
    -d '{"model":"hormuz-vision:latest","prompt":"ok","stream":false,"keep_alive":-1}' \
    -o /dev/null -w "[$(date +%H:%M:%S)] hormuz-vision warm-ping %{time_total}s\n" 2>/dev/null
  sleep 240
done
