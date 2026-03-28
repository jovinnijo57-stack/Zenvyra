"""
Workout routes - CRUD operations (Supabase/PostgreSQL - psycopg v3)
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import date, datetime
from decimal import Decimal

workouts_bp = Blueprint('workouts', __name__)


def get_db():
    from app import get_db as _get_db
    return _get_db()


def serialize(row):
    """Convert row dict to JSON-safe format."""
    result = dict(row)
    for key, val in result.items():
        if isinstance(val, (date, datetime)):
            result[key] = val.isoformat()
        elif isinstance(val, Decimal):
            result[key] = float(val)
    return result


@workouts_bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    conn = get_db()
    try:
        rows = conn.execute('SELECT * FROM workout_categories ORDER BY name').fetchall()
        return jsonify({'categories': [dict(c) for c in rows]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@workouts_bp.route('', methods=['GET'])
@jwt_required()
def get_workouts():
    user_id = get_jwt_identity()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    category_id = request.args.get('category_id', type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    conn = get_db()

    try:
        query = '''
            SELECT w.*, wc.name as category_name, wc.icon as category_icon, wc.color as category_color
            FROM workouts w
            JOIN workout_categories wc ON w.category_id = wc.id
            WHERE w.user_id = %s
        '''
        params = [user_id]

        if category_id:
            query += ' AND w.category_id = %s'
            params.append(category_id)
        if start_date:
            query += ' AND w.workout_date >= %s'
            params.append(start_date)
        if end_date:
            query += ' AND w.workout_date <= %s'
            params.append(end_date)

        query += ' ORDER BY w.workout_date DESC, w.created_at DESC'
        query += ' LIMIT %s OFFSET %s'
        params.extend([per_page, (page - 1) * per_page])

        workouts = [serialize(w) for w in conn.execute(query, params).fetchall()]

        # Get total count
        count_query = 'SELECT COUNT(*) as total FROM workouts WHERE user_id = %s'
        count_params = [user_id]
        if category_id:
            count_query += ' AND category_id = %s'
            count_params.append(category_id)
        total = conn.execute(count_query, count_params).fetchone()['total']

        return jsonify({
            'workouts': workouts,
            'total': total,
            'page': page,
            'per_page': per_page
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@workouts_bp.route('', methods=['POST'])
@jwt_required()
def create_workout():
    user_id = get_jwt_identity()
    data = request.get_json()

    title = data.get('title', '').strip()
    category_id = data.get('category_id')
    duration_minutes = data.get('duration_minutes')
    workout_date = data.get('workout_date')

    if not all([title, category_id, duration_minutes, workout_date]):
        return jsonify({'error': 'Title, category, duration, and date are required'}), 400

    conn = get_db()

    try:
        result = conn.execute(
            '''INSERT INTO workouts (user_id, category_id, title, description, duration_minutes,
               calories_burned, intensity, workout_date, notes)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id''',
            (user_id, category_id, title, data.get('description', ''),
             duration_minutes, data.get('calories_burned', 0),
             data.get('intensity', 'medium'), workout_date, data.get('notes', ''))
        ).fetchone()
        workout_id = result['id']

        # Add exercises if provided
        exercises = data.get('exercises', [])
        for idx, ex in enumerate(exercises):
            conn.execute(
                '''INSERT INTO exercises (workout_id, name, sets_count, reps_count,
                   weight_kg, duration_seconds, rest_seconds, order_index)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)''',
                (workout_id, ex.get('name', ''), ex.get('sets_count'),
                 ex.get('reps_count'), ex.get('weight_kg'),
                 ex.get('duration_seconds'), ex.get('rest_seconds'), idx)
            )

        return jsonify({'message': 'Workout created', 'workout_id': workout_id}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@workouts_bp.route('/<int:workout_id>', methods=['GET'])
@jwt_required()
def get_workout(workout_id):
    user_id = get_jwt_identity()

    conn = get_db()

    try:
        workout = conn.execute(
            '''SELECT w.*, wc.name as category_name, wc.icon as category_icon, wc.color as category_color
               FROM workouts w
               JOIN workout_categories wc ON w.category_id = wc.id
               WHERE w.id = %s AND w.user_id = %s''',
            (workout_id, user_id)
        ).fetchone()

        if not workout:
            return jsonify({'error': 'Workout not found'}), 404

        workout = serialize(workout)

        exercises = conn.execute(
            'SELECT * FROM exercises WHERE workout_id = %s ORDER BY order_index',
            (workout_id,)
        ).fetchall()
        workout['exercises'] = [serialize(e) for e in exercises]

        return jsonify({'workout': workout}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@workouts_bp.route('/<int:workout_id>', methods=['DELETE'])
@jwt_required()
def delete_workout(workout_id):
    user_id = get_jwt_identity()

    conn = get_db()

    try:
        cur = conn.execute('DELETE FROM workouts WHERE id = %s AND user_id = %s', (workout_id, user_id))

        if cur.rowcount == 0:
            return jsonify({'error': 'Workout not found'}), 404

        return jsonify({'message': 'Workout deleted'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
