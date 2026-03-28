"""
Profile routes - User profile management (Supabase/PostgreSQL - psycopg v3)
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_bcrypt import generate_password_hash, check_password_hash

profile_bp = Blueprint('profile', __name__)


def get_db():
    from app import get_db as _get_db
    return _get_db()


@profile_bp.route('', methods=['GET'])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()

    conn = get_db()

    try:
        user = conn.execute(
            '''SELECT id, username, email, full_name, age, gender, height_cm, weight_kg, created_at
               FROM users WHERE id = %s''',
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


@profile_bp.route('', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    data = request.get_json()

    conn = get_db()

    try:
        allowed_fields = ['full_name', 'age', 'gender', 'height_cm', 'weight_kg']
        updates = []
        params = []

        for field in allowed_fields:
            if field in data:
                updates.append(f'{field} = %s')
                params.append(data[field])

        if not updates:
            return jsonify({'error': 'No fields to update'}), 400

        params.append(user_id)
        conn.execute(
            f'UPDATE users SET {", ".join(updates)} WHERE id = %s',
            params
        )

        return jsonify({'message': 'Profile updated'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@profile_bp.route('/password', methods=['PUT'])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    data = request.get_json()

    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')

    if not current_password or not new_password:
        return jsonify({'error': 'Current and new password are required'}), 400

    if len(new_password) < 6:
        return jsonify({'error': 'New password must be at least 6 characters'}), 400

    conn = get_db()

    try:
        user = conn.execute('SELECT password_hash FROM users WHERE id = %s', (user_id,)).fetchone()

        if not check_password_hash(user['password_hash'], current_password):
            return jsonify({'error': 'Current password is incorrect'}), 401

        new_hash = generate_password_hash(new_password).decode('utf-8')
        conn.execute('UPDATE users SET password_hash = %s WHERE id = %s', (new_hash, user_id))

        return jsonify({'message': 'Password changed successfully'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
