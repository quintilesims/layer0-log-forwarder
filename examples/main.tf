module "layer0_log_forwarder" {
  source                = "github.com/quintiles/layer0-log-forwarder/terraform"
  access_key            = "${var.access_key}"
  secret_key            = "${var.secret_key}"
  region                = "${var.region}"
  kinesis_stream_name   = "${var.kinesis_stream_name}"
  stream_aws_access_key = "${var.stream_aws_access_key}"
  stream_aws_secret_key = "${var.stream_aws_secret_key}"
  stream_aws_region     = "${var.stream_aws_region}"
  layer0_prefix         = "${data.layer0_api.config.prefix}"
}

provider "layer0" {
  endpoint = "${var.endpoint}"
  token    = "${var.token}"
  skip_ssl_verify = true
}

data "layer0_api" "config" {}
