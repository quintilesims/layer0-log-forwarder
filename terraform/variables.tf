variable "access_key" {
  description = "aws access key for the layer0 instance account"
}

variable "secret_key" {
  description = "aws secret key for the layer0 instance account"
}

variable "region" {
  default     = "us-west-2"
  description = "aws region of the layer0 instance"
}

variable "kinesis_stream_name" {
  description = "the stream you want to forward the cloudwatch logs to"
}

variable "stream_aws_access_key" {
  description = "aws access key of the account which contains the stream"
}

variable "stream_aws_secret_key" {
  description = "aws secret key of the account which contains the stream"
}

variable "stream_aws_region" {
  default     = "us-west-2"
  description = "aws region of the account which contains the stream"
}

variable "layer0_prefix" {
  description = "prefix of a layer0 instance"
}

variable "filter" {
  default     = ""
  description = "cloudwatch logs metric filter to restrict the logs forwarded to the stream"
}
