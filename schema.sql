-- Esquema de la base de datos para la aplicación de cuestionarios

-- Tabla para asignaturas
CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

-- Tabla para preguntas
CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER,
    question_text TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    FOREIGN KEY (subject_id) REFERENCES subjects (id)
);

-- Tabla para respuestas
CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER,
    answer_text TEXT NOT NULL,
    FOREIGN KEY (question_id) REFERENCES questions (id)
);

-- Tabla para historial de respuestas del usuario
CREATE TABLE IF NOT EXISTS user_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER,
    user_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions (id)
);

-- Añadir tabla de configuración de puntuación por asignatura
CREATE TABLE IF NOT EXISTS subject_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    question_value REAL NOT NULL DEFAULT 1.0,
    wrong_answer_penalty REAL NOT NULL DEFAULT 0.25,
    no_answer_penalty REAL NOT NULL DEFAULT 0.0,
    FOREIGN KEY (subject_id) REFERENCES subjects (id),
    UNIQUE(subject_id)
); 