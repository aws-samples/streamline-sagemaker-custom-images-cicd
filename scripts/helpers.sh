#!/bin/bash

set -ex

working_dir=$(pwd)
workflow_dir="CDM/BatchWorkflows"
sagemaker_dir="images"
credentials_path="$working_dir/session.sh"
CUSTOM_IMAGE_REPO=$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/sagemakerkernels-image-repo
CUSTOM_IMAGE_REPO_NAME=sagemakerkernels-image-repo
pipeline_dir="pipeline/image"

docker_login () {
    # log into specified ecr repo
    ecr_repo=$1

    echo -e "\nlogging into repo $  ...\n"

    aws ecr get-login-password \
        --region $AWS_REGION | docker login \
            --username AWS \
            --password-stdin $ecr_repo
}

assume_role () {
    role_arn=$1

    echo "assuming role arn $role_arn with session name research-$ENVIRONMENT-pipeline..."

    set +x # we don't wnt to display the credentials!
    credentials=$(aws sts assume-role --role-arn $role_arn --role-session-name "research-$ENVIRONMENT-pipeline" | jq -r '.Credentials')

    export AWS_ACCESS_KEY_ID=$(echo $credentials | jq -r '.AccessKeyId')
    export AWS_SECRET_ACCESS_KEY=$(echo $credentials | jq -r '.SecretAccessKey')
    export AWS_SESSION_TOKEN=$(echo $credentials | jq -r '.SessionToken')
    set -x
}

drop_assumed_role() {
    export AWS_ACCESS_KEY_ID=""
    export AWS_SECRET_ACCESS_KEY=""
    export AWS_SESSION_TOKEN=""
}

echo_banner () {
    set +x # unset debug
    echo ""
    echo "----------------------------------------"
    echo $1
    echo "----------------------------------------"
    echo ""
    set -x # reset debug
}