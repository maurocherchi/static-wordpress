# Static WordPress website CDK stack

* How to use this template: https://www.youtube.com/watch?v=zI7a1mXvFJ8
* Article: https://maurocherchi.com/host-a-static-wordpress-site/

## Setup

Prerequisites:
* AWS account
* AWS CLI
* AWS CDK

First, you need to buy your domain, once you have your domain you can deploy this stack.

Note: If you buy it using Route 53, you can either:
* Keep the default hosted zone and change the distribution stack to use it (HostedZone.fromHostedZoneAttributes(...))
* Delete the default hosted zone, let the stack create a new one, change the Name Servers associated with your domain name

If you buy the domain outside of AWS, once the stack is deployed you have to change the Name Servers associated with
your domain, with the ones that AWS will assign to the hosted zone created by the stack.

Once you have deployed the stack:
* Configure WordPress to use only HTTPS
  * https://docs.bitnami.com/general/apps/wordpress/administration/force-https-apache/
* Modify WordPress domain name to use HTTPS `/opt/bitnami/wordpress/wp-config.php`
  * https://docs.bitnami.com/general/apps/wordpress/administration/configure-domain/
* Configure Simply Static plugin to clean the folder before static content generation

## Useful commands

* `cdk synth`       emits the synthesized CloudFormation template
* `cdk diff`        compare deployed stack with current state
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk destroy`     delete the stack and all the connected resources (according to their retention policy -> the bucket will be retained)

## Management scripts

* `edit_wp.sh`              retrieves the public IP of the instance and opens WordPress admin page in the system's default browser
* `find_wp_ami.sh`          helper script for manually retrieving the AMI to use in the template
* `generate_keys.sh`        generates a key pair to use to ssh into the EC2 instance
* `get_bitnami_creds.sh`    retrieves the credentials to log into WordPress
* `init.sh`                 central place where all the variables used by the other scripts are initialized (and validated)
* `publish.sh`              copies all the static contents from the EC2 instance to the S3 Bucket
* `start_wp.sh`             starts the WordPress EC2 instance
* `stop_wp.sh`              stops the WordPress EC2 instance
