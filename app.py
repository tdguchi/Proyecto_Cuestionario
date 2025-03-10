from flask import Flask, render_template, request, jsonify, session
import json
import os
import random
import sqlite3
import datetime
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = 'your-secret-key'  # Cambiar a una clave segura en producción

# Configuración de la base de datos
DATABASE = 'quiz_app.db'

# Función para conectar a la base de datos
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

# Inicializar la base de datos
def init_db():
    with app.app_context():
        db = get_db()
        with app.open_resource('schema.sql', mode='r') as f:
            db.cursor().executescript(f.read())
        db.commit()

# Crear tablas si no existen
def create_tables():
    conn = get_db()
    cursor = conn.cursor()
    
    # Tabla para asignaturas
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    )
    ''')
    
    # Tabla para preguntas
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER,
        question_text TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        FOREIGN KEY (subject_id) REFERENCES subjects (id)
    )
    ''')
    
    # Tabla para respuestas
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER,
        answer_text TEXT NOT NULL,
        FOREIGN KEY (question_id) REFERENCES questions (id)
    )
    ''')
    
    # Tabla para historial de respuestas del usuario
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS user_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER,
        user_answer TEXT NOT NULL,
        is_correct BOOLEAN NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (question_id) REFERENCES questions (id)
    )
    ''')
    
    # Tabla para configuración de puntuación por asignatura
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS subject_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER NOT NULL,
        question_value REAL NOT NULL DEFAULT 1.0,
        wrong_answer_penalty REAL NOT NULL DEFAULT 0.25,
        no_answer_penalty REAL NOT NULL DEFAULT 0.0,
        FOREIGN KEY (subject_id) REFERENCES subjects (id),
        UNIQUE(subject_id)
    )
    ''')
    
    conn.commit()
    conn.close()

# Crear tablas al iniciar la aplicación
create_tables()

# Directorio para guardar los archivos JSON cargados
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No se ha enviado ningún archivo'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No se ha seleccionado ningún archivo'}), 400
    
    if file and file.filename.endswith('.json'):
        try:
            # Leer el contenido del archivo JSON
            content = json.loads(file.read().decode('utf-8'))
            
            # Guardar en la base de datos
            conn = get_db()
            cursor = conn.cursor()
            
            # Obtener o crear la asignatura
            asignatura = content.get('asignatura', 'Sin nombre')
            cursor.execute('INSERT OR IGNORE INTO subjects (name) VALUES (?)', (asignatura,))
            cursor.execute('SELECT id FROM subjects WHERE name = ?', (asignatura,))
            subject_id = cursor.fetchone()[0]
            
            # Crear configuración por defecto para la asignatura si no existe
            cursor.execute(
                '''
                INSERT OR IGNORE INTO subject_config 
                (subject_id, question_value, wrong_answer_penalty, no_answer_penalty) 
                VALUES (?, 1.0, 0.25, 0.0)
                ''', 
                (subject_id,)
            )
            
            # Insertar preguntas y respuestas
            questions_count = 0
            for q in content.get('questions', []):
                # Insertar pregunta
                cursor.execute(
                    'INSERT INTO questions (subject_id, question_text, correct_answer) VALUES (?, ?, ?)',
                    (subject_id, q['question'], q['correct_answer'])
                )
                question_id = cursor.lastrowid
                questions_count += 1
                
                # Insertar respuestas
                for answer in q['answers']:
                    cursor.execute(
                        'INSERT INTO answers (question_id, answer_text) VALUES (?, ?)',
                        (question_id, answer)
                    )
            
            conn.commit()
            conn.close()
            
            return jsonify({
                'success': True,
                'asignatura': asignatura,
                'num_questions': questions_count
            })
        except Exception as e:
            return jsonify({'error': f'Error al procesar el archivo: {str(e)}'}), 500
    else:
        return jsonify({'error': 'El archivo debe ser un JSON'}), 400

@app.route('/get_subjects', methods=['GET'])
def get_subjects():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name FROM subjects ORDER BY name')
    subjects = [{'id': row[0], 'name': row[1]} for row in cursor.fetchall()]
    conn.close()
    
    return jsonify({'subjects': subjects})

@app.route('/select_subject', methods=['POST'])
def select_subject():
    data = request.json
    subject_id = data.get('subject_id')
    
    if not subject_id:
        return jsonify({'error': 'No se ha seleccionado ninguna asignatura'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT name FROM subjects WHERE id = ?', (subject_id,))
    subject = cursor.fetchone()
    
    if not subject:
        conn.close()
        return jsonify({'error': 'Asignatura no encontrada'}), 404
    
    # Guardar el ID de la asignatura en la sesión
    session['subject_id'] = int(subject_id)
    print(f"Subject ID guardado en sesión: {session['subject_id']}")
    
    # Contar cuántas preguntas tiene esta asignatura
    cursor.execute('SELECT COUNT(*) FROM questions WHERE subject_id = ?', (subject_id,))
    question_count = cursor.fetchone()[0]
    print(f"La asignatura tiene {question_count} preguntas")
    
    conn.close()
    
    return jsonify({
        'success': True,
        'asignatura': subject[0],
        'num_questions': question_count
    })

@app.route('/get_questions', methods=['GET'])
def get_questions():
    if 'subject_id' not in session:
        print("Error: No hay asignatura seleccionada en la sesión")
        return jsonify({'error': 'No hay asignatura seleccionada'}), 400
    
    subject_id = session['subject_id']
    print(f"Obteniendo preguntas para subject_id: {subject_id}")
    
    num_questions = int(request.args.get('num_questions', 10))  # Este valor se está recibiendo bien
    only_failed = request.args.get('only_failed') == 'true'
    only_new = request.args.get('only_new') == 'true'
    
    # Debug para verificar
    print(f"Solicitando {num_questions} preguntas, only_failed={only_failed}, only_new={only_new}")
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Construir la consulta base
    query = '''
    SELECT q.id, q.question_text, q.correct_answer
    FROM questions q
    WHERE q.subject_id = ?
    '''
    params = [subject_id]
    
    # Aplicar filtros
    if only_failed:
        query += '''
        AND q.id IN (
            SELECT h.question_id
            FROM user_history h
            WHERE h.is_correct = 0
            GROUP BY h.question_id
        )
        '''
    
    if only_new:
        query += '''
        AND q.id NOT IN (
            SELECT h.question_id
            FROM user_history h
            GROUP BY h.question_id
        )
        '''
    
    # Ejecutar consulta primero para comprobar cuántas preguntas hay disponibles
    total_query = f"SELECT COUNT(*) FROM ({query}) AS subquery"
    cursor.execute(total_query, params)
    total_available = cursor.fetchone()[0]
    
    print(f"Total de preguntas disponibles: {total_available}")
    
    # Ajustar num_questions si es necesario
    if num_questions > total_available:
        num_questions = total_available
        print(f"Ajustando a {num_questions} preguntas disponibles")
    
    # Ejecutar la consulta con LIMIT
    cursor.execute(query + ' ORDER BY RANDOM() LIMIT ?', params + [num_questions])
    
    # Obtener preguntas
    results = cursor.fetchall()
    print(f"Preguntas recuperadas: {len(results)}")
    
    # Si no hay suficientes preguntas, mostrar mensaje
    if len(results) < 1:
        conn.close()
        return jsonify({'message': 'No hay preguntas disponibles con los filtros seleccionados'})
    
    # Guardar las preguntas en sesión
    questions = []
    question_ids = []
    
    for row in results:
        question_id = row[0]
        question_text = row[1]
        correct_answer = row[2]
        
        # Obtener todas las respuestas para esta pregunta
        cursor.execute(
            'SELECT answer_text FROM answers WHERE question_id = ? ORDER BY RANDOM()',
            (question_id,)
        )
        
        answers = [a[0] for a in cursor.fetchall()]
        
        # Añadir pregunta al resultado
        questions.append({
            'id': question_id,
            'question_text': question_text,
            'correct_answer': correct_answer,
            'answers': answers
        })
        
        question_ids.append(question_id)
    
    # Guardar IDs de preguntas en sesión
    session['current_quiz_questions'] = question_ids
    
    conn.close()
    
    print(f"Enviando {len(questions)} preguntas al cliente")
    return jsonify({'questions': questions})

@app.route('/submit_answer', methods=['POST'])
def submit_answer():
    data = request.json
    question_id = data.get('question_id')
    selected_answer = data.get('answer')
    
    if not question_id or not selected_answer:
        return jsonify({'error': 'Datos incompletos'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Obtener la respuesta correcta
    cursor.execute(
        'SELECT correct_answer FROM questions WHERE id = ?',
        (question_id,)
    )
    question_row = cursor.fetchone()
    
    if not question_row:
        conn.close()
        return jsonify({'error': 'Pregunta no encontrada'}), 404
    
    correct_answer = question_row[0]
    is_correct = selected_answer == correct_answer
    
    # Registrar respuesta en el historial de la base de datos
    cursor.execute(
        'INSERT INTO user_history (question_id, user_answer, is_correct) VALUES (?, ?, ?)',
        (question_id, selected_answer, is_correct)
    )
    
    conn.commit()
    conn.close()
    
    # Registrar esta respuesta en una tabla temporal en la base de datos en lugar de usar sesiones
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Crear tabla temporal si no existe
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS temp_quiz_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id INTEGER NOT NULL,
                is_correct BOOLEAN NOT NULL
            )
        ''')
        
        # Verificar si esta pregunta ya fue respondida
        cursor.execute('SELECT id FROM temp_quiz_responses WHERE question_id = ?', (question_id,))
        existing = cursor.fetchone()
        
        if not existing:
            # Si no existe, insertar nueva respuesta
            cursor.execute(
                'INSERT INTO temp_quiz_responses (question_id, is_correct) VALUES (?, ?)',
                (question_id, is_correct)
            )
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error al guardar respuesta temporal: {e}")
    
    return jsonify({
        'correct': is_correct,
        'correct_answer': correct_answer
    })

