#!/bin/bash

echo "------------------------------------"
echo "Starting Bambu Panel A Environment"
echo "------------------------------------"

# Move to project directory

cd "$(dirname "$0")"

echo ""
echo "Starting go2rtc..."

# Start go2rtc in background

./go2rtc &

GO2RTC_PID=$!

sleep 2

echo ""
echo "Starting Panel A server..."

# Start Node server

node server.js &

NODE_PID=$!

sleep 1

echo ""
echo "------------------------------------"
echo "Panel A running at:"
echo "http://localhost:8787"
echo ""
echo "Camera via go2rtc:"
echo "http://localhost:1984"
echo "------------------------------------"
echo ""
echo "Press CTRL+C to stop everything."

# Wait until user stops script

trap "echo 'Stopping services...'; kill $GO2RTC_PID $NODE_PID; exit" INT

wait
