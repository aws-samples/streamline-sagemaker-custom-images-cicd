#!/bin/bash

set -ex

working_dir=$(pwd)
sagemaker_dir="images"
CUSTOM_IMAGE_REPO=$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/sagemakerkernels-image-repo
CUSTOM_IMAGE_REPO_NAME=sagemakerkernels-image-repo


# FUNCTIONS
# ------------------------------------------------------------------------------

build_sagemaker_images () {

    echo_banner "Building Research Platform Images" 
    tagArray=$(cat config/config.json| jq -r '.sagemakerConfig.images[].tags' | jq -c '.[]')

    cd "$working_dir/$sagemaker_dir"
    docker_login $CUSTOM_IMAGE_REPO	

    for tag in $tagArray; do
        image_name=$(echo "$tag" | tr -d '"')
        if [ -d "$image_name" ]; then
         echo "Directory for $image_name exists. Building image"
         image_tag=$(echo $image_name | tr '[A-Z]' '[a-z]')
         sm-docker build . --file "${image_name}/Dockerfile" --repository $CUSTOM_IMAGE_REPO_NAME:${image_tag} --compute-type "BUILD_GENERAL1_MEDIUM"
        fi
    done

    cd $working_dir
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

wait_scan_status () {
    repo_name=$1
    tag=$2

    stat="IN_PROGRESS"
    i=0
    while [ "$stat" != "COMPLETE" ]; do
        i=$(( $i+1 ))
        sleep 30;
        stat=$(aws ecr describe-image-scan-findings --repository-name $repo_name --image-id imageTag=$tag | jq -r '.imageScanStatus.status');

        echo "Waiting for ${repo_name}:${tag} scan to complete..."

        if [ "$i" == "20" ]; then
            # timeout = 60 seconds
            echo "Wait timed out"
            exit 1
        fi
    done

    aws ecr describe-image-scan-findings --repository-name $repo_name --image-id imageTag=$tag > ecr_scan_result.json
}

get_scan_result () {
    repo_name=$1
    tag=$2

    result=$(aws ecr describe-image-scan-findings --repository-name $repo_name --image-id imageTag=$tag | jq -r '.imageScanFindings.findingSeverityCounts')
    critical=$(echo $result | jq -r '.CRITICAL')
    high=$(echo $result | jq -r '.HIGH')
    image_failed=false
    if [ $critical != null ]; then
        ECR_SCAN_FAILED=true
        image_failed=true
    else 
        critical=0
    fi

    if [ $high != null ]; then
        ECR_SCAN_FAILED=true
        image_failed=true
    else 
        high=0
    fi

    if [ "$image_failed" = true ] ; then
        FAILED_IMAGES="$FAILED_IMAGES\n\t- ${repo_name}:${tag}"
    fi
    set +x
    echo -e "\nFound $critical critical and $high high vulnerabilities in image $tag on $repo_name repository\n"
    echo -e "\nTotal Counts:"
    echo $result
    echo ""
    aws ecr describe-image-scan-findings --repository-name $repo_name --image-id imageTag=$tag | jq -r '.imageScanFindings.findings'
    echo ""
    set -x
}

scan_sagemaker_images () {
    cd "$working_dir/$sagemaker_dir"
    tagArray=$(cat config/config.json | jq -r '.sagemakerConfig.images[].tags' | jq -c '.[]')
    docker_login $CUSTOM_IMAGE_REPO
    repo_name=$(get_repo_name $CUSTOM_IMAGE_REPO)
    for tag in $tagArray; do
        image_name=$(echo "$tag" | tr -d '"')
        if [ -d "$image_name" ]; then
         echo "Directory for $image_name exists. Scanning image"
         image_tag=$(echo $image_name | tr '[A-Z]' '[a-z]')
         wait_scan_status $repo_name $image_name
         get_scan_result $repo_name $image_name
        fi
    done
    cd $working_dir
    if [ "$ECR_SCAN_FAILED" = true ] ; then
        set +x
        echo -e "\nThe images below have high or critical vulnerabilities:\n$FAILED_IMAGES\n"
        echo "See results above for details or review results in the ECR console for better UI view."
        echo "Scan failed"
        exit 1
    fi
}

# Build Images for custom docker images for Jupyter Lab
build_sagemaker_images
echo_banner "Scanning ECR Images"
# Scan images for vulnerabilities using ECR Scan and fail pipeline if any CRITICAL or HIGH severity vulnerability found
scan_sagemaker_images
echo_banner "Scanning ECR Images - DONE"
