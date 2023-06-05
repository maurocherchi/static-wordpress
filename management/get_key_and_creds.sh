#!/bin/bash

if [[ -z "$WP_SERVER_NAME" || -z "$KEY_NAME" ]]; then
  echo "Error: required environment variables are not set."
  return
fi

SERVER_IP=$(aws ec2 describe-instances --instance-ids $WP_SERVER_INSTANCE_ID \
  --query 'Reservations[].Instances[].PublicIpAddress' --output text)

echo "Getting key"
aws secretsmanager get-secret-value --secret-id ec2-ssh-key/$KEY_NAME/private \
  --query SecretString --output text >$KEY_NAME.pem && chmod 400 $KEY_NAME.pem
echo "Key $KEY_NAME.pem saved in $PWD"

status=$(aws ec2 describe-instances --instance-ids $WP_SERVER_INSTANCE_ID \
  --query 'Reservations[].Instances[].State.Name' --output text)
if [ "$status" == "running" ]; then
  echo "Getting WordPress credentials"
  scp -i $KEY_NAME.pem bitnami@$SERVER_IP:/home/bitnami/bitnami_credentials .
  echo "Credentials file saved in $PWD"
else
  echo "EC2 instance is not running, can not retrieve credentials file"
fi
