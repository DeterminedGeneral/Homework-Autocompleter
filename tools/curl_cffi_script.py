import sys
import json
import base64
from curl_cffi import requests as cffi_requests

def make_request(request_data):
    url = request_data.get('url')
    method = request_data.get('method', 'GET')
    headers = request_data.get('headers', {})
    cookies_str = request_data.get('cookies', '')
    data = request_data.get('data')
    is_binary_data = request_data.get('is_binary_data', False)

    # Parse cookies string into a dict
    cookies = {}
    if cookies_str:
        for cookie in cookies_str.split('; '):
            if '=' in cookie:
                k, v = cookie.split('=', 1)
                cookies[k] = v

    # Prepare body
    body = None
    if data:
        if is_binary_data:
            body = base64.b64decode(data)
        else:
            body = data

    try:
        if method.upper() == 'GET':
            response = cffi_requests.get(url, headers=headers, cookies=cookies, impersonate="chrome124")
        else:
             response = cffi_requests.post(url, headers=headers, cookies=cookies, data=body, impersonate="chrome124")

        # Encode body as base64 to ensure binary safety
        response_body_b64 = base64.b64encode(response.content).decode('utf-8')
        
        result = {
            "statusCode": response.status_code,
            "headers": dict(response.headers),
            "body": response_body_b64
        }
        print(json.dumps(result))
        sys.stdout.flush()

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stdout) # Use stdout so Node catches it as response
        sys.stdout.flush()
        # Do not exit(1) in persistent mode if using loop, but let's check caller context.
        # Actually if make_request is called in loop, we want to return.
        pass

if __name__ == "__main__":
    if len(sys.argv) > 1:
        try:
            input_arg = sys.argv[1]
            if input_arg.startswith("@"):
                 with open(input_arg[1:], 'r') as f:
                     request_json = f.read()
            else:
                 request_json = sys.argv[1]
            
            request_data = json.loads(request_json)
            make_request(request_data)
        except Exception as e:
            print(json.dumps({"error": f"Invalid input: {e}"}), file=sys.stderr)
            sys.exit(1)
    else:
        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                line = line.strip()
                if not line:
                    continue
                try:
                    request_data = json.loads(line)
                    make_request(request_data)
                except json.JSONDecodeError:
                    print(json.dumps({"error": "Invalid JSON input"}), file=sys.stdout)
                    sys.stdout.flush()
                except Exception as e:
                    print(json.dumps({"error": f"Processing error: {str(e)}"}), file=sys.stdout)
                    sys.stdout.flush()
            except KeyboardInterrupt:
                break
            except Exception:
                break
