#!/bin/bash

if [[ -z "$WP_SERVER_NAME" ]]; then
  echo "Error: required environment variables are not set."
  return
fi

WP_SERVER_INSTANCE_ID=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$WP_SERVER_NAME" \
    --query "Reservations[].Instances[].InstanceId" --output text)

echo "Starting WordPress server $WP_SERVER_INSTANCE_ID with name $WP_SERVER_NAME"
aws ec2 start-instances --instance-ids $WP_SERVER_INSTANCE_ID 
aws ec2 wait instance-running --instance-ids $WP_SERVER_INSTANCE_ID 
echo "$WP_SERVER_NAME started"