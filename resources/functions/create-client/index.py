import os
from utils import get_descope_handler
from crhelper import CfnResource
import logging

# Initialize logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize CloudFormation helper
helper = CfnResource()

# Retrieve Descope project credentials from environment variables or configuration
project_id = os.environ.get("DescopeProjectId")
descope_mgmt_key = os.environ.get("ManagementSSMKeyName")


@helper.create
def create_client(event, _):
    """
    Called as part of the bootstrap template.

    Args:
        event (dict): The event payload from CloudFormation.
        _ (context): The context object (unused).
    """

    # Initialize the Descope client
    descope = get_descope_handler(project_id, descope_mgmt_key)
    request = event.get("ResourceProperties", {})
    name = request.get("name")
    description = request.get("description")

    try:
        logger.info("Creating a new access key...")
        client_data = {
            "name": name,
            "expire_time": 0,
            "description": description,
        }

        # Create the access key
        response = descope.mgmt.access_key.create(**client_data)

        logger.info(f"Descope response: {response}")

        # Extract the client ID and secret from the response
        client_id = response["key"].get("clientId")
        client_secret = response.get("cleartext")

        if not client_secret:
            raise ValueError("ClientSecret not found in Descope response.")

        # Log the access key details
        logger.info(f"Access key created with ClientId: {client_id}")

        # Return data to CloudFormation
        helper.Data.update(
            {
                "ClientId": client_id,
                "ClientSecret": client_secret,  # Returning both client ID and secret
            }
        )
    except Exception as e:
        logger.error(f"Error creating client or access key: {str(e)}")
        raise e


def handler(event, context):
    helper(event, context)
