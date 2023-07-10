#!/bin/bash

if [[ -z "$WP_SERVER_NAME" || -z "$KEY_NAME" ]]; then
  echo "Error: required environment variables are not set."
  return
fi

SERVER_IP=$(aws ec2 describe-instances --instance-ids $WP_SERVER_INSTANCE_ID \
  --query 'Reservations[].Instances[].PublicIpAddress' --output text)

status=$(aws ec2 describe-instances --instance-ids $WP_SERVER_INSTANCE_ID \
  --query 'Reservations[].Instances[].State.Name' --output text)
if [ "$status" == "running" ]; then
  echo "Getting WordPress credentials"
  scp -i $KEY_NAME.pem bitnami@$SERVER_IP:/home/bitnami/bitnami_credentials .
  echo "Credentials file saved in $PWD"
else
  echo "EC2 instance is not running, can not retrieve credentials file"
fi
