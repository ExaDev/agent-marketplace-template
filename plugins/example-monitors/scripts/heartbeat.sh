#!/bin/sh
# Each line written to stdout reaches Claude as one notification.
n=0
while [ "$n" -lt 3 ]; do
  n=$((n + 1))
  echo "example-heartbeat: tick $n"
  sleep 30
done
