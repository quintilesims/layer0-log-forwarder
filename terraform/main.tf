provider "aws" {
  access_key = "${var.access_key}"
  secret_key = "${var.secret_key}"
  region     = "${var.region}"
}

resource "aws_iam_role" "lambda_role" {
  name = "layer0_log_forwader_role_${var.layer0_prefix}"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

data "aws_iam_policy_document" "lambda_policy" {
  statement {
    actions = [
      "ecs:DescribeTaskDefinition",
      "ecs:DescribeClusters",
      "ecs:ListServices",
      "ecs:ListTasks",
      "ecs:ListTaskDefinitionFamilies",
      "ecs:DescribeServices",
      "ecs:ListContainerInstances",
      "ecs:DescribeContainerInstances",
      "ecs:DescribeTasks",
      "ecs:ListTaskDefinitions",
      "ecs:ListClusters",
      "logs:*",
      "kinesis:PutRecord",
      "kinesis:PutRecords",
    ]

    resources = [
      "*",
    ]
  }
}

resource "aws_iam_policy" "log_forwarder_policy" {
  name   = "layer0_log_forwarder_${var.layer0_prefix}"
  path   = "/"
  policy = "${data.aws_iam_policy_document.lambda_policy.json}"
}

resource "aws_iam_policy_attachment" "asg_lambda" {
  name       = "layer)_log_forwarder_${var.layer0_prefix}"
  roles      = ["${aws_iam_role.lambda_role.name}"]
  policy_arn = "${aws_iam_policy.log_forwarder_policy.arn}"
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src"
  output_path = "dist.zip"
}

resource "aws_lambda_function" "log_forwarder" {
  filename         = "dist.zip"
  source_code_hash = "${data.archive_file.lambda_zip.output_base64sha256}"
  function_name    = "splunk_log_forwarder_${var.layer0_prefix}"
  role             = "${aws_iam_role.lambda_role.arn}"
  description      = "Forwards cloudwatch logs to a kinesis stream (Custom splunk logging pipeline)"
  handler          = "index.handler"
  runtime          = "nodejs6.10"
  timeout          = 300
  memory_size      = 256

  environment {
    variables = {
      KINESIS_STREAM_NAME   = "${var.kinesis_stream_name}"
      STREAM_AWS_ACCESS_KEY = "${var.stream_aws_access_key}"
      STREAM_AWS_SECRET_KEY = "${var.stream_aws_secret_key}"
      STREAM_AWS_REGION     = "${var.stream_aws_region}"
    }
  }
}

resource "aws_cloudwatch_log_subscription_filter" "forwarder_subscription" {
  name            = "stream_forwarder_filter"
  log_group_name  = "l0-${var.layer0_prefix}"
  filter_pattern  = "${var.filter}"
  destination_arn = "${aws_lambda_function.log_forwarder.arn}"
}
