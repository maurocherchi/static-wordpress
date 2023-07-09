openssl genpkey -algorithm RSA -out private_key.pem
openssl rsa -pubout -in private_key.pem -out public_key.pem
ssh-keygen -f public_key.pem -i -m PKCS8 > public_key.pub
