import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { aws_dlm as dlm } from "aws-cdk-lib";

interface WebsiteProps extends cdk.StackProps {
  domainName: string;
  zoneId: string;
  adminUserArn: string;
  ec2InstanceName: string;
  ec2KeyPublicMaterial: string;
}

export class WebsiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WebsiteProps) {
    super(scope, id, props);

    // The hosted zone created automatically when you bought the domain
    let hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      "HostedZone",
      {
        hostedZoneId: props.zoneId,
        zoneName: props.domainName,
      }
    );

    // TODO update with your domain details
    const certificate = new acm.Certificate(this, "DomainCert", {
      domainName: props.domainName,
      certificateName: props.domainName,
      subjectAlternativeNames: [`www.${props.domainName}`],
      validation: acm.CertificateValidation.fromDnsMultiZone({
        "www.[YOUR_DOMAIN_HERE same as props.domainName]": hostedZone,
        "[YOUR_DOMAIN_HERE same as props.domainName]": hostedZone,
      }),
    });

    const cfFunction = new cf.Function(this, "Function", {
      code: cf.FunctionCode.fromFile({
        filePath: "src/rewrite_url.js",
      }),
    });

    // S3 bucket
    const bucket = new s3.Bucket(this, "Bucket", {
      bucketName: props.domainName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    bucket.addToResourcePolicy(
      iam.PolicyStatement.fromJson({
        Sid: "AllowCloudFrontServicePrincipalReadOnly",
        Effect: "Allow",
        Principal: {
          Service: "cloudfront.amazonaws.com",
        },
        Action: ["s3:GetObject"],
        Resource: `${bucket.bucketArn}/*`,
        Condition: {
          StringLike: {
            "AWS:SourceArn": `arn:aws:cloudfront::${this.account}:distribution/*`,
          },
        },
      })
    );

    const distribution = new cf.Distribution(this, "Distribution", {
      certificate: certificate,
      domainNames: [`www.${props.domainName}`, props.domainName],
      defaultBehavior: {
        origin: new S3Origin(bucket),
        functionAssociations: [
          {
            function: cfFunction,
            eventType: cf.FunctionEventType.VIEWER_REQUEST,
          },
        ],
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });

    new route53.ARecord(this, "Alias", {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(
        new CloudFrontTarget(distribution)
      ),
    });

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

    const wpBitnamiImage = ec2.MachineImage.genericLinux({
      "us-east-1": "ami-09fedd064403fb45b",
    });

    const cfnKeyPair = new ec2.CfnKeyPair(this, "MyCfnKeyPair", {
      keyName: "newWpServerKeyPair",
      publicKeyMaterial: props.ec2KeyPublicMaterial,
    });

    const wpServer = new ec2.Instance(this, "WpServer", {
      instanceName: props.ec2InstanceName,
      vpc: defaultVpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      machineImage: wpBitnamiImage,
      allowAllOutbound: true,
      securityGroup: wpAdminSecurityGroup,
      keyName: cfnKeyPair.keyName,
      propagateTagsToVolumeOnCreation: true,
    });
    wpServer.addUserData(
      "aws configure set default.region " + this.region,
      "sudo wp plugin install simply-static --activate"
    );

    // Allow wp server role to put objects in the bucket
    wpServer.role.addToPrincipalPolicy(
      iam.PolicyStatement.fromJson({
        Sid: "AllowWpServerRoleToPutObjectsInTheBucket",
        Action: ["s3:PutObject", "s3:PutObjectAcl"],
        Effect: "Allow",
        Resource: bucket.bucketArn,
      })
    );
    // Allow the bucket to be used by wp server role
    bucket.addToResourcePolicy(
      iam.PolicyStatement.fromJson({
        Sid: "AllowTheBucketToBeUsedByWpServerRole",
        Effect: "Allow",
        Principal: {
          AWS: wpServer.role.roleArn,
        },
        Action: ["s3:PutObject", "s3:PutObjectAcl"],
        Resource: `${bucket.bucketArn}/*`,
      })
    );

    new dlm.CfnLifecyclePolicy(this, "LifecyclePolicy", {
      description: "Wordpress instance volumes backup",
      state: "ENABLED",
      executionRoleArn: `arn:aws:iam::${this.account}:role/service-role/AWSDataLifecycleManagerDefaultRole`,
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
    });
  }
}
