#!/bin/bash

if [[ -z "$WP_SERVER_NAME" ]]; then
  echo "Error: required environment variables are not set."
  return
fi

WP_SERVER_INSTANCE_ID=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$WP_SERVER_NAME" \
    --query "Reservations[].Instances[].InstanceId" --output text)

SERVER_IP=$(aws ec2 describe-instances --instance-ids $WP_SERVER_INSTANCE_ID \
    --query 'Reservations[].Instances[].PublicIpAddress' --output text)
xdg-open https://$SERVER_IP/wp-admin >/dev/null 2>&1 & disown