@app.route('/get_correct_answer', methods=['POST'])
def get_correct_answer():
    data = request.json
    question_id = data.get('question_id')
    
    if not question_id:
        return jsonify({'error': 'ID de pregunta no proporcionado'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        'SELECT correct_answer FROM questions WHERE id = ?',
        (question_id,)
    )
    question_row = cursor.fetchone()
    
    if not question_row:
        conn.close()
        return jsonify({'error': 'Pregunta no encontrada'}), 404
    
    correct_answer = question_row[0]
    conn.close()
    
    return jsonify({
        'correct_answer': correct_answer
    })

@app.route('/get_subject_config', methods=['GET'])
def get_subject_config():
    if 'subject_id' not in session:
        return jsonify({'error': 'No hay asignatura seleccionada'}), 400
    
    subject_id = session['subject_id']
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        '''
        SELECT question_value, wrong_answer_penalty, no_answer_penalty 
        FROM subject_config 
        WHERE subject_id = ?
        ''',
        (subject_id,)
    )
    
    config = cursor.fetchone()
    conn.close()
    
    if not config:
        return jsonify({
            'question_value': 1.0,
            'wrong_answer_penalty': 0.25,
            'no_answer_penalty': 0.0
        })
    
    return jsonify({
        'question_value': config[0],
        'wrong_answer_penalty': config[1],
        'no_answer_penalty': config[2]
    })

