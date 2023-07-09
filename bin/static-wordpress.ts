#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { WebsiteStack } from "../lib/website-stack";

// TODO define all these constants
const accountId = "432621157915";
const adminUserArn = "arn:aws:iam::432621157915:user/admin";
const domainName = "example.com";
const hostedZoneId = "zoneid"
const ec2InstanceName = "wordpress-example";
// ------------------------------

const app = new cdk.App();

new WebsiteStack(app, "WebsiteStack", {
  env: { account: accountId, region: "us-east-1" },
  adminUserArn: adminUserArn,
  domainName: domainName,
  zoneId: hostedZoneId,
  ec2InstanceName: ec2InstanceName,
});
