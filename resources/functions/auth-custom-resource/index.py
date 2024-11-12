from descope import AuthException
from crhelper import CfnResource
from utils import get_descope_handler
import logging

# Initialize CloudFormation helper and logger
helper = CfnResource()
logger = logging.getLogger()
logger.setLevel(logging.INFO)


@helper.create
@helper.update
def do_action(event, _):
    """
    Called as part of the bootstrap template.
    Inserts/Updates user settings based on the resources deployed inside the bootstrap template.
    We use these settings inside the tenant template.

    Args:
        event (dict): The event payload from CloudFormation.
        _ (context): The context object (unused).
    """
    # Extract required properties from the event
    user_name = event['ResourceProperties']['Name']
    email = event['ResourceProperties']['Email']
    user_display_name = event['ResourceProperties']['DisplayName']  # Corrected key without space

    project_id = event['ResourceProperties']['ProjectID']
    mgmt_client_secret_mgmt_key = event['ResourceProperties']['ClientSecret']

    # Initialize the Descope client
    descope_client = get_descope_handler(project_id, mgmt_client_secret_mgmt_key)

    try:
        # Create the user
        create_user_response = descope_client.mgmt.user.create(
            login_id=user_name,
            email=email,
            display_name=user_display_name
        )
        logger.info(f'User created successfully: {create_user_response}')

        # Return data to CloudFormation
        helper.Data.update({
            'UserName': user_name
        })
    except AuthException as e:
        if "user already exists" in str(e).lower():
            logger.info(f'User '{user_name}' already exists.')
        else:
            logger.error(f'Error creating user: {e}')
            raise
    except Exception as e:
        logger.error(f'An unexpected error occurred: {e}')
        raise


@helper.delete
def delete_user(event, _):
    """
    Deletes a user when the CloudFormation stack is deleted.

    Args:
        event (dict): The event payload from CloudFormation.
        _ (context): The context object (unused).
    """
    user_name = event['ResourceProperties']['Name']
    project_id = event['ResourceProperties']['ProjectID']
    mgmt_client_secret_mgmt_key = event['ResourceProperties']['ClientSecret']

    # Initialize the Descope client
    descope_client = get_descope_handler(project_id, mgmt_client_secret_mgmt_key)

    try:
        # Delete the user
        descope_client.mgmt.user.delete(user_name)
        logger.info(f'User {user_name} deleted successfully.')
    except Exception as e:
        logger.error(f'Failed to delete user {user_name}: {e}')
        raise


def handler(event, context):
    helper(event, context)