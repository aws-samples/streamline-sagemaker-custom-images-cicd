FROM public.ecr.aws/amazonlinux/amazonlinux:2

ARG NB_USER="sagemaker-user"
ARG NB_UID="1000"
ARG NB_GID="100"
RUN yum update -y
# install python 3
RUN yum install python3 python3-pip shadow-utils -y
RUN python3 --version
RUN pip3 --version
RUN sudo useradd —-create-home —s /bin/bash —g "${NB_GID}" —u ${NB_UID} ${NB_USER}
# yum clean all 
#RUN python3 -m pip install —upgrade pip
RUN python3 -m pip install —upgrade urllib3==1.26.6
RUN python3 -m pip install jupyterlab

USER ${NB_UID}
CMD jupyter lab —ip 0.0.0.0 —port 8888 \
--ServerApp.base_url="/jupyterlab/default" \
--ServerApp.token='' \
--ServerApp.allow_origin='*'