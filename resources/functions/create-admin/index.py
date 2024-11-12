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
    Dummy function to create admin user in Descope. Descopers can only be created in Descope Console.

    Args:
        event (dict): The event payload from CloudFormation.
        _ (context): The context object (unused).
    """

    print("No admin user was created. Please use Descope Console to do so.")


def handler(event, context):
    helper(event, context)
