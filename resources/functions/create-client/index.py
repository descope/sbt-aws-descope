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
project_id = os.environ.get("DESCOPE_PROJECT_ID")
descope_mgmt_key = os.environ.get("DESCOPE_MANAGEMENT_KEY")


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
    name = request.body("name")
    description = request.body("description")

    try:
        logger.info("Creating a new access key...")
        client_data = {
            "name": name,
            "description": description,
        }

        # Create the access key
        client = descope.mgmt.access_key.create(**client_data)

        # Extract the client ID and access key ID
        client_id = client["key"]["clientId"]
        access_key_id = client["key"]["id"]

        # Log the access key details
        logger.info(f"Access key created: {access_key_id}")

        # Return data to CloudFormation
        helper.Data.update(
            {
                "ClientId": client_id,
                "ClientSecret": access_key_id,  # Returning only the key, not the entire response
            }
        )
    except Exception as e:
        logger.error(f"Error creating client or access key: {str(e)}")
        raise e


def handler(event, context):
    helper(event, context)
