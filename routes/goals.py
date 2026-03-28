"""
Goals routes - CRUD operations (Supabase/PostgreSQL - psycopg v3)
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import date, datetime
from decimal import Decimal

goals_bp = Blueprint('goals', __name__)


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


@goals_bp.route('', methods=['GET'])
@jwt_required()
def get_goals():
    user_id = get_jwt_identity()
    status = request.args.get('status')

    conn = get_db()

    try:
        query = 'SELECT * FROM goals WHERE user_id = %s'
        params = [user_id]

        if status == 'active':
            query += ' AND is_completed = FALSE'
        elif status == 'completed':
            query += ' AND is_completed = TRUE'

        query += ' ORDER BY end_date ASC'
        goals = [serialize(g) for g in conn.execute(query, params).fetchall()]

        return jsonify({'goals': goals}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@goals_bp.route('', methods=['POST'])
@jwt_required()
def create_goal():
    user_id = get_jwt_identity()
    data = request.get_json()

    title = data.get('title', '').strip()
    goal_type = data.get('goal_type')
    target_value = data.get('target_value')
    start_date = data.get('start_date')
    end_date = data.get('end_date')

    if not all([title, goal_type, target_value, start_date, end_date]):
        return jsonify({'error': 'All fields are required'}), 400

    conn = get_db()

    try:
        result = conn.execute(
            '''INSERT INTO goals (user_id, title, description, goal_type, target_value,
               current_value, unit, start_date, end_date)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id''',
            (user_id, title, data.get('description', ''), goal_type, target_value,
             data.get('current_value', 0), data.get('unit', ''), start_date, end_date)
        ).fetchone()

        return jsonify({'message': 'Goal created', 'goal_id': result['id']}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@goals_bp.route('/<int:goal_id>', methods=['PUT'])
@jwt_required()
def update_goal(goal_id):
    user_id = get_jwt_identity()
    data = request.get_json()

    conn = get_db()

    try:
        updates = []
        params = []

        for field in ['title', 'description', 'current_value', 'target_value', 'is_completed']:
            if field in data:
                updates.append(f'{field} = %s')
                params.append(data[field])

        if not updates:
            return jsonify({'error': 'No fields to update'}), 400

        params.extend([goal_id, user_id])
        cur = conn.execute(
            f'UPDATE goals SET {", ".join(updates)} WHERE id = %s AND user_id = %s',
            params
        )

        if cur.rowcount == 0:
            return jsonify({'error': 'Goal not found'}), 404

        return jsonify({'message': 'Goal updated'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@goals_bp.route('/<int:goal_id>', methods=['DELETE'])
@jwt_required()
def delete_goal(goal_id):
    user_id = get_jwt_identity()

    conn = get_db()

    try:
        cur = conn.execute('DELETE FROM goals WHERE id = %s AND user_id = %s', (goal_id, user_id))

        if cur.rowcount == 0:
            return jsonify({'error': 'Goal not found'}), 404

        return jsonify({'message': 'Goal deleted'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
