FROM public.ecr.aws/amazonlinux/amazonlinux:2

ARG NB_USER="sagemaker-user"
ARG NB_UID="1000"
ARG NB_GID="100"
RUN yum update -y && \
yum install python3 python3-pip shadow-utils -y && \
yum clean all

RUN yum install --assumeyes python3 shadow-utils && \
    useradd --create-home --shell /bin/bash --gid "${NB_GID}" --uid ${NB_UID} ${NB_USER} && \
    yum clean all && \
    python3 -m pip install jupyterlab

RUN python3 -m pip install --upgrade pip
RUN python3 -m pip install --upgrade urllib3==1.26.6


# Create the sagemaker-user
#RUN useradd --create-home \
 #           --shell /bin/bash \
 #           --gid 100 \
 #           --uid 1000 \
  #          ${NB_USER}
#RUN pip3 install jupyterlab urllib3==1.26.6
# Set the working directory to the sagemaker-user's home
USER ${NB_UID}
CMD jupyter lab --ip 0.0.0.0 --port 8888 \
  --ServerApp.base_url="/jupyterlab/default" \
  --ServerApp.token='' \
  --ServerApp.allow_origin='*'