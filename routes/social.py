"""
Social / Community Posts & Gamification Leaderboard
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import date, datetime
from decimal import Decimal

social_bp = Blueprint('social', __name__)

def get_db():
    from app import get_db as _get_db
    return _get_db()

def serialize(row):
    result = dict(row)
    for key, val in result.items():
        if isinstance(val, (date, datetime)):
            result[key] = val.isoformat()
        elif isinstance(val, Decimal):
            result[key] = float(val)
    return result

@social_bp.route('/leaderboard', methods=['GET'])
@jwt_required()
def get_leaderboard():
    conn = None
    try:
        conn = get_db()
        users = [dict(u) for u in conn.execute(
            '''SELECT id, username, full_name, level, xp_points 
               FROM users 
               ORDER BY xp_points DESC 
               LIMIT 50'''
        ).fetchall()]
        return jsonify({'leaderboard': users}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@social_bp.route('/posts', methods=['GET'])
@jwt_required()
def get_posts():
    conn = None
    try:
        conn = get_db()
        posts = [serialize(p) for p in conn.execute(
            '''SELECT c.id, c.content, c.likes, c.created_at, u.username, u.full_name, u.level
               FROM community_posts c
               JOIN users u ON c.user_id = u.id
               ORDER BY c.created_at DESC
               LIMIT 50'''
        ).fetchall()]
        return jsonify({'posts': posts}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@social_bp.route('/posts', methods=['POST'])
@jwt_required()
def create_post():
    user_id = get_jwt_identity()
    data = request.get_json()

    if not data or not data.get('content'):
        return jsonify({'error': 'Content is required'}), 400

    conn = None
    try:
        conn = get_db()
        conn.execute(
            'INSERT INTO community_posts (user_id, content) VALUES (%s, %s)',
            (user_id, data['content'])
        )
        return jsonify({'message': 'Post created'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()
