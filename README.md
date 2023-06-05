# Static WordPress website CDK stack

* Demo video: https://youtu.be/H5I3Eq3uNzw
* Article: https://maurocherchi.com/host-a-static-wordpress-site/

## Setup

Prerequisites:
* AWS account
* AWS CDK installed in your dev environment

First you need to buy your domain, once you have your domain you can deploy this stack.

Note: if you buy it using Route 53, you can either:
* Keep the default hosted zone and change the distribution stack to use it (HostedZone.fromHostedZoneAttributes(...))
* Delete the default hosted zone, let the stack create a new one, change the Name Servers associated with your domain name (this is what you need to do if you buy the domain not from AWS)

Once you have deployed the stack:
* Configure WordPress to use only HTTPS
  * https://docs.bitnami.com/general/apps/wordpress/administration/force-https-apache/
* Modify WordPress domain name to use HTTPS `/opt/bitnami/wordpress/wp-config.php`
  * https://docs.bitnami.com/general/apps/wordpress/administration/configure-domain/

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

## Management scripts

* `find_wp_ami.sh`          helper script for manually retrieving the AMI to use in the template
* `init.sh`                 central place to where all the variables used by the other scripts are initialized (and validated)
* `start_wp.sh`             start the WordPress EC2 instance
* `edit_wp.sh`              retrieve the public IP of the instance and open WordPress admin page in system's default browser
* `publish.sh`              copy into the S3 Bucket all the contents generated by Simply Static
* `stop_wp.sh`              stop the WordPress EC2 instance
* `get_key_and_creds.sh`    retrieve and save locally the EC2 Key and the default WordPress credentials
