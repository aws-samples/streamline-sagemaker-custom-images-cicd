#!/bin/bash

set -ex

working_dir=$(pwd)
workflow_dir="CDM/BatchWorkflows"
sagemaker_dir="images"
credentials_path="$working_dir/session.sh"
#CUSTOM_IMAGE_REPO_ROLE=arn:aws:iam::$AWS_ACCOUNT:role/sagemakerkernels-image-repo-role
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

# get_workflows () {
#     ls "$working_dir/$workflow_dir/Images"
# }

# get_updated_workflows () {
#     #     git diff --name-only HEAD~1..HEAD | \      # Compare head with previous commit
#     #         cut -b 1- | grep "BatchWorkflows" | \  # Only track Batchworkflows
#     #         cut -d/ -f4 | \                        # get the algorithm name only
#     #         cut -f 1 -d '.' | \                    # remove the extension
#     #         sed "s/GPU//g"  | \                    # remove the "GPU" indicator
#     #         uniq                                   # return unique list
#     local_dir=$(pwd)
#     cd $working_dir
#     git diff --name-only HEAD~1..HEAD | \
#         cut -b 1- | grep "BatchWorkflows" | \
#         cut -d/ -f4 | \
#         cut -f 1 -d '.' | \
#         sed "s/GPU//g"  | \
#         uniq
#     cd $local_dir
# }

# get_sagemaker_images () {
#     ls "$working_dir/$sagemaker_dir/"
# }

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

# get_repo_name () {
#     repo_uri=$1

#     repo_arr=$(echo $repo_uri | tr '/' ' ')
#     repo_arr=($repo_arr)
#     repo_name="${repo_arr[1]}"

#     echo $repo_name
# }