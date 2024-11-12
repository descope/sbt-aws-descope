import os
from utils import get_descope_handler
from aws_lambda_powertools import Tracer
from aws_lambda_powertools import Logger
from crhelper import CfnResource
from aws_lambda_powertools.event_handler.exceptions import (
    InternalServerError,
    NotFoundError,
)

logger = Logger()
helper = CfnResource()

# Initialize the Descope client
descope_client = DescopeClient()

@app.post("/users")
@tracer.capture_method
def create_user(userName, email):
    response =  descope_client.mgmt.user.create({
        'userName': userName,
        'email': email
    })
    logger.info(response)
    if response is None:
        raise InternalServerError("Failed to create user")
    return {"data": {'userName': userName}}

@app.get("/users")
@tracer.capture_method
def get_users(limit = 10):
    user_details = {}
    user_details['limit'] = limit
    resp= descope_client.mgmt.user.search_all(user_details)
    logger.info(resp.serialize())
    return_response = {
        "data": resp.serialize()
    }

    return return_response 


@app.get("/users/<userId>")
@tracer.capture_method
def get_user(userId):
    user_resp = descope_client.mgmt.user.load_by_user_id(userId)
    user = user_resp["user"]
    if user:
        logger.info(user.serialize())
        return {'data': user.serialize()}
    else:
        logger.info("User not found")
        raise NotFoundError(f"User {userId} not found.")


@app.put("/users/<userId>")
@tracer.capture_method
def update_user(userId,
                email):
    user_details = {
        'new_email@xyz.com': email,
    }

    resp = descope_client.mgmt.user.update(user_details)
    logger.info(response)
    return {"message": "User updated"}


@app.delete("/users/<userId>/disable")
@tracer.capture_method
def disable_user(userId):
    user_Id='aaa'
    resp = descope_client.mgmt.user.deactivate(login_id=user_Id)
    logger.info(resp)
    return {"message": "User disabled"}


@app.put("/users/<userId>/enable")
@tracer.capture_method
def enable_user(userId):
    user_Id = 'yyyyy'
    resp = descope_client.mgmt.user.activate(login_id=user_Id)
    logger.info(response)
    return {"message": "User enabled"}


@app.delete("/users/<userId>")
@tracer.capture_method
def delete_user(userId):
    user_Id = 'xxxxx'
    resp = resp = descope_client.mgmt.user.delete(login_id=user_Id)
    if resp is None:
        logger.info(f"user {userId} not found.")
    logger.info(resp)
    return {"message": "User deleted"}




        

        


  
