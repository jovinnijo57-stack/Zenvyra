"""
Stats routes - Dashboard statistics and analytics (Supabase/PostgreSQL - psycopg v3)
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import date, datetime, timedelta
from decimal import Decimal

stats_bp = Blueprint('stats', __name__)


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


@stats_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard():
    user_id = get_jwt_identity()

    conn = get_db()

    try:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        month_start = today.replace(day=1)

        # Total workouts
        total_workouts = conn.execute(
            'SELECT COUNT(*) as total FROM workouts WHERE user_id = %s', (user_id,)
        ).fetchone()['total']

        # This week's workouts
        week_stats = serialize(conn.execute(
            'SELECT COUNT(*) as total, COALESCE(SUM(duration_minutes), 0) as minutes, COALESCE(SUM(calories_burned), 0) as calories FROM workouts WHERE user_id = %s AND workout_date >= %s',
            (user_id, week_start)
        ).fetchone())

        # This month's workouts
        month_stats = serialize(conn.execute(
            'SELECT COUNT(*) as total, COALESCE(SUM(duration_minutes), 0) as minutes, COALESCE(SUM(calories_burned), 0) as calories FROM workouts WHERE user_id = %s AND workout_date >= %s',
            (user_id, month_start)
        ).fetchone())

        # Current streak
        dates_rows = conn.execute(
            '''SELECT DISTINCT workout_date FROM workouts
               WHERE user_id = %s ORDER BY workout_date DESC LIMIT 60''',
            (user_id,)
        ).fetchall()
        dates = [row['workout_date'] for row in dates_rows]
        streak = 0
        check_date = today
        for d in dates:
            if d == check_date:
                streak += 1
                check_date -= timedelta(days=1)
            elif d < check_date:
                break

        # Workouts by category (this month)
        category_breakdown = [dict(r) for r in conn.execute(
            '''SELECT wc.name, wc.icon, wc.color, COUNT(*) as count
               FROM workouts w JOIN workout_categories wc ON w.category_id = wc.id
               WHERE w.user_id = %s AND w.workout_date >= %s
               GROUP BY wc.id, wc.name, wc.icon, wc.color ORDER BY count DESC''',
            (user_id, month_start)
        ).fetchall()]

        # Recent workouts
        recent_workouts = [serialize(w) for w in conn.execute(
            '''SELECT w.*, wc.name as category_name, wc.icon as category_icon, wc.color as category_color
               FROM workouts w JOIN workout_categories wc ON w.category_id = wc.id
               WHERE w.user_id = %s ORDER BY w.workout_date DESC LIMIT 5''',
            (user_id,)
        ).fetchall()]

        # Active goals
        active_goals = [serialize(g) for g in conn.execute(
            'SELECT * FROM goals WHERE user_id = %s AND is_completed = FALSE ORDER BY end_date ASC LIMIT 3',
            (user_id,)
        ).fetchall()]

        # Last 7 days activity (for chart)
        daily_data = []
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            row = serialize(conn.execute(
                'SELECT COALESCE(SUM(duration_minutes), 0) as minutes, COALESCE(SUM(calories_burned), 0) as calories FROM workouts WHERE user_id = %s AND workout_date = %s',
                (user_id, d)
            ).fetchone())
            row['date'] = d.isoformat()
            row['day'] = d.strftime('%a')
            daily_data.append(row)

        return jsonify({
            'total_workouts': total_workouts,
            'current_streak': streak,
            'week': week_stats,
            'month': month_stats,
            'category_breakdown': category_breakdown,
            'recent_workouts': recent_workouts,
            'active_goals': active_goals,
            'daily_activity': daily_data
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@stats_bp.route('/weight', methods=['GET'])
@jwt_required()
def get_weight_history():
    user_id = get_jwt_identity()
    limit = request.args.get('limit', 30, type=int)

    conn = get_db()

    try:
        entries = [serialize(e) for e in conn.execute(
            'SELECT * FROM weight_log WHERE user_id = %s ORDER BY log_date DESC LIMIT %s',
            (user_id, limit)
        ).fetchall()]
        return jsonify({'weight_history': entries}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@stats_bp.route('/weight', methods=['POST'])
@jwt_required()
def log_weight():
    user_id = get_jwt_identity()
    data = request.get_json()

    weight_kg = data.get('weight_kg')
    log_date = data.get('log_date', date.today().isoformat())

    if not weight_kg:
        return jsonify({'error': 'Weight is required'}), 400

    conn = get_db()

    try:
        conn.execute(
            '''INSERT INTO weight_log (user_id, weight_kg, body_fat_percent, log_date, notes)
               VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT (user_id, log_date) DO UPDATE SET
               weight_kg = EXCLUDED.weight_kg,
               body_fat_percent = EXCLUDED.body_fat_percent,
               notes = EXCLUDED.notes''',
            (user_id, weight_kg, data.get('body_fat_percent'), log_date, data.get('notes', ''))
        )

        return jsonify({'message': 'Weight logged'}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
