import os
import json
import urllib.request
from urllib.parse import quote_plus
from descope import DescopeClient


def _get_secret_ssm_parameter_from_extension(name: str):
    port = os.environ.get("PARAMETERS_SECRETS_EXTENSION_HTTP_PORT", 2773)
    aws_session_token = os.environ.get("AWS_SESSION_TOKEN")
    req = urllib.request.Request(
        f"http://localhost:{port}/systemsmanager/parameters/get?name={quote_plus(name)}&withDecrytion=true"
    )
    req.add_header("X-Aws-Parameters-Secrets-Token", aws_session_token)
    config = urllib.request.urlopen(req).read()
    return json.loads(config)["Parameter"]["Value"]


def get_descope_handler(project_id, client_secret_mgmt_key):
    mgmt_key = _get_secret_ssm_parameter_from_extension(client_secret_mgmt_key)
    return DescopeClient(project_id, mgmt_key)
