import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";

interface DistributionProps extends cdk.StackProps {
  bucket: IBucket;
  domainName: string;
}

export class DistributionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DistributionProps) {
    super(scope, id, props);

    const hostedZone = new route53.HostedZone(this, "HostedZone", {
      zoneName: props.domainName,
    });

    // TODO update with your domain details
    const certificate = new acm.Certificate(this, "DomainCert", {
      domainName: props.domainName,
      certificateName: props.domainName,
      subjectAlternativeNames: [`www.${props.domainName}`],
      validation: acm.CertificateValidation.fromDnsMultiZone({
        "www.YOUR_DOMAIN_HERE": hostedZone,
        "YOUR_DOMAIN_HERE": hostedZone,
      }),
    });

    // Cloudfront distribution
    // START TEMPORARY SOLUTION ---------------------------------------------------------------------
    // workaround https://github.com/aws/aws-cdk/issues/21771#issuecomment-1281190832
    // waiting for L2 Construct https://github.com/aws/aws-cdk-rfcs/issues/491
    const originAccessControl = new cf.CfnOriginAccessControl(
      this,
      "OriginAccessControl",
      {
        originAccessControlConfig: {
          name: "originAccessControl",
          originAccessControlOriginType: "s3",
          signingBehavior: "always",
          signingProtocol: "sigv4",
        },
      }
    );

    const cfFunction = new cf.Function(this, "Function", {
      code: cf.FunctionCode.fromFile({
        filePath: "src/rewrite_url.js",
      }),
    });

    const distribution = new cf.CloudFrontWebDistribution(
      this,
      "Distribution",
      {
        viewerCertificate: cf.ViewerCertificate.fromAcmCertificate(
          certificate,
          {
            aliases: [props.domainName],
            securityPolicy: cf.SecurityPolicyProtocol.TLS_V1_2_2021,
          }
        ),
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: props!!.bucket,
            },
            behaviors: [
              {
                isDefaultBehavior: true,
                allowedMethods: cf.CloudFrontAllowedMethods.GET_HEAD,
                compress: true,
                cachedMethods: cf.CloudFrontAllowedCachedMethods.GET_HEAD,
                viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                minTtl: cdk.Duration.seconds(0),
                maxTtl: cdk.Duration.seconds(86400),
                defaultTtl: cdk.Duration.seconds(60), // TODO increase once everything is working as expected
                functionAssociations: [
                  {
                    function: cfFunction,
                    eventType: cf.FunctionEventType.VIEWER_REQUEST,
                  },
                ],
              },
            ],
          },
        ],
      }
    );

    const cfnDistribution = distribution.node
      .defaultChild as cf.CfnDistribution;

    cfnDistribution.addPropertyOverride(
      "DistributionConfig.Origins.0.OriginAccessControlId",
      originAccessControl.getAtt("Id")
    );
    // END TEMPORARY SOLUTION ---------------------------------------------------------------------

    new route53.ARecord(this, "Alias", {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(
        new CloudFrontTarget(distribution)
      ),
    });
  }
}
