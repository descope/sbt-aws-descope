import base64
import json
import http.client
import os
from urllib.parse import urlencode

descope_project_id = os.environ['DESCOPE_PROJECT_ID']
descope_access_key = os.environ['DESCOPE_ACCESS_KEY']
descope_management_base_url = os.environ['DESCOPE_MANAGEMENT_BASE_URL']

# set of utility functions making API requests 

def request_descope_resource(method, resource, payload):
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {descope_project_id}'
    }
    path = f'/v1/search/~/{resource}'
    return request(descope_management_base_url, method, path, headers, payload, json.dumps)

def request(base_url, method, path, headers, payload, serialize, log_payload = True):
    conn = http.client.HTTPSConnection(base_url.replace('https://', ''), 443)

    print(f'Making request to {method} {base_url}{path}')
    payload_str = serialize(payload) if payload else None

    if (log_payload):
        print(payload_str)

    # Retry HTTP requests up to 3 times
    retry = 3
    while retry:
        try:
            conn.request(method, path, payload_str, headers)
            response = conn.getresponse()
            print(f'response.status={response.status}')
            response_body = response.read().decode('utf-8')
            if (log_payload):
                print(response_body.replace('\n', '').replace('\r',''))
            if response.status >= 400:
                raise Exception(f'HTTP error {response.status}')
            return json.loads(response_body)
        except Exception as e: 
            print(e)
            if not retry:
                raise e
            print(f'Retrying... Attempt {3 - retry}')
            retry -= 1