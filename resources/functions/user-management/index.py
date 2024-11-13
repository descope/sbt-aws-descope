import os
from utils import get_descope_handler
from aws_lambda_powertools import Tracer, Logger
from aws_lambda_powertools.event_handler import ApiGatewayResolver
from aws_lambda_powertools.event_handler.exceptions import (
    InternalServerError,
    NotFoundError,
)
from descope import AuthException

# Initialize Logger, Tracer, and API Gateway Resolver
logger = Logger()
tracer = Tracer()
app = ApiGatewayResolver()

# Retrieve Descope project credentials from environment variables or configuration
project_id = os.environ.get("DescopeProjectId")
descope_mgmt_key = os.environ.get("ManagementSSMKeyName")

# Initialize the Descope client using the get_descope_handler function
descope_client = get_descope_handler(project_id, descope_mgmt_key)


@app.post("/users")
@tracer.capture_method
def create_user():
    """
    Create a new user.
    Expects a JSON body with 'userName' and 'email'.
    """
    try:
        # Get JSON body from the request
        body = app.current_event.json_body
        userName = body.get("userName")
        email = body.get("email")
        if not userName or not email:
            raise ValueError("Missing 'userName' or 'email' in request body.")
        logger.info(f"Creating user with userName: {userName}, email: {email}")

        # Create the user using Descope client
        response = descope_client.mgmt.user.create(login_id=userName, email=email)
        logger.info(f"User created successfully: {response}")
        return {"data": {"userName": userName}}
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


@app.get("/users/<userId>")
@tracer.capture_method
def get_user(userId):
    """
    Retrieve a user by user ID or login ID.
    """
    try:
        logger.info(f"Retrieving user with ID: {userId}")

        # First, try to load the user by user ID
        user = descope_client.mgmt.user.load_by_user_id(userId)
        if user:
            logger.info(f"User retrieved successfully by user ID: {user}")
            return {"data": user}
        else:
            logger.info(f"User with user ID {userId} not found. Trying login ID.")

            # Try to load the user by login ID
            user = descope_client.mgmt.user.load(login_id=userId)
            if user:
                logger.info(f"User retrieved successfully by login ID: {user}")
                return {"data": user}
            else:
                logger.info(f"User with login ID {userId} not found.")
                raise NotFoundError(f"User {userId} not found.")
    except Exception as e:
        logger.error(f"Error retrieving user {userId}: {e}")
        raise InternalServerError("Failed to retrieve user.")


@app.put("/users/<userId>")
@tracer.capture_method
def update_user(userId):
    """
    Update a user's email.
    Expects a JSON body with 'email'.
    """
    try:
        # Get JSON body from the request
        body = app.current_event.json_body
        email = body.get("email")
        if not email:
            raise ValueError("Missing 'email' in request body.")
        logger.info(f"Updating user {userId} with new email: {email}")

        # Update the user's email using Descope client
        response = descope_client.mgmt.user.update(login_id=userId, email=email)
        logger.info(f"User {userId} updated successfully: {response}")
        return {"message": "User updated"}
    except Exception as e:
        logger.error(f"Error updating user {userId}: {e}")
        raise InternalServerError("Failed to update user.")


@app.delete("/users/<userId>/disable")
@tracer.capture_method
def disable_user(userId):
    """
    Disable (deactivate) a user.
    """
    try:
        logger.info(f"Disabling user {userId}")

        # Deactivate user using Descope client
        response = descope_client.mgmt.user.deactivate(login_id=userId)
        logger.info(f"User {userId} disabled successfully: {response}")
        return {"message": "User disabled"}
    except Exception as e:
        logger.error(f"Error disabling user {userId}: {e}")
        raise InternalServerError("Failed to disable user.")


@app.put("/users/<userId>/enable")
@tracer.capture_method
def enable_user(userId):
    """
    Enable (activate) a user.
    """
    try:
        logger.info(f"Enabling user {userId}")

        # Activate user using Descope client
        response = descope_client.mgmt.user.activate(login_id=userId)
        logger.info(f"User {userId} enabled successfully: {response}")
        return {"message": "User enabled"}
    except Exception as e:
        logger.error(f"Error enabling user {userId}: {e}")
        raise InternalServerError("Failed to enable user.")


@app.delete("/users/<userId>")
@tracer.capture_method
def delete_user(userId):
    """
    Delete a user.
    """
    try:
        logger.info(f"Deleting user {userId}")

        # Delete user using Descope client
        response = descope_client.mgmt.user.delete(login_id=userId)
        logger.info(f"User {userId} deleted successfully: {response}")
        return {"message": "User deleted"}
    except Exception as e:
        logger.error(f"Error deleting user {userId}: {e}")
        raise InternalServerError("Failed to delete user.")


def lambda_handler(event, context):
    return app.resolve(event, context)
