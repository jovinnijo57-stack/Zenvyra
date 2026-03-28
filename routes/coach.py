"""
AI Smart Coach Insights
"""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import date, timedelta
import random

coach_bp = Blueprint('coach', __name__)

def get_db():
    from app import get_db as _get_db
    return _get_db()

@coach_bp.route('/insights', methods=['GET'])
@jwt_required()
def get_insights():
    user_id = get_jwt_identity()

    conn = None
    try:
        conn = get_db()
        
        # Analyze last 7 days vs previous 7 days
        today = date.today()
        seven_days_ago = today - timedelta(days=7)
        fourteen_days_ago = today - timedelta(days=14)

        current_week = conn.execute(
            'SELECT COUNT(*) as count, COALESCE(SUM(duration_minutes), 0) as mins FROM workouts WHERE user_id = %s AND workout_date >= %s',
            (user_id, seven_days_ago)
        ).fetchone()

        last_week = conn.execute(
            'SELECT COUNT(*) as count, COALESCE(SUM(duration_minutes), 0) as mins FROM workouts WHERE user_id = %s AND workout_date >= %s AND workout_date < %s',
            (user_id, fourteen_days_ago, seven_days_ago)
        ).fetchone()

        insights = []
        
        # 1. Performance Insight
        if current_week['mins'] > last_week['mins']:
            percent = int(((current_week['mins'] - last_week['mins']) / max(last_week['mins'], 1)) * 100)
            insights.append({
                'type': 'positive',
                'title': 'Awesome Progress! 🚀',
                'message': f'You worked out {percent}% longer this week compared to last week. Keep the momentum going!'
            })
        elif current_week['count'] < 2:
            insights.append({
                'type': 'warning',
                'title': 'Time to Move! ⏱️',
                'message': 'You only logged a few workouts this week. A quick 15-minute session today can break the slump!'
            })

        # 2. Nutrition/Water insight
        water_today = conn.execute(
            'SELECT amount_ml FROM water_logs WHERE user_id = %s AND log_date = %s',
            (user_id, today)
        ).fetchone()

        water_ml = water_today['amount_ml'] if water_today else 0
        if water_ml < 2000:
            insights.append({
                'type': 'info',
                'title': 'Hydration Check 💧',
                'message': f"You've only drank {water_ml}ml today. Aim for at least 2500ml for optimal recovery and performance."
            })

        # 3. Dynamic "AI" Motivation
        motivations = [
            "Rest days are just as important as training days. Don't forget to recover!",
            "Consistency is the key to unlocking your fitness goals.",
            "You are doing better than the you of yesterday.",
            "Mix up your routine! Trying a new category can spark new muscle growth."
        ]
        
        insights.append({
            'type': 'motivation',
            'title': 'Coach Insight 🧠',
            'message': random.choice(motivations)
        })

        return jsonify({'insights': insights}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()
