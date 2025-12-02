import base64
import hmac
import hashlib

def crack_jwt(jwt_token, wordlist_file):
    # Split JWT into parts
    header, payload, signature = jwt_token.split('.')
    
    # Create the message to sign (header + "." + payload)
    message = header + "." + payload
    
    # Read wordlist
    with open(wordlist_file, 'r') as f:
        passwords = [line.strip() for line in f]
    
    print(f"Trying {len(passwords)} passwords...")
    
    for password in passwords:
        # Generate HMAC-SHA256 signature
        expected_sig = hmac.new(
            password.encode(),
            message.encode(),
            hashlib.sha256
        ).digest()
        
        # Convert to base64url (remove padding)
        expected_b64 = base64.urlsafe_b64encode(expected_sig).decode().rstrip('=')
        
        if expected_b64 == signature:
            print(f"FOUND! Secret key: {password}")
            return password
            
        print(f"Trying: {password}")
    
    print("Not found in wordlist")
    return None

# Read JWT from file
with open('jwt.txt', 'r') as f:
    jwt = f.read().strip()

# Crack it
result = crack_jwt(jwt, 'wordlist.txt')