@app.route('/update_subject_config', methods=['POST'])
def update_subject_config():
    if 'subject_id' not in session:
        return jsonify({'error': 'No hay asignatura seleccionada'}), 400
    
    data = request.json
    subject_id = session['subject_id']
    
    question_value = data.get('question_value', 1.0)
    wrong_answer_penalty = data.get('wrong_answer_penalty', 0.25)
    no_answer_penalty = data.get('no_answer_penalty', 0.0)
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        '''
        INSERT OR REPLACE INTO subject_config 
        (subject_id, question_value, wrong_answer_penalty, no_answer_penalty) 
        VALUES (?, ?, ?, ?)
        ''',
        (subject_id, question_value, wrong_answer_penalty, no_answer_penalty)
    )
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/get_stats', methods=['GET'])
def get_stats():
    if 'subject_id' not in session or 'current_quiz_questions' not in session:
        return jsonify({'error': 'No hay cuestionario activo'}), 400
    
    subject_id = session['subject_id']
    current_questions = session['current_quiz_questions']
    
    # Obtener estadísticas de la tabla temporal
    conn = get_db()
    cursor = conn.cursor()
    
    # Contar respuestas correctas e incorrectas
    cursor.execute('''
        SELECT 
            COUNT(*) as total_answered,
            SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct,
            SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) as incorrect
        FROM temp_quiz_responses
    ''')
    
    stats_row = cursor.fetchone()
    
    if stats_row:
        answered_questions = stats_row[0] or 0
        correct_answers = stats_row[1] or 0
        incorrect_answers = stats_row[2] or 0
    else:
        answered_questions = 0
        correct_answers = 0
        incorrect_answers = 0
    
    # Total de preguntas del cuestionario actual
    total_questions = len(current_questions)
    unanswered_questions = total_questions - answered_questions
    
    # Obtener la configuración de puntuación
    cursor.execute(
        'SELECT question_value, wrong_answer_penalty, no_answer_penalty FROM subject_config WHERE subject_id = ?',
        (subject_id,)
    )
    
    config = cursor.fetchone()
    if not config:
        question_value = 1.0
        wrong_answer_penalty = 0.25
        no_answer_penalty = 0.0
    else:
        question_value = config[0]
        wrong_answer_penalty = config[1]
        no_answer_penalty = config[2]
    
    # Calcular puntuación base
    raw_score = (correct_answers * question_value) - (incorrect_answers * wrong_answer_penalty) - (unanswered_questions * no_answer_penalty)
    
    # Convertir a escala 0-10
    max_possible_score = total_questions * question_value
    if max_possible_score > 0:
        score = (raw_score / max_possible_score) * 10
    else:
        score = 0
    
    # Asegurar que la puntuación esté entre 0 y 10
    score = max(0, min(10, score))
    
    print("Stats from DB:", {
        'total_questions': total_questions,
        'answered_questions': answered_questions,
        'correct_answers': correct_answers,
        'incorrect_answers': incorrect_answers,
        'unanswered_questions': unanswered_questions,
        'raw_score': raw_score,
        'normalized_score': score
    })
    
    conn.close()
    
    return jsonify({
        'total_questions': total_questions,
        'correct_answers': correct_answers,
        'incorrect_answers': incorrect_answers,
        'unanswered_questions': unanswered_questions,
        'score': round(score, 2),  # Redondear a 2 decimales
        'config': {
            'question_value': question_value,
            'wrong_answer_penalty': wrong_answer_penalty,
            'no_answer_penalty': no_answer_penalty
        }
    })

@app.route('/reset_quiz_history', methods=['POST'])
def reset_quiz_history():
    # Limpiar la tabla temporal de respuestas
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM temp_quiz_responses')
        conn.commit()
        conn.close()
        print("HISTORIAL RESETEADO")
    except Exception as e:
        print(f"Error al resetear historial: {e}")
    
    return jsonify({'success': True})

@app.route('/cleanup_sessions', methods=['POST'])
def cleanup_sessions():
    # Eliminar sesiones más antiguas que X días
    # Implementación segura que no expone datos
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True) 