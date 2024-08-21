#!/bin/bash

set -ex

source scripts/helpers.sh


# FUNCTIONS
# ------------------------------------------------------------------------------

build_sagemaker_images () {

    echo_banner "Building Research Platform Images" 
    tagArray=$(cat config/config.json| jq -r '.sagemakerConfig.images[].tags' | jq -c '.[]')

    cd "$working_dir/$sagemaker_dir"
   
    docker_login $CUSTOM_IMAGE_REPO	

    for tag in $tagArray; do
        image_name=$(echo "$tag" | tr -d '"')
        #echo $image_name
        if [ -d "$image_name" ]; then
            #ls -alrt ../images/$image_name
         echo "Directory for $image_name exists. Building image"
         image_tag=$(echo $image_name | tr '[A-Z]' '[a-z]')
         #sm-docker build . --file "${image_name}/Dockerfile" --bucket research-platform-dev-artifact-$PIPELINE_ACCOUNT --repository $CUSTOM_IMAGE_REPO_NAME:${image_tag} --compute-type "BUILD_GENERAL1_MEDIUM"
         sm-docker build . --file "${image_name}/Dockerfile" --repository $CUSTOM_IMAGE_REPO_NAME:${image_tag} --compute-type "BUILD_GENERAL1_MEDIUM"
        fi
    done

    cd $working_dir
}

# attach_images () {
#     echo_banner "attach_images..."

#     cd "$working_dir/$sagemaker_dir"
#     if [ "$ENVIRONMENT" != "dev" ]; then
#         # assume ECR role for cross-account deploys
#          assume_role $CUSTOM_IMAGE_REPO_ROLE
#     fi
#     for IMAGE in $(get_sagemaker_images); do
#         echo_banner "Attaching image - $IMAGE-custom"
#         #IMAGE="rapids"
#         current_domains=$(aws sagemaker list-domains --query 'Domains[*].DomainId' | jq -r '.[]')
#         echo $current_domains
#         image_version_arn=$(aws sagemaker create-image-version --image-name $IMAGE --base-image $PIPELINE_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/$RESEARCH_PLATFORM_IMAGE_REPO_NAME:$IMAGE | jq -r '.ImageVersionArn')
#         echo "New image version arn - $image_version_arn"
#         image_version=$(echo $image_version_arn | awk -F '/' '{print $NF}')
#         echo "new version image - $image_version"
#         jq --arg name $IMAGE-$image_version '.AppImageConfigName |= $name' $IMAGE/app-image-config-input.json > $IMAGE/app-image-config-input-new.json
#         cat $IMAGE/app-image-config-input-new.json | jq -r '.'
#         app_image_config_arn=$(aws sagemaker create-app-image-config --cli-input-json file://$IMAGE/app-image-config-input-new.json | jq -r '.AppImageConfigArn')
#         echo "new app image config arn - $app_image_config_arn"
#         app_image_config_name=$(echo $app_image_config_arn | awk -F '/' '{print $NF}')

#         #current_domain_id=$(aws sagemaker list-domains --query 'Domains[?DomainName==`mariano`].DomainId' | jq -r '.[0]')
#         for current_domain in $current_domains; do
            
#             echo $(aws sagemaker describe-domain --domain-id $current_domain | jq -r '.DefaultUserSettings.KernelGatewayAppSettings') > domain_data.json
#             cat domain_data.json | jq -r '.'
#             image_config_exists=$(jq -r --arg image_name $IMAGE '.CustomImages[] | select(.ImageName == $image_name)' domain_data.json)
#             if [ "$image_config_exists" != "" ]; then
#                 jq --arg image_name $IMAGE 'del(.CustomImages[] | select(.ImageName == $image_name))' domain_data.json > temp && mv temp domain_data.json   
#             fi
#                 jq --arg app_image_config_name $app_image_config_name \
#                 --arg image_name $IMAGE \
#                 --arg image_version $image_version \
#                 '.CustomImages[.CustomImages| length] |= . + {
#                 "ImageName": $image_name,
#                 "AppImageConfigName": $app_image_config_name,
#                 "ImageVersionNumber": $image_version| tonumber
#                 }' domain_data.json > temp && mv temp domain_data_new.json
            
#             echo '{"KernelGatewayAppSettings":' | cat - domain_data_new.json > temp && mv temp domain_data_new.json
#             echo '}' >> domain_data_new.json
#             cat domain_data_new.json | jq -r '.'
#             #aws sagemaker update-domain --domain-id $current_domain --default-user-settings file://domain_data_new.json
#         done
#     done
# }

# push_image () {
#     ecr_repo=$1
#     image_name=$2
#     tag=$3

#     echo -e "\npushing image ${image_name}:${tag} to repo $ecr_repo as ${ecr_repo}:${image_name}\n"

#     # login, tag and push
#     docker tag ${image_name}:${tag} ${ecr_repo}:${image_name}
#     docker push ${ecr_repo}:${image_name}
# }

# get_configs () {
#     ls "$working_dir/$workflow_dir/WorkflowConfig"
# }

# This method is used to build custom images for CodePipelines. This custom image will be used
# in CDK synth and Deploy stages in research platform pipelines
# build_pipeline_custom_image () {
#     echo_banner "Building Pipeline Base Image"
    
#     if [ "$ENVIRONMENT" == "dev" ]; then
#         #check if we need to rebuild image, SSM parameter by default is false, If you make any changes to Dockerfile under /pipeline/image
#         #you need to set this parameter /research-platform/cdk/pipeline/build-base-image to true and rerun Dev Env pipeline
#         BUILD_PIPELINE_BASE_IMAGE=$(aws ssm get-parameter --name "/research-platform/cdk/pipeline/build-base-image" --query 'Parameter.Value' --output text)
#         if $BUILD_PIPELINE_BASE_IMAGE 
#         then
#             cd "$working_dir/$pipeline_dir"
#             echo_banner "Building Pipeline Base image"
#             PIPELINE_BASE_IMAGE_REPO=$PIPELINE_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/research-platform-pipelines	
#             docker_login $PIPELINE_BASE_IMAGE_REPO
#             docker build -t research-platform-pipelines:latest .
#             docker tag research-platform-pipelines:latest $PIPELINE_BASE_IMAGE_REPO:latest
#             docker push $PIPELINE_BASE_IMAGE_REPO:latest
#             cd $working_dir
#         else
#             echo_banner "skipping building pipeline base image as ssm parameter /research-platform/cdk/pipeline/build-base-image turned off"
#         fi
#     fi
# }

# MAIN
# ------------------------------------------------------------------------------
# Build Pipeline Base Image to be used for CDK deployments of the stack
#build_pipeline_custom_image

# Build Images for custom docker images for Jupyter Lab
    build_sagemaker_images
    echo_banner "Scanning ECR Images"
    # Scan images for vulnerabilities using ECR Scan and fail pipeline if any CRITICAL or HIGH severity vulnerability found
    #scan_sagemaker_images
    #echo_banner "Scanning ECR Images - DONE"
