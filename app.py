"""
Fitness Tracker - Flask Backend API (Supabase/PostgreSQL)
"""
import os
from datetime import timedelta
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='frontend', static_url_path='')
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-dev-secret')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)

CORS(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

# Supabase PostgreSQL pooler connection string
DB_URL = os.getenv('SUPABASE_DB_URL')


def get_db():
    """Get a PostgreSQL database connection via Supabase pooler using psycopg v3."""
    import psycopg
    conn = psycopg.connect(DB_URL, autocommit=True, row_factory=psycopg.rows.dict_row)
    return conn


# Register blueprints
from routes.auth import auth_bp
from routes.workouts import workouts_bp
from routes.goals import goals_bp
from routes.stats import stats_bp
from routes.profile import profile_bp
from routes.nutrition import nutrition_bp
from routes.social import social_bp
from routes.coach import coach_bp

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(workouts_bp, url_prefix='/api/workouts')
app.register_blueprint(goals_bp, url_prefix='/api/goals')
app.register_blueprint(stats_bp, url_prefix='/api/stats')
app.register_blueprint(profile_bp, url_prefix='/api/profile')
app.register_blueprint(nutrition_bp, url_prefix='/api/nutrition')
app.register_blueprint(social_bp, url_prefix='/api/social')
app.register_blueprint(coach_bp, url_prefix='/api/coach')


# Serve frontend
@app.route('/')
def serve_frontend():
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


if __name__ == '__main__':
    app.run(debug=True, port=5000)
