FROM public.ecr.aws/amazonlinux/amazonlinux:2

ARG NB_USER="sagemaker-user"
ARG NB_UID="1000"
ARG NB_GID="100"
RUN yum update -y && \
yum install python3 python3-pip shadow-utils -y && \
yum clean all

RUN python3 --version
RUN pip3 --version
# Create the sagemaker-user
RUN useradd --create-home \
            --shell /bin/bash \
            --gid 100 \
            --uid 1000 \
            sagemaker-user
RUN pip3 install jupyterlab urllib3==1.26.6
# Set the working directory to the sagemaker-user's home
WORKDIR /home/sagemaker-user
USER 1000
CMD jupyter lab —ip 0.0.0.0 —port 8888 \
--ServerApp.base_url="/jupyterlab/default" \
--ServerApp.token='' \
--ServerApp.allow_origin='*'