
from descope import DescopeClient, AuthException
from crhelper import CfnResource
helper = CfnResource()


@helper.create
@helper.update
def do_action(event, _):
    """ Called as part of bootstrap template. 
        Inserts/Updates Settings table based upon the resources deployed inside bootstrap template
        We use these settings inside tenant template

    Args:
            event ([type]): [description]
            _ ([type]): [description]
    """
    user_name = event['ResourceProperties']['Name']
    email = event['ResourceProperties']['Email']
    user_display_name = event['ResourceProperties']['Display Name']


# Initialize the Descope client
descope_client = DescopeClient()


def create_user(user_name, email, user_role):
    try:
        # Create the user
        create_user_response = descope_client.mgmt.create_user(
            login_id=user_name,
            email=email,
            display_name=user_display_name
        )
        print(f'User created successfully: {create_user_response}')
        return user_name
    except AuthException as e:
        if "user already exists" in str(e).lower():
            print(f'User: {user_name} already exists!')
        else:
            print(f'Error creating user: {e}')
    except Exception as e:
        print(f'An unexpected error occurred: {e}')
    return None


@helper.delete

def delete_user(email):

    try:
        # Delete user. Permanent action, cannot be undone.

        delete_user_response= descope_client.mgmt.user.delete(email)
print(f'User deleted successfully')
    return delete_user_response
     except Exception as e:
        print(f'failed to delete: {e}')
    return None
    
def handler(event, context):
    helper(event, context)







