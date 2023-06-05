#!/bin/bash

REGION=us-east-1
AMI_NAME_FILTER=*wordpress-6.2.2-5-r05*

aws ec2 describe-images --region $REGION \
    --filter "Name=name, Values=$AMI_NAME_FILTER" \
    --query "Images[*].[Name, ImageId]"