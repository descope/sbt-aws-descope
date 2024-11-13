import os
from utils import get_descope_handler
from aws_lambda_powertools import Tracer, Logger
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver
from aws_lambda_powertools.event_handler.exceptions import (
    InternalServerError,
    NotFoundError,
)
from descope import AuthException

# Initialize Logger, Tracer, and API Gateway Resolver
logger = Logger()
tracer = Tracer()
app = APIGatewayHttpResolver()

# Retrieve Descope project credentials from environment variables or configuration
project_id = os.environ.get("DescopeProjectId")
mgmt_key_name = os.environ.get("ManagementSSMKeyName")


@app.post("/users")
@tracer.capture_method
def create_user():
    """
    Create a new user.
    Expects a JSON body with 'loginId' and 'email'.
    """
    # Initialize the Descope client using the get_descope_handler function
    descope_client = get_descope_handler(project_id, mgmt_key_name)

    try:
        # Get JSON body from the request
        body = app.current_event.json_body
        loginId = body.get("loginId")
        email = body.get("email")
        if not loginId or not email:
            raise ValueError("Missing 'userName' or 'email' in request body.")
        logger.info(f"Creating user with userName: {loginId}, email: {email}")

        # Create the user using Descope client
        response = descope_client.mgmt.user.create(login_id=loginId, email=email)
        logger.info(f"User created successfully: {response}")
        return {"data": {"userName": loginId}}
    except AuthException as e:
        logger.error(f"AuthException while creating user: {e}")
        raise InternalServerError("Failed to create user.")
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise InternalServerError("Failed to create user.")


@app.get("/users")
@tracer.capture_method
def get_users():
    """
    Retrieve a list of users.
    Optional query parameter 'limit' (default is 10).
    """
    # Initialize the Descope client using the get_descope_handler function
    descope_client = get_descope_handler(project_id, mgmt_key_name)

    try:
        # Get 'limit' from query parameters, default to 10
        limit = int(
            app.current_event.get_query_string_value(name="limit", default_value="10")
        )
        logger.info(f"Retrieving users with limit: {limit}")

        # Retrieve users using Descope client
        users = descope_client.mgmt.user.search_all(limit=limit)
        logger.info(f"Users retrieved successfully: {users}")
        return {"data": users}
    except Exception as e:
        logger.error(f"Error retrieving users: {e}")
        raise InternalServerError("Failed to retrieve users.")


@app.get("/users/<loginId>")
@tracer.capture_method
def get_user(loginId):
    """
    Retrieve a user by user ID or login ID.
    """
    # Initialize the Descope client using the get_descope_handler function
    descope_client = get_descope_handler(project_id, mgmt_key_name)

    try:
        logger.info(f"Retrieving user with ID: {loginId}")

        # Try to load the user by login ID
        user = descope_client.mgmt.user.load(login_id=loginId)
        if user:
            logger.info(f"User retrieved successfully by login ID: {user}")
            return {"data": user}
        else:
            logger.info(f"User with login ID {loginId} not found.")
            raise NotFoundError(f"User {loginId} not found.")
    except Exception as e:
        logger.error(f"Error retrieving user {loginId}: {e}")
        raise InternalServerError("Failed to retrieve user.")


@app.put("/users/<loginId>")
@tracer.capture_method
def update_user(loginId):
    """
    Update a user's email.
    Expects a JSON body with 'email'.
    """
    # Initialize the Descope client using the get_descope_handler function
    descope_client = get_descope_handler(project_id, mgmt_key_name)

    try:
        # Get JSON body from the request
        body = app.current_event.json_body
        email = body.get("email")
        if not email:
            raise ValueError("Missing 'email' in request body.")
        logger.info(f"Updating user {loginId} with new email: {email}")

        # Update the user's email using Descope client
        response = descope_client.mgmt.user.update(login_id=loginId, email=email)
        logger.info(f"User {loginId} updated successfully: {response}")
        return {"message": "User updated"}
    except Exception as e:
        logger.error(f"Error updating user {loginId}: {e}")
        raise InternalServerError("Failed to update user.")


@app.put("/users/<loginId>/disable")
@tracer.capture_method
def disable_user(loginId):
    """
    Disable (deactivate) a user.
    """
    # Initialize the Descope client using the get_descope_handler function
    descope_client = get_descope_handler(project_id, mgmt_key_name)

    try:
        logger.info(f"Disabling user {loginId}")

        # Deactivate user using Descope client
        response = descope_client.mgmt.user.deactivate(login_id=loginId)
        logger.info(f"User {loginId} disabled successfully: {response}")
        return {"message": "User disabled"}
    except Exception as e:
        logger.error(f"Error disabling user {loginId}: {e}")
        raise InternalServerError("Failed to disable user.")


@app.put("/users/<loginId>/enable")
@tracer.capture_method
def enable_user(loginId):
    """
    Enable (activate) a user.
    """
    # Initialize the Descope client using the get_descope_handler function
    descope_client = get_descope_handler(project_id, mgmt_key_name)

    try:
        logger.info(f"Enabling user {loginId}")

        # Activate user using Descope client
        response = descope_client.mgmt.user.activate(login_id=loginId)
        logger.info(f"User {loginId} enabled successfully: {response}")
        return {"message": "User enabled"}
    except Exception as e:
        logger.error(f"Error enabling user {loginId}: {e}")
        raise InternalServerError("Failed to enable user.")


@app.delete("/users/<loginId>")
@tracer.capture_method
def delete_user(loginId):
    """
    Delete a user.
    """
    # Initialize the Descope client using the get_descope_handler function
    descope_client = get_descope_handler(project_id, mgmt_key_name)

    try:
        logger.info(f"Deleting user {loginId}")

        # Delete user using Descope client
        response = descope_client.mgmt.user.delete(login_id=loginId)
        logger.info(f"User {loginId} deleted successfully: {response}")
        return {"message": "User deleted"}
    except Exception as e:
        logger.error(f"Error deleting user {loginId}: {e}")
        raise InternalServerError("Failed to delete user.")


def handler(event, context):
    return app.resolve(event, context)
