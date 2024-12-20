import os
import json
import urllib.request
from urllib.parse import quote_plus
from descope import DescopeClient

aws_session_token = os.environ.get("AWS_SESSION_TOKEN")
port = os.environ.get("PARAMETERS_SECRETS_EXTENSION_HTTP_PORT", 2773)


def _get_secret_ssm_parameter_from_extension(name: str):
    # try:
    #     req = urllib.request.Request(
    #         f"http://localhost:{port}/systemsmanager/parameters/get?name={quote_plus(name)}&withDecryption=true"
    #     )
    #     req.add_header("X-Aws-Parameters-Secrets-Token", aws_session_token)
    #     response = urllib.request.urlopen(req).read()
    #     return json.loads(response)["Parameter"]["Value"]
    # except Exception as e:
    #     print(f"Error retrieving SSM parameter {name}: {e}")
    #     raise
    req = urllib.request.Request(
        f"http://localhost:{port}/systemsmanager/parameters/get?name={quote_plus(name)}&withDecryption=true"
    )
    req.add_header("X-Aws-Parameters-Secrets-Token", aws_session_token)
    response = urllib.request.urlopen(req).read()
    return json.loads(response)["Parameter"]["Value"]


def get_descope_handler(project_id, mgmt_key_name):
    # Retrieve the actual management key from SSM using the parameter name
    mgmt_key = _get_secret_ssm_parameter_from_extension(mgmt_key_name)
    print(f"Retrieved management key: {mgmt_key}")

    return DescopeClient(project_id=project_id, management_key=mgmt_key)
