import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as kms from "aws-cdk-lib/aws-kms";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { KeyPair } from "cdk-ec2-key-pair";
import { RemovalPolicy } from "aws-cdk-lib";
import { aws_dlm as dlm } from "aws-cdk-lib";

interface WebsiteProps extends cdk.StackProps {
  adminUserArn: string;
  domainName: string;
  ec2InstanceName: string;
  ec2KeyName: string;
}

export class WebsiteStack extends cdk.Stack {
  public readonly bucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: WebsiteProps) {
    super(scope, id, props);

    // New KMS encryption key for the bucket
    const bucketEncryptionKey = new kms.Key(this, "BucketEncryptionKey", {
      alias: "BucketEncryptionKey",
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
      policy: iam.PolicyDocument.fromJson({
        Id: "website-key-policy",
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "Enable IAM User Permissions",
            Effect: "Allow",
            Principal: {
              AWS: "arn:aws:iam::" + this.account + ":root",
            },
            Action: "kms:*",
            Resource: "*",
          },
          {
            Sid: "Allow access for Key Administrators",
            Effect: "Allow",
            Principal: {
              AWS: props.adminUserArn,
            },
            Action: [
              "kms:Create*",
              "kms:Describe*",
              "kms:Enable*",
              "kms:List*",
              "kms:Put*",
              "kms:Update*",
              "kms:Revoke*",
              "kms:Disable*",
              "kms:Get*",
              "kms:Delete*",
              "kms:TagResource",
              "kms:UntagResource",
              "kms:ScheduleKeyDeletion",
              "kms:CancelKeyDeletion",
            ],
            Resource: "*",
          },
          {
            Sid: "Allow use of the key",
            Effect: "Allow",
            Principal: {
              AWS: props.adminUserArn,
            },
            Action: [
              "kms:Encrypt",
              "kms:Decrypt",
              "kms:ReEncrypt*",
              "kms:GenerateDataKey*",
              "kms:DescribeKey",
            ],
            Resource: "*",
          },
          {
            Sid: "Allow attachment of persistent resources",
            Effect: "Allow",
            Principal: {
              AWS: props.adminUserArn,
            },
            Action: ["kms:CreateGrant", "kms:ListGrants", "kms:RevokeGrant"],
            Resource: "*",
            Condition: {
              Bool: {
                "kms:GrantIsForAWSResource": "true",
              },
            },
          },
          {
            Sid: "AllowCloudFrontServicePrincipalSSE-KMS",
            Effect: "Allow",
            Principal: {
              AWS: "arn:aws:iam::" + this.account + ":root",
              Service: "cloudfront.amazonaws.com",
            },
            Action: ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey*"],
            Resource: "*",
            Condition: {
              StringLike: {
                "AWS:SourceArn":
                  "arn:aws:cloudfront::" + this.account + ":distribution/*",
              },
            },
          },
        ],
      }),
    });

    // S3 bucket
    this.bucket = new s3.Bucket(this, "Bucket", {
      bucketName: props.domainName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryptionKey: bucketEncryptionKey,
      enforceSSL: true,
      versioned: false,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    this.bucket.addToResourcePolicy(
      iam.PolicyStatement.fromJson({
        Sid: "AllowCloudFrontServicePrincipalReadOnly",
        Effect: "Allow",
        Principal: {
          Service: "cloudfront.amazonaws.com",
        },
        Action: ["s3:GetObject"],
        Resource: this.bucket.bucketArn + "/*",
        Condition: {
          StringLike: {
            "AWS:SourceArn":
              "arn:aws:cloudfront::" + this.account + ":distribution/*",
          },
        },
      })
    );

    // EC2 running wordpress
    const defaultVpc = ec2.Vpc.fromLookup(this, "DefaultVpc", {
      isDefault: true,
    });

    const wpAdminSecurityGroup = new ec2.SecurityGroup(
      this,
      "WpAdminSecurityGroup",
      {
        securityGroupName: "WpAdminSecurityGroup",
        vpc: defaultVpc,
        allowAllOutbound: true,
      }
    );
    wpAdminSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "Allow SSH from everywhere"
    );
    wpAdminSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS from everywhere"
    );

    const wpServerKeyPair = new KeyPair(this, "WpServerKeyPair", {
      name: props.ec2KeyName,
      storePublicKey: true,
      description: "Wordpress server access key",
    });

    const wpBitnamiImage = ec2.MachineImage.genericLinux({
      "us-east-1": "ami-09fedd064403fb45b",
    });

    const wpServer = new ec2.Instance(this, "WpServer", {
      instanceName: props.ec2InstanceName,
      vpc: defaultVpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.SMALL
      ),
      machineImage: wpBitnamiImage,
      allowAllOutbound: true,
      securityGroup: wpAdminSecurityGroup,
      keyName: wpServerKeyPair.keyPairName,
    });
    wpServer.addUserData(
      "aws configure set default.region " + this.region,
      "sudo wp plugin install simply-static --activate"
    );

    new ec2.CfnEIP(this, "ElasticIp", {
      instanceId: wpServer.instanceId,
    });

    // Allow wp server role to put objects in the bucket
    wpServer.role.addToPrincipalPolicy(
      iam.PolicyStatement.fromJson({
        Sid: "AllowWpServerRoleToPutObjectsInTheBucket",
        Action: ["s3:PutObject", "s3:PutObjectAcl"],
        Effect: "Allow",
        Resource: this.bucket.bucketArn,
      })
    );
    // Allow the bucket to be used by wp server role
    this.bucket.addToResourcePolicy(
      iam.PolicyStatement.fromJson({
        Sid: "AllowTheBucketToBeUsedByWpServerRole",
        Effect: "Allow",
        Principal: {
          AWS: wpServer.role.roleArn,
        },
        Action: ["s3:PutObject", "s3:PutObjectAcl"],
        Resource: this.bucket.bucketArn + "/*",
      })
    );
    // Allow wp server role to use the encryption key
    wpServer.role.addToPrincipalPolicy(
      iam.PolicyStatement.fromJson({
        Sid: "AllowWpServerRoleToUseTheEncryptionKey",
        Action: ["kms:GenerateDataKey"],
        Effect: "Allow",
        Resource: bucketEncryptionKey.keyArn,
      })
    );
    // Allow the bucket encryption key to be used by wp server role
    bucketEncryptionKey.addToResourcePolicy(
      iam.PolicyStatement.fromJson({
        Sid: "AllowTheEncryptionKeyToBeUsedByWpServerRole",
        Effect: "Allow",
        Principal: {
          AWS: wpServer.role.roleArn,
        },
        Action: [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey",
        ],
        Resource: "*",
      })
    );

    new dlm.CfnLifecyclePolicy(
      this,
      "LifecyclePolicy",
      {
        description: "Wordpress instance volumes backup",
        state: "ENABLED",
        executionRoleArn:
          "arn:aws:iam::" +
          this.account +
          ":role/service-role/AWSDataLifecycleManagerDefaultRole",
        policyDetails: {
          resourceTypes: ["INSTANCE"],
          targetTags: [{ key: "Name", value: props.ec2InstanceName }],
          schedules: [
            {
              name: "Wordpress instance daily backup",
              createRule: {
                interval: 24,
                intervalUnit: "HOURS",
                times: ["02:00"],
              },
              retainRule: {
                count: 1,
              },
              copyTags: true,
            },
          ],
        },
      }
    );
  }
}
