from functools import wraps
from flask_jwt_extended import verify_jwt_in_request, get_jwt

# Role-based access control decorator
def role_required(roles):
    if isinstance(roles, str):
        roles = [roles]

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            # Uncomment for debugging
            # print("JWT verified successfully")

            jwt_data = get_jwt()
            # Uncomment for debugging
            # print(f"JWT Data: {jwt_data}")

            user_role = jwt_data.get(
                "UserType", ""
            )  # Adjusted to match your JWT structure
            # Uncomment for debugging
            # print(f"User Role: {user_role}")

            if user_role not in roles:
                # Uncomment for debugging
                # print("Access forbidden: Insufficient permissions")
                return {
                    "error": "Access forbidden: You don't have permission to access this resource."
                }, 403

            return fn(*args, **kwargs)

        return wrapper

    return decorator
