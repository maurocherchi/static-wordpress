#!/bin/bash

# the certificate must be issued in the us-east-1 region
export AWS_DEFAULT_REGION=us-east-1
# get it from the generate_keys script (default name is "private_key")
export KEY_NAME=private_key
# you defined these next two in bin/static-wordpress.ts (butcket name should be the same as the domain name)
export WP_SERVER_NAME=
export BUCKET_NAME=

WP_SERVER_INSTANCE_ID=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$WP_SERVER_NAME" \
    --query "Reservations[].Instances[].InstanceId" --output text)

if [[ -z "$WP_SERVER_INSTANCE_ID" ]]; then
    echo "Error: WordPress server with name \"$WP_SERVER_NAME\" not found."
    return
fi

aws s3api head-bucket --bucket $BUCKET_NAME > /dev/null
status=$?
if [ $status -ne 0 ]; then
    echo "Error: Bucket with name $BUCKET_NAME not found."
    return
fi

if [ ! -e "$KEY_NAME.pem" ]; then
    echo "Error: Key with name $KEY_NAME not found."
    return
fi

echo "Success: All variables are now set for this terminal instance."