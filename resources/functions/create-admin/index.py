import os
from crhelper import CfnResource
import logging

# Initialize logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize CloudFormation helper
helper = CfnResource()


@helper.create
def create_user(event, _):
    """
    Dummy function to simulate the creation of an admin user in Descope.
    Actual admin users should be created in the Descope Console.

    Args:
        event (dict): The event payload from CloudFormation.
        _ (context): The context object (unused).
    """
    logger.info(
        "No admin user was created. Please use Descope Console to create admin users."
    )
    # Send a response back with dummy data
    helper.Data.update(
        {
            "Status": "No action taken",
            "Message": "Please create admin users via the Descope Console.",
        }
    )


def handler(event, context):
    helper(event, context)
