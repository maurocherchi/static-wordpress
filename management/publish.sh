#!/bin/bash

if [[ -z "$WP_SERVER_NAME" || -z "$KEY_NAME" || -z "$BUCKET_NAME" ]]; then
  echo "Error: required environment variables are not set."
  return
fi

SERVER_IP=$(aws ec2 describe-instances --instance-ids $WP_SERVER_INSTANCE_ID \
    --query 'Reservations[].Instances[].PublicIpAddress' --output text)

echo "Going to publish contents from $WP_SERVER_NAME to bucket $BUCKET_NAME"
echo "Logging into $SERVER_IP"
ssh -tt -i $KEY_NAME.pem bitnami@$SERVER_IP << EOF
  cd /bitnami/wordpress/wp-content/plugins/simply-static/static-files/*/
  aws s3 cp . s3://$BUCKET_NAME/ --recursive
  exit
EOF
echo "Contents published"