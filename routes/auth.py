"""
Authentication routes - Register, Login, Token management (Supabase/PostgreSQL - psycopg v3)
"""
from flask import Blueprint, request, jsonify
from flask_bcrypt import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

auth_bp = Blueprint('auth', __name__)


def get_db():
    from app import get_db as _get_db
    return _get_db()


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    full_name = data.get('full_name', '').strip()

    if not username or not email or not password:
        return jsonify({'error': 'Username, email, and password are required'}), 400

    if not email.endswith('@gmail.com'):
        return jsonify({'error': 'Only @gmail.com email addresses are allowed for registration'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    password_hash = generate_password_hash(password).decode('utf-8')

    try:
        conn = get_db()
        # Check if user exists
        row = conn.execute('SELECT id FROM users WHERE username = %s OR email = %s', (username, email)).fetchone()
        if row:
            return jsonify({'error': 'Username or email already exists'}), 409

        # Create user
        result = conn.execute(
            'INSERT INTO users (username, email, password_hash, full_name) VALUES (%s, %s, %s, %s) RETURNING id',
            (username, email, password_hash, full_name)
        ).fetchone()
        user_id = result['id']

        access_token = create_access_token(identity=str(user_id))

        return jsonify({
            'message': 'Registration successful',
            'access_token': access_token,
            'user': {
                'id': user_id,
                'username': username,
                'email': email,
                'full_name': full_name
            }
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    conn = get_db()

    try:
        user = conn.execute(
            'SELECT id, username, email, full_name, password_hash FROM users WHERE username = %s OR email = %s',
            (username, username)
        ).fetchone()

        if not user or not check_password_hash(user['password_hash'], password):
            return jsonify({'error': 'Invalid credentials'}), 401

        access_token = create_access_token(identity=str(user['id']))

        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'full_name': user['full_name']
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()

    conn = get_db()

    try:
        user = conn.execute(
            'SELECT id, username, email, full_name, age, gender, height_cm, weight_kg, created_at FROM users WHERE id = %s',
            (user_id,)
        ).fetchone()

        if not user:
            return jsonify({'error': 'User not found'}), 404

        user = dict(user)
        if user.get('height_cm'):
            user['height_cm'] = float(user['height_cm'])
        if user.get('weight_kg'):
            user['weight_kg'] = float(user['weight_kg'])
        if user.get('created_at'):
            user['created_at'] = user['created_at'].isoformat()

        return jsonify({'user': user}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
