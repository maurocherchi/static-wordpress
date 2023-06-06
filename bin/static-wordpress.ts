#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { WebsiteStack } from "../lib/website-stack";
import { DistributionStack } from "../lib/distribution-stack";

// TODO define all these variables
const accountId = "";
const adminUserArn = "";
const domainName = "";
const ec2InstanceName = "";
const ec2KeyName = "";
// ------------------------------

const app = new cdk.App();

const websiteStack = new WebsiteStack(app, "WebsiteStack", {
  env: { account: accountId, region: "us-east-1" },
  adminUserArn: adminUserArn,
  domainName: domainName,
  ec2InstanceName: ec2InstanceName,
  ec2KeyName: ec2KeyName,
});

new DistributionStack(app, "WebsiteDistribution", {
  env: { account: accountId, region: "us-east-1" },
  bucket: websiteStack.bucket,
  domainName: domainName,
});
