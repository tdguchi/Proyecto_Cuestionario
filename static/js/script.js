document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del DOM
    const uploadForm = document.getElementById('upload-form');
    const uploadInfo = document.getElementById('upload-info');
    const configSection = document.getElementById('config-section');
    const quizTitle = document.getElementById('quiz-title');
    const questionsContainer = document.getElementById('questions-container');
    const questionCounter = document.getElementById('question-counter');
    const startQuizBtn = document.getElementById('start-quiz');
    const submitQuizBtn = document.getElementById('submit-quiz');
    const newQuizBtn = document.getElementById('new-quiz');
    const restartQuizBtn = document.getElementById('restart-quiz');
    const subjectSelect = document.getElementById('subject-select');
    
    // Referencias a las pestañas
    const setupTab = document.getElementById('setup-tab');
    const quizTab = document.getElementById('quiz-tab');
    const resultsTab = document.getElementById('results-tab');
    
    // Variables globales
    let currentQuestions = [];
    let userAnswers = {};
    
    // Cargar asignaturas disponibles al iniciar
    loadSubjects();
    
    // Inicializar los controladores de pestañas de Bootstrap
    const setupTabInstance = new bootstrap.Tab(setupTab);
    const quizTabInstance = new bootstrap.Tab(quizTab);
    const resultsTabInstance = new bootstrap.Tab(resultsTab);
    
    // Evento para el botón de reiniciar en la pestaña de resultados
    restartQuizBtn.addEventListener('click', function() {
        setupTabInstance.show();
        resultsTab.setAttribute('disabled', 'disabled');
    });
    
    function loadSubjects() {
        fetch('/get_subjects')
            .then(response => response.json())
            .then(data => {
                if (data.subjects && data.subjects.length > 0) {
                    // Limpiar select
                    subjectSelect.innerHTML = '<option value="">Selecciona una asignatura</option>';
                    
                    // Añadir opciones
                    data.subjects.forEach(subject => {
                        const option = document.createElement('option');
                        option.value = subject.id;
                        option.textContent = subject.name;
                        subjectSelect.appendChild(option);
                    });
                    
                    // Mostrar sección de configuración
                    configSection.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Error al cargar asignaturas:', error);
                showNotification('error', 'Error al cargar asignaturas');
            });
    }
    
    // Función para mostrar notificaciones
    function showNotification(type, message) {
        const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
        const icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
        
        const notification = document.createElement('div');
        notification.className = `alert ${alertClass} alert-dismissible fade show`;
        notification.innerHTML = `
            <i class="fas fa-${icon} me-2"></i>${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Añadir al DOM
        document.querySelector('.main-content').prepend(notification);
        
        // Eliminar después de 5 segundos
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
    
    // Evento para seleccionar asignatura
    subjectSelect.addEventListener('change', function() {
        const subjectId = this.value;
        
        if (!subjectId) {
            document.getElementById('scoring-config').style.display = 'none';
            startQuizBtn.disabled = true;
            return;
        }
        
        fetch('/select_subject', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                subject_id: subjectId
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                quizTitle.textContent = data.asignatura;
                
                // Mostrar y cargar la configuración de puntuación
                document.getElementById('scoring-config').style.display = 'block';
                loadSubjectConfig();
                
                // Habilitar el botón de comenzar
                startQuizBtn.disabled = false;
            }
        })
        .catch(error => {
            console.error('Error al seleccionar asignatura:', error);
            showNotification('error', 'Error al seleccionar asignatura');
        });
    });
    
    // Función para cargar la configuración de la asignatura
    function loadSubjectConfig() {
        fetch('/get_subject_config')
            .then(response => response.json())
            .then(config => {
                document.getElementById('question-value').value = config.question_value;
                document.getElementById('wrong-answer-penalty').value = config.wrong_answer_penalty;
                document.getElementById('no-answer-penalty').value = config.no_answer_penalty;
            })
            .catch(error => {
                console.error('Error al cargar configuración:', error);
                showNotification('error', 'Error al cargar configuración de puntuación');
            });
    }
    
    // Evento para guardar la configuración
    document.getElementById('save-config').addEventListener('click', function() {
        const questionValue = parseFloat(document.getElementById('question-value').value);
        const wrongAnswerPenalty = parseFloat(document.getElementById('wrong-answer-penalty').value);
        const noAnswerPenalty = parseFloat(document.getElementById('no-answer-penalty').value);
        
        fetch('/update_subject_config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question_value: questionValue,
                wrong_answer_penalty: wrongAnswerPenalty,
                no_answer_penalty: noAnswerPenalty
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('success', 'Configuración guardada correctamente');
            }
        })
        .catch(error => {
            console.error('Error al guardar configuración:', error);
            showNotification('error', 'Error al guardar configuración');
        });
    });
    
    // Evento para cargar el archivo JSON
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const file = document.getElementById('json-file').files[0];
        
        if (!file) {
            showNotification('error', 'Por favor, selecciona un archivo JSON');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        // Mostrar indicador de carga
        uploadInfo.innerHTML = '<div class="alert alert-info"><i class="fas fa-spinner fa-spin me-2"></i>Cargando archivo...</div>';
        
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                uploadInfo.innerHTML = `
                    <div class="alert alert-success">
                        <i class="fas fa-check-circle me-2"></i>Archivo cargado correctamente.<br>
                        <strong>Asignatura:</strong> ${data.asignatura}<br>
                        <strong>Preguntas:</strong> ${data.num_questions}
                    </div>
                `;
                
                // Recargar lista de asignaturas
                loadSubjects();
                
                quizTitle.textContent = data.asignatura;
                
                // Seleccionar automáticamente la asignatura recién cargada
                setTimeout(() => {
                    const options = Array.from(subjectSelect.options);
                    const option = options.find(opt => opt.textContent === data.asignatura);
                    if (option) {
                        subjectSelect.value = option.value;
                        subjectSelect.dispatchEvent(new Event('change'));
                    }
                }, 500);
            } else {
                uploadInfo.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-circle me-2"></i>${data.error}</div>`;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            uploadInfo.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-circle me-2"></i>Error al cargar el archivo.</div>`;
        });
    });
    
    // Evento para iniciar el cuestionario
    startQuizBtn.addEventListener('click', function() {
        const numQuestions = document.getElementById('num-questions').value;
        const onlyFailed = document.getElementById('only-failed').checked;
        const onlyNew = document.getElementById('only-new').checked;
        
        // Mostrar indicador de carga
        questionsContainer.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-3x"></i><p class="mt-3">Cargando preguntas...</p></div>';
        
        // Primero resetear el historial del cuestionario
        fetch('/reset_quiz_history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(() => {
            // Luego obtener las preguntas
            return fetch(`/get_questions?num_questions=${numQuestions}&only_failed=${onlyFailed}&only_new=${onlyNew}`);
        })
        .then(response => response.json())
        .then(data => {
            if (data.questions && data.questions.length > 0) {
                // Guardar preguntas actuales
                currentQuestions = data.questions;
                userAnswers = {};
                
                // Limpiar contenedor de preguntas
                questionsContainer.innerHTML = '';
                
                // Actualizar contador de preguntas
                questionCounter.textContent = `0/${currentQuestions.length}`;
                
                // Crear tarjetas de preguntas
                currentQuestions.forEach((question, index) => {
                    const template = document.getElementById('question-template');
                    const clone = document.importNode(template.content, true);
                    
                    const card = clone.querySelector('.question-card');
                    card.dataset.id = question.id;
                    
                    const questionText = card.querySelector('.question-text');
                    questionText.textContent = `${index + 1}. ${question.question_text}`;
                    
                    const answersContainer = card.querySelector('.answers-container');
                    
                    // Crear opciones de respuesta
                    question.answers.forEach(answer => {
                        const answerOption = document.createElement('div');
                        answerOption.className = 'answer-option';
                        answerOption.textContent = answer;
                        answerOption.dataset.answer = answer;
                        
                        answerOption.addEventListener('click', function() {
                            // Desmarcar otras opciones en la misma pregunta
                            const options = card.querySelectorAll('.answer-option');
                            options.forEach(opt => opt.classList.remove('selected'));
                            
                            // Marcar esta opción
                            this.classList.add('selected');
                            
                            // Guardar respuesta
                            userAnswers[question.id] = answer;
                            
                            // Actualizar contador
                            const answeredCount = Object.keys(userAnswers).length;
                            questionCounter.textContent = `${answeredCount}/${currentQuestions.length}`;
                        });
                        
                        answersContainer.appendChild(answerOption);
                    });
                    
                    questionsContainer.appendChild(card);
                });
                
                // Cambiar a la pestaña de cuestionario
                quizTab.removeAttribute('disabled');
                quizTabInstance.show();
            } else {
                questionsContainer.innerHTML = '';
                showNotification('error', 'No hay preguntas disponibles con los filtros seleccionados');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            questionsContainer.innerHTML = '';
            showNotification('error', 'Error al obtener preguntas');
        });
    });
    
    // Evento para verificar respuestas
    submitQuizBtn.addEventListener('click', function() {
        const questionCards = questionsContainer.querySelectorAll('.question-card');
        let correctCount = 0;
        let incorrectCount = 0;
        
        // Procesar cada pregunta
        const promises = [];
        
        // Mostrar indicador de carga
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'text-center mt-4';
        loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin fa-2x"></i><p class="mt-2">Verificando respuestas...</p>';
        questionsContainer.after(loadingIndicator);
        
        // Deshabilitar botón mientras se procesan las respuestas
        submitQuizBtn.disabled = true;
        
        questionCards.forEach(card => {
            const questionId = card.dataset.id;
            const selectedAnswer = userAnswers[questionId];
            
            // Buscar la pregunta actual en nuestro conjunto de preguntas
            const question = currentQuestions.find(q => q.id == questionId);
            if (!question) return;
            
            // Si no se seleccionó respuesta para esta pregunta
            if (!selectedAnswer) {
                // Obtener la respuesta correcta del servidor
                const promise = fetch('/get_correct_answer', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        question_id: questionId
                    })
                })
                .then(response => response.json())
                .then(data => {
                    // Obtener referencias a los elementos de la tarjeta
                    const answerOptions = card.querySelectorAll('.answer-option');
                    
                    // Marcar la respuesta correcta en AZUL (not-selected)
                    answerOptions.forEach(option => {
                        const answerText = option.dataset.answer;
                        if (answerText === data.correct_answer) {
                            option.classList.add('not-selected');
                        }
                    });
                    
                    return { answered: false };
                });
                
                promises.push(promise);
                return;
            }
            
            // Enviar respuesta al servidor
            const promise = fetch('/submit_answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question_id: questionId,
                    answer: selectedAnswer
                })
            })
            .then(response => response.json())
            .then(data => {
                // Obtener referencias a los elementos de la tarjeta
                const answerOptions = card.querySelectorAll('.answer-option');
                
                // Marcar opciones
                answerOptions.forEach(option => {
                    const answerText = option.dataset.answer;
                    
                    if (answerText === selectedAnswer) {
                        // Si esta es la opción seleccionada por el usuario
                        if (data.correct) {
                            // VERDE si es correcta
                            option.classList.add('correct');
                        } else {
                            // ROJO si es incorrecta
                            option.classList.add('incorrect');
                        }
                    } else if (answerText === data.correct_answer && !data.correct) {
                        // VERDE para la respuesta correcta cuando el usuario eligió incorrectamente
                        option.classList.add('correct');
                    }
                });
                
                return { correct: data.correct, answered: true };
            });
            
            promises.push(promise);
        });
        
        // Cuando todas las respuestas se hayan procesado
        Promise.all(promises)
            .then(results => {
                // Eliminar indicador de carga
                loadingIndicator.remove();
                
                // Habilitar botón nuevamente
                submitQuizBtn.disabled = false;
                
                // Obtener estadísticas del servidor
                fetch('/get_stats')
                    .then(response => response.json())
                    .then(stats => {
                        // Debug para ver qué valores estamos recibiendo
                        console.log("Stats received from server:", stats);
                        
                        // Mostrar resultados
                        document.getElementById('total-questions').textContent = stats.total_questions;
                        document.getElementById('correct-answers').textContent = stats.correct_answers;
                        document.getElementById('incorrect-answers').textContent = stats.incorrect_answers;
                        document.getElementById('unanswered-questions').textContent = stats.unanswered_questions;
                        document.getElementById('score').textContent = stats.score.toFixed(2);
                        
                        // Mostrar configuración aplicada
                        document.getElementById('config-question-value').textContent = stats.config.question_value;
                        document.getElementById('config-wrong-penalty').textContent = stats.config.wrong_answer_penalty;
                        document.getElementById('config-no-answer-penalty').textContent = stats.config.no_answer_penalty;
                        
                        // Habilitar y mostrar pestaña de resultados
                        resultsTab.removeAttribute('disabled');
                        resultsTabInstance.show();
                    });
            })
            .catch(error => {
                console.error('Error:', error);
                loadingIndicator.remove();
                submitQuizBtn.disabled = false;
                showNotification('error', 'Error al verificar respuestas');
            });
    });
    
    // Evento para iniciar un nuevo cuestionario
    newQuizBtn.addEventListener('click', function() {
        // Volver a la pestaña de configuración
        setupTabInstance.show();
    });
}); 