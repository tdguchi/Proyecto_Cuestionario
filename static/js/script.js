document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del DOM
    const uploadForm = document.getElementById('upload-form');
    const uploadInfo = document.getElementById('upload-info');
    const configSection = document.getElementById('config-section');
    const quizTitle = document.getElementById('quiz-title');
    const questionsContainer = document.getElementById('questions-container');
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
        // Obtener el valor exacto que introdujo el usuario
        const numQuestions = parseInt(document.getElementById('num-questions').value);
        const onlyFailed = document.getElementById('only-failed').checked;
        const onlyNew = document.getElementById('only-new').checked;
        
        // Validación para asegurar que el valor es positivo y no excede las preguntas disponibles
        if (isNaN(numQuestions) || numQuestions <= 0) {
            showNotification('error', 'Por favor, introduce un número válido de preguntas');
            return;
        }
        
        // Mostrar indicador de carga
        questionsContainer.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-3x"></i><p class="mt-3">Cargando preguntas...</p></div>';
        
        // Primero resetear el historial del cuestionario
        fetch('/reset_quiz_history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        })
        .then(() => {
            // Asegurarse de que el parámetro num_questions se pasa correctamente como un número
            return fetch(`/get_questions?num_questions=${numQuestions}&only_failed=${onlyFailed}&only_new=${onlyNew}`);
        })
        .then(response => response.json())
        .then(data => {
            // Depuración para verificar la respuesta del servidor
            console.log("Preguntas solicitadas:", numQuestions);
            console.log("Preguntas recibidas:", data.questions ? data.questions.length : 0);
            
            if (data.questions && data.questions.length > 0) {
                // Crear las preguntas
                createQuizQuestions(data.questions);
                
                // Mostrar notificación si se recibieron menos preguntas de las solicitadas
                if (data.questions.length < numQuestions) {
                    showNotification('warning', `Solo se han encontrado ${data.questions.length} preguntas disponibles con los criterios seleccionados.`);
                }
                
                // Habilitar la pestaña de cuestionario
                quizTab.removeAttribute('disabled');
                quizTabInstance.show();
                
                // Mostrar el navegador de preguntas
                const navigatorPanel = document.getElementById('question-navigator');
                if (navigatorPanel) {
                    navigatorPanel.style.display = 'block';
                }
            } else {
                questionsContainer.innerHTML = '';
                showNotification('error', 'No hay preguntas disponibles con los criterios seleccionados');
            }
        })
        .catch(error => {
            console.error('Error:', error);
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
                        document.getElementById('score').textContent = calculateScore(stats.correct_answers, stats.incorrect_answers, stats.unanswered_questions);
                        
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
    
    // Modificar la función que calcula la puntuación final
    function calculateScore(correct, incorrect, unanswered) {
        const questionValue = parseFloat(document.getElementById('question-value').value) || 1.0;
        const wrongPenalty = parseFloat(document.getElementById('wrong-answer-penalty').value) || 0.25;
        const noAnswerPenalty = parseFloat(document.getElementById('no-answer-penalty').value) || 0.0;
        
        // Calcular puntuación base
        let rawScore = (correct * questionValue) - (incorrect * wrongPenalty) - (unanswered * noAnswerPenalty);
        
        // Convertir a escala 0-10
        const totalQuestions = correct + incorrect + unanswered;
        const maxPossibleScore = totalQuestions * questionValue;
        
        let score = 0;
        if (maxPossibleScore > 0) {
            score = (rawScore / maxPossibleScore) * 10;
        }
        
        // Asegurar que la puntuación esté entre 0 y 10
        score = Math.max(0, Math.min(10, score));
        
        return score.toFixed(2);
    }

    // Modificar la función initQuestionNavigator para el nuevo diseño
    function initQuestionNavigator() {
        const questionGrid = document.getElementById('question-grid');
        const toggleNavigator = document.getElementById('toggle-navigator');
        const navigatorPanel = document.getElementById('question-navigator');
        
        // Limpiar el grid
        questionGrid.innerHTML = '';
        
        // Generar indicadores para cada pregunta
        currentQuestions.forEach((question, index) => {
            const indicator = document.createElement('div');
            indicator.className = 'question-indicator unanswered';
            indicator.dataset.questionId = question.id;
            indicator.dataset.index = index;
            
            // Si ya hay respuesta, marcarla como respondida
            if (userAnswers[question.id]) {
                indicator.classList.remove('unanswered');
                indicator.classList.add('answered');
            }
            
            indicator.innerHTML = `
                <div class="question-number">${index + 1}</div>
            `;
            
            // Evento para saltar a esa pregunta
            indicator.addEventListener('click', function() {
                const questionCard = document.querySelector(`.question-card[data-id="${question.id}"]`);
                if (questionCard) {
                    // Remover clase current de todos los indicadores
                    document.querySelectorAll('.question-indicator').forEach(ind => {
                        ind.classList.remove('current');
                    });
                    
                    // Añadir clase current a este indicador
                    this.classList.add('current');
                    
                    // Scroll a la pregunta
                    questionCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
            
            questionGrid.appendChild(indicator);
        });
        
        // Mostrar el navegador de preguntas y el botón de toggle
        navigatorPanel.style.display = 'block';
        toggleNavigator.style.display = 'flex';
        
        // Abrir/cerrar el navegador
        toggleNavigator.addEventListener('click', function() {
            if (navigatorPanel.style.display === 'none' || navigatorPanel.style.display === '') {
                navigatorPanel.style.display = 'block';
            } else {
                navigatorPanel.style.display = 'none';
            }
        });
    }

    // Simplificar la función para actualizar el estado
    function updateQuestionStatus(questionId, isAnswered) {
        const indicator = document.querySelector(`.question-indicator[data-question-id="${questionId}"]`);
        if (indicator) {
            if (isAnswered) {
                indicator.classList.remove('unanswered');
                indicator.classList.add('answered');
            } else {
                indicator.classList.remove('answered');
                indicator.classList.add('unanswered');
            }
        }
    }

    // Corregir la función de generación de preguntas - busca la parte donde se crean las opciones de respuesta
    function createQuizQuestions(questions) {
        // El código existente para limpiar el contenedor de preguntas
        questionsContainer.innerHTML = '';
        userAnswers = {};
        currentQuestions = questions;
        
        // Template para pregunta
        const questionTemplate = document.getElementById('question-template');
        
        // Generar preguntas
        questions.forEach((question, index) => {
            // Clonar la plantilla
            const questionCard = questionTemplate.content.cloneNode(true);
            
            // Configurar la pregunta
            const card = questionCard.querySelector('.question-card');
            card.dataset.id = question.id;
            
            // Establecer texto de la pregunta
            const questionText = questionCard.querySelector('.question-text');
            questionText.textContent = `Pregunta ${index + 1}: ${question.question_text}`;
            
            // Contenedor de respuestas
            const answersContainer = questionCard.querySelector('.answers-container');
            
            // Crear opciones de respuesta
            question.answers.forEach(answer => {
                const answerOption = document.createElement('div');
                answerOption.className = 'answer-option';
                answerOption.dataset.answer = answer;
                answerOption.textContent = answer;
                
                // Manejar clic en la opción
                answerOption.addEventListener('click', function() {
                    // Remover selección anterior
                    answersContainer.querySelectorAll('.answer-option').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    
                    // Seleccionar esta opción
                    this.classList.add('selected');
                    
                    // Guardar respuesta
                    userAnswers[question.id] = answer;
                    
                    // Actualizar el estado en el navegador
                    updateQuestionStatus(question.id, true);
                });
                
                answersContainer.appendChild(answerOption);
            });
            
            // Añadir la pregunta al contenedor
            questionsContainer.appendChild(questionCard);
        });
        
        // Inicializar el navegador de preguntas
        initQuestionNavigator();
    }
}); 