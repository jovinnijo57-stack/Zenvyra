"""
Nutrition & Water Tracking (Supabase/PostgreSQL - psycopg v3)
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import date, datetime
from decimal import Decimal

nutrition_bp = Blueprint('nutrition', __name__)

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

@nutrition_bp.route('/log_meal', methods=['POST'])
@jwt_required()
def log_meal():
    user_id = get_jwt_identity()
    data = request.get_json()

    if not data or not data.get('food_name') or not data.get('calories'):
        return jsonify({'error': 'Food name and calories are required'}), 400

    conn = None
    try:
        conn = get_db()
        conn.execute(
            '''INSERT INTO nutrition_logs (user_id, log_date, meal_type, food_name, calories, protein_g, carbs_g, fat_g)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)''',
            (user_id, data.get('log_date', date.today().isoformat()), data.get('meal_type', 'snack'),
             data.get('food_name'), data.get('calories'), data.get('protein_g', 0),
             data.get('carbs_g', 0), data.get('fat_g', 0))
        )
        return jsonify({'message': 'Meal logged successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@nutrition_bp.route('/daily', methods=['GET'])
@jwt_required()
def get_daily_nutrition():
    user_id = get_jwt_identity()
    log_date = request.args.get('date', date.today().isoformat())

    conn = None
    try:
        conn = get_db()
        meals = [serialize(m) for m in conn.execute(
            'SELECT * FROM nutrition_logs WHERE user_id = %s AND log_date = %s',
            (user_id, log_date)
        ).fetchall()]
        
        water = conn.execute(
            'SELECT amount_ml FROM water_logs WHERE user_id = %s AND log_date = %s',
            (user_id, log_date)
        ).fetchone()

        water_ml = water['amount_ml'] if water else 0

        # Totals
        totals = {
            'calories': sum(m['calories'] for m in meals),
            'protein': sum(m['protein_g'] for m in meals),
            'carbs': sum(m['carbs_g'] for m in meals),
            'fat': sum(m['fat_g'] for m in meals),
            'water_ml': water_ml
        }

        return jsonify({'meals': meals, 'totals': totals}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@nutrition_bp.route('/log_water', methods=['POST'])
@jwt_required()
def log_water():
    user_id = get_jwt_identity()
    data = request.get_json()

    amount = int(data.get('amount_ml', 250)) # Default to 1 glass (250ml)
    log_date = data.get('log_date', date.today().isoformat())

    conn = None
    try:
        conn = get_db()
        conn.execute(
            '''INSERT INTO water_logs (user_id, log_date, amount_ml)
               VALUES (%s, %s, %s)
               ON CONFLICT (user_id, log_date) 
               DO UPDATE SET amount_ml = water_logs.amount_ml + EXCLUDED.amount_ml''',
            (user_id, log_date, amount)
        )
        return jsonify({'message': 'Water logged successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